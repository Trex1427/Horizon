import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, runTransaction, setDoc } from "firebase/firestore";
import { buildWorkProjectPayload } from "../../src/features/work/workProjectModel.js";

const projectId = process.env.GCLOUD_PROJECT || "budget-alexandre";
const emulatorHost = String(process.env.FIRESTORE_EMULATOR_HOST || "").trim();
if (!emulatorHost) {
  test("work project client rules require the Firestore emulator", { skip: true }, () => {});
} else {
const [host, portRaw] = emulatorHost.split(":");
const port = Number(portRaw || 8080);
const rules = await readFile(new URL("../../firestore.rules", import.meta.url), "utf8");

const testEnv = await initializeTestEnvironment({
  projectId,
  firestore: { host, port, rules },
});

test.after(async () => {
  await testEnv.cleanup();
});

async function seedQuoteScenario({ uid, quoteId, withProfessionalActivity }) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    const now = new Date("2026-07-29T08:00:00.000Z");

    await setDoc(doc(adminDb, "workQuotes", quoteId), {
      ownerUid: uid,
      professionalActivityId: "activity-legacy",
      thirdPartyId: "third-party-ok",
      quoteNumber: "D-2026-001",
      issueDate: "2026-07-29",
      amount: 1250,
      status: "accepted",
      projectId: null,
      source: "manual",
      documentId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    });

    await setDoc(doc(adminDb, "thirdParties", "third-party-ok"), {
      ownerUid: uid,
      name: "Client legacy",
    });

    if (withProfessionalActivity) {
      await setDoc(doc(adminDb, "professionalActivities", "activity-legacy"), {
        ownerUid: uid,
        name: "Conseil",
      });
    } else {
      await setDoc(doc(adminDb, "activities", "activity-legacy"), {
        ownerUid: uid,
        name: "Legacy activity",
      });
    }
  });
}

async function createWorkProjectFromQuoteWithClientSdk({ uid, quoteId }) {
  const db = testEnv.authenticatedContext(uid).firestore();
  const quoteRef = doc(db, "workQuotes", quoteId);
  const projectRef = doc(db, "workProjects", quoteId);

  const quoteSourceSnapshot = await getDoc(quoteRef);
  if (!quoteSourceSnapshot.exists()) throw new Error("Devis source introuvable.");
  const quoteSource = { id: quoteSourceSnapshot.id, ...quoteSourceSnapshot.data() };
  console.log("QUOTE_SOURCE_READ");
  console.log(JSON.stringify(quoteSource, null, 2));

  const payloadForSet = buildWorkProjectPayload(quoteSource, {
    ownerUid: uid,
    thirdPartyName: "Client legacy",
    now: new Date("2026-07-29T09:30:00.000Z"),
  });
  console.log("WORK_PROJECT_PAYLOAD_SENT");
  console.log(JSON.stringify(payloadForSet, null, 2));

  return runTransaction(db, async (transaction) => {
    const quoteSnapshot = await transaction.get(quoteRef);
    const projectSnapshot = await transaction.get(projectRef);

    if (!quoteSnapshot.exists()) throw new Error("Devis introuvable.");
    const currentQuote = { id: quoteSnapshot.id, ...quoteSnapshot.data() };

    console.log("QUOTE_SOURCE_READ");
    console.log(JSON.stringify(currentQuote, null, 2));

    if (currentQuote.ownerUid !== uid) throw new Error("Acces au devis refuse.");
    if (currentQuote.status !== "accepted") throw new Error("Seul un devis accepte peut creer un dossier.");

    if (currentQuote.projectId) return { id: currentQuote.projectId, created: false };
    if (projectSnapshot.exists()) {
      transaction.update(quoteRef, { projectId: projectRef.id, updatedAt: new Date() });
      return { id: projectRef.id, created: false };
    }

    transaction.set(projectRef, payloadForSet);
    transaction.update(quoteRef, {
      projectId: projectRef.id,
      updatedAt: new Date("2026-07-29T09:30:00.000Z"),
    });

    return { id: projectRef.id, created: true };
  });
}

test("work project create from accepted quote succeeds with professionalActivities reference", async () => {
  const uid = "owner-work-project-ok";
  const quoteId = "quote-create-client-ok";

  await seedQuoteScenario({ uid, quoteId, withProfessionalActivity: true });

  const result = await createWorkProjectFromQuoteWithClientSdk({ uid, quoteId });
  assert.deepEqual(result, { id: quoteId, created: true });

  const db = testEnv.authenticatedContext(uid).firestore();
  const projectSnapshot = await getDoc(doc(db, "workProjects", quoteId));
  assert.equal(projectSnapshot.exists(), true);
  assert.equal(projectSnapshot.data().quoteId, quoteId);
});

test("work project create from accepted historical quote accepts its owned legacy activity", async () => {
  const uid = "owner-work-project-legacy";
  const quoteId = "quote-create-client-legacy";

  await seedQuoteScenario({ uid, quoteId, withProfessionalActivity: false });

  let firestoreError = null;
  try {
    await createWorkProjectFromQuoteWithClientSdk({ uid, quoteId });
  } catch (error) {
    firestoreError = error;
  }

  assert.equal(firestoreError, null, "The owned legacy activity must remain compatible");
  console.log("FIREBASE_ERROR_EXACT");
  console.log(JSON.stringify({
    code: firestoreError?.code || null,
    message: firestoreError?.message || String(firestoreError),
    name: firestoreError?.name || null,
    stack: firestoreError?.stack || null,
  }, null, 2));

});
}
