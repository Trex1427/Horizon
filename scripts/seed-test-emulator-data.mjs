import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  assertAutomatedWriteAllowed,
  assertEmulatorWriteMode,
  resolveRuntimeProjectId,
} from "./safety/automatedWriteGuard.mjs";
import { loadEnvFile } from "./safety/loadEnvFile.mjs";

const TEST_MARKER = "UX-EMULATOR-TEST-DATA";
const SEED_SOURCE = "emulator-test-seed-v1";
const TEST_OWNER_UID = "emulator-owner-uid";

function nowIso() {
  return new Date().toISOString();
}

function buildData() {
  const createdAt = nowIso();

  const accounts = [
    {
      id: "emu-account-main",
      payload: {
        name: "EMU Compte courant",
        type: "compte_courant",
        isActive: true,
        testMarker: TEST_MARKER,
        seedSource: SEED_SOURCE,
        createdAt,
        updatedAt: createdAt,
      },
    },
    {
      id: "emu-account-pro",
      payload: {
        name: "EMU Compte pro",
        type: "compte_pro",
        isActive: true,
        testMarker: TEST_MARKER,
        seedSource: SEED_SOURCE,
        createdAt,
        updatedAt: createdAt,
      },
    },
  ];

  const categories = [
    { id: "emu-cat-transport", name: "Transport", type: "depense" },
    { id: "emu-cat-logement", name: "Logement", type: "depense" },
    { id: "emu-cat-revenus", name: "Revenus professionnels", type: "revenu" },
  ].map((item) => ({
    id: item.id,
    payload: {
      name: item.name,
      type: item.type,
      isActive: true,
      testMarker: TEST_MARKER,
      seedSource: SEED_SOURCE,
      createdAt,
      updatedAt: createdAt,
    },
  }));

  const subcategories = [
    { id: "emu-sub-carburant", name: "Carburant", categoryId: "emu-cat-transport", type: "depense" },
    { id: "emu-sub-entretien", name: "Entretien", categoryId: "emu-cat-transport", type: "depense" },
    { id: "emu-sub-electricite", name: "Electricite", categoryId: "emu-cat-logement", type: "depense" },
    { id: "emu-sub-prestation", name: "Prestation", categoryId: "emu-cat-revenus", type: "revenu" },
  ].map((item) => ({
    id: item.id,
    payload: {
      name: item.name,
      categoryId: item.categoryId,
      type: item.type,
      isActive: true,
      testMarker: TEST_MARKER,
      seedSource: SEED_SOURCE,
      createdAt,
      updatedAt: createdAt,
    },
  }));

  const thirdParties = [
    { id: "emu-tp-edf", name: "EDF", type: "supplier" },
    { id: "emu-tp-client", name: "Client Emulateur", type: "client" },
  ].map((item) => ({
    id: item.id,
    payload: {
      name: item.name,
      type: item.type,
      isActive: true,
      testMarker: TEST_MARKER,
      seedSource: SEED_SOURCE,
      createdAt,
      updatedAt: createdAt,
    },
  }));

  const activities = [
    { id: "emu-act-auto", name: "Auto-entreprise", kind: "profit_center" },
    { id: "emu-act-pet", name: "Pet sitting", kind: "profit_center" },
  ].map((item) => ({
    id: item.id,
    payload: {
      name: item.name,
      kind: item.kind,
      isActive: true,
      testMarker: TEST_MARKER,
      seedSource: SEED_SOURCE,
      createdAt,
      updatedAt: createdAt,
    },
  }));

  const projects = [
    { id: "emu-proj-monod", name: "Chantier Monod", activityId: "emu-act-auto" },
    { id: "emu-proj-roy", name: "Garde Roy", activityId: "emu-act-pet" },
  ].map((item) => ({
    id: item.id,
    payload: {
      name: item.name,
      activityId: item.activityId,
      isActive: true,
      notes: "",
      startDate: null,
      endDate: null,
      testMarker: TEST_MARKER,
      seedSource: SEED_SOURCE,
      createdAt,
      updatedAt: createdAt,
    },
  }));

  const transactions = Array.from({ length: 15 }).map((_, index) => {
    const i = index + 1;
    const isExpense = i % 3 !== 0;
    const categoryId = isExpense ? (i % 2 === 0 ? "emu-cat-transport" : "emu-cat-logement") : "emu-cat-revenus";
    const subcategoryId = isExpense
      ? (i % 2 === 0 ? "emu-sub-carburant" : "emu-sub-electricite")
      : "emu-sub-prestation";

    const categoryNameById = {
      "emu-cat-transport": "Transport",
      "emu-cat-logement": "Logement",
      "emu-cat-revenus": "Revenus professionnels",
    };

    const subcategoryNameById = {
      "emu-sub-carburant": "Carburant",
      "emu-sub-electricite": "Electricite",
      "emu-sub-prestation": "Prestation",
    };

    const date = new Date(Date.UTC(2026, 6, i)).toISOString().slice(0, 10);

    return {
      id: `emu-tx-${String(i).padStart(2, "0")}`,
      payload: {
        date,
        montant: isExpense ? Number((10 + i * 2.5).toFixed(2)) : Number((80 + i * 5.75).toFixed(2)),
        type: isExpense ? "depense" : "revenu",
        description: `UX EMU Transaction ${String(i).padStart(2, "0")}`,
        categoryId,
        categoryName: categoryNameById[categoryId],
        categorie: categoryNameById[categoryId],
        subcategoryId,
        subcategoryName: subcategoryNameById[subcategoryId],
        accountId: i % 2 === 0 ? "emu-account-pro" : "emu-account-main",
        thirdPartyId: isExpense ? "emu-tp-edf" : "emu-tp-client",
        thirdPartyName: isExpense ? "EDF" : "Client Emulateur",
        activityId: isExpense ? "emu-act-auto" : "emu-act-pet",
        activityName: isExpense ? "Auto-entreprise" : "Pet sitting",
        projectId: isExpense ? "emu-proj-monod" : "emu-proj-roy",
        projectName: isExpense ? "Chantier Monod" : "Garde Roy",
        isDeleted: false,
        testMarker: TEST_MARKER,
        seedSource: SEED_SOURCE,
        createdAt,
        updatedAt: createdAt,
      },
    };
  });

  return {
    accounts,
    categories,
    subcategories,
    thirdParties,
    activities,
    projects,
    transactions,
  };
}

async function upsertCollection(db, collectionName, entries) {
  let batch = db.batch();
  let batchSize = 0;
  let upserted = 0;

  const commitBatch = async () => {
    if (batchSize === 0) {
      return;
    }

    await batch.commit();
    batch = db.batch();
    batchSize = 0;
  };

  for (const entry of entries) {
    batch.set(db.collection(collectionName).doc(entry.id), {
      ...entry.payload,
      ownerUid: TEST_OWNER_UID,
    }, { merge: true });
    batchSize += 1;
    upserted += 1;

    if (batchSize === 400) {
      await commitBatch();
    }
  }

  await commitBatch();
  return upserted;
}

async function main() {
  loadEnvFile(".env.test");

  assertEmulatorWriteMode({ operationName: "seed:test" });
  const projectId = resolveRuntimeProjectId(process.env.VITE_FIREBASE_PROJECT_ID || "budget-alexandre-emulator");
  assertAutomatedWriteAllowed({ projectId, operationName: "seed:test" });

  const app = getApps().length ? getApps()[0] : initializeApp({ projectId });
  const db = getFirestore(app);

  const data = buildData();
  const summary = {};

  for (const [collectionName, entries] of Object.entries(data)) {
    summary[collectionName] = await upsertCollection(db, collectionName, entries);
  }

  console.log(JSON.stringify({
    result: "success",
    mode: "emulator",
    projectId,
    ownerUid: TEST_OWNER_UID,
    testMarker: TEST_MARKER,
    seedSource: SEED_SOURCE,
    summary,
  }, null, 2));
}

main().catch((error) => {
  console.error("SEED_TEST_EMULATOR_FAILED");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
