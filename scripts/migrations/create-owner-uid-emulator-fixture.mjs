import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const OUTPUT_PATH = resolve(process.cwd(), "tmp/owner-uid-emulator-backup");
const OWNER_UID = "ownerUidFixture123";

function makeDocument(collection, id, data, subcollections = {}) {
  return {
    id,
    path: `${collection}/${id}`,
    createTime: { __firestoreType: "timestamp", seconds: 1, nanoseconds: 0, iso: "1970-01-01T00:00:01.000Z" },
    updateTime: { __firestoreType: "timestamp", seconds: 1, nanoseconds: 0, iso: "1970-01-01T00:00:01.000Z" },
    readTime: { __firestoreType: "timestamp", seconds: 2, nanoseconds: 0, iso: "1970-01-01T00:00:02.000Z" },
    data,
    subcollections,
  };
}

function collectionPayload(name, documents) {
  return {
    id: name,
    path: name,
    documentCount: documents.length,
    documents,
  };
}

const collections = {
  accounts: collectionPayload("accounts", [
    makeDocument("accounts", "missing-owner", { name: "Missing owner", createdAt: "2026-07-17T00:00:00.000Z" }),
    makeDocument("accounts", "already-compliant", { ownerUid: OWNER_UID, name: "Already compliant" }),
    makeDocument("accounts", "conflicting-owner", { ownerUid: "otherOwnerFixture123", name: "Conflict" }),
    makeDocument("accounts", "invalid-null", { ownerUid: null, name: "Invalid null" }),
    makeDocument("accounts", "invalid-number", { ownerUid: 42, name: "Invalid number" }),
    makeDocument("accounts", "invalid-array", { ownerUid: [OWNER_UID], name: "Invalid array" }),
    makeDocument("accounts", "rich-document", {
      name: "Rich document",
      amount: 123.45,
      tags: ["fixture", "ownerUid"],
      nested: {
        accountRef: { __firestoreType: "documentReference", path: "accounts/missing-owner", id: "missing-owner" },
        createdAt: { __firestoreType: "timestamp", seconds: 3, nanoseconds: 0, iso: "1970-01-01T00:00:03.000Z" },
      },
    }, {
      notes: collectionPayload("notes", [
        makeDocument("accounts/rich-document/notes", "nested-note", { label: "subcollection stays visible in audit" }),
      ]),
    }),
  ]),
  transactions: collectionPayload("transactions", Array.from({ length: 260 }, (_, index) => makeDocument(
    "transactions",
    `batch-${String(index + 1).padStart(3, "0")}`,
    {
      label: `Batch fixture ${index + 1}`,
      amount: index + 1,
      accountId: "missing-owner",
      createdAt: "2026-07-17T00:00:00.000Z",
    },
  ))),
  budgets: collectionPayload("budgets", []),
  fraisFixes: collectionPayload("fraisFixes", [
    makeDocument("fraisFixes", "legacy-fixed-expense", { label: "Legacy out of scope" }),
  ]),
};

async function main() {
  const collectionsPath = resolve(OUTPUT_PATH, "collections");
  await mkdir(collectionsPath, { recursive: true });

  const collectionsExported = Object.keys(collections);
  const documentsPerCollection = {};
  let totalDocuments = 0;

  for (const [name, payload] of Object.entries(collections)) {
    documentsPerCollection[name] = {
      rootDocumentCount: payload.documentCount,
      totalDocumentsIncludingSubcollections: payload.documents.reduce((count, document) => {
        const subCount = Object.values(document.subcollections || {}).reduce((sum, subcollection) => sum + subcollection.documentCount, 0);
        return count + 1 + subCount;
      }, 0),
    };
    totalDocuments += documentsPerCollection[name].totalDocumentsIncludingSubcollections;
    await writeFile(resolve(collectionsPath, `${name}.json`), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  await writeFile(resolve(OUTPUT_PATH, "manifest.json"), `${JSON.stringify({
    formatVersion: "firestore-backup-v1",
    startedAtUtc: "2026-07-17T00:00:00.000Z",
    finishedAtUtc: "2026-07-17T00:00:01.000Z",
    result: "success",
    projectId: "budget-alexandre",
    databaseId: "(default)",
    rootCollectionsCount: collectionsExported.length,
    totalDocuments,
    documentsPerCollection,
    collectionsExported,
    collectionsWithSubcollectionsDetected: {
      accounts: ["notes"],
      transactions: [],
      budgets: [],
      fraisFixes: [],
    },
    outputFolder: OUTPUT_PATH,
    error: null,
  }, null, 2)}\n`, "utf8");

  console.log(`OwnerUid Emulator fixture written: ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
