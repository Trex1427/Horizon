import process from "node:process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { assertAutomatedWriteAllowed } from "../safety/automatedWriteGuard.mjs";

const SERVICE_ACCOUNT_PATH = resolve(process.cwd(), "scripts/maintenance/service-account.json");
const REPORTS_DIR = resolve(process.cwd(), "artifacts");

const COLLECTIONS = {
  accounts: "accounts",
  categories: "categories",
  subcategories: "subcategories",
  thirdParties: "thirdParties",
  activities: "activities",
  projects: "projects",
  transactions: "transactions",
};

const TEST_PATTERNS = [
  /^UX2?\s/i,
  /^UI-MASS-TRACE-/i,
];

const EXPLICIT_LABELS = new Set([
  "UX2 ACC ADD",
  "UX2 ACC EDIT",
  "UX2 CAT ADD",
  "UX2 CAT EDIT",
  "UX2 SUB ADD",
  "UX2 SUB EDIT",
  "UX2 ACT ADD",
  "UX2 ACT EDIT",
  "UX2 PROJ ADD",
  "UX2 PROJ EDIT",
  "UX2 TP ADD",
  "UX2 TP EDIT",
]);

const TX_TEXT_FIELDS = [
  "name",
  "label",
  "libelle",
  "description",
  "notes",
  "categoryName",
  "subcategoryName",
  "thirdPartyName",
  "activityName",
  "projectName",
  "accountName",
  "destinationAccountName",
];

const REFERENCE_NAME_FIELDS = ["name", "label", "libelle", "title"];

function parseArgs(argv = []) {
  return {
    apply: argv.includes("--apply"),
    confirm: argv.includes("--confirm-run"),
    reportTag: String((argv.find((arg) => arg.startsWith("--report-tag=")) || "").replace("--report-tag=", "") || "default").trim(),
  };
}

function toSafeString(value) {
  return String(value ?? "").trim();
}

function normalizeLabel(value) {
  return toSafeString(value).replace(/\s+/g, " ").trim();
}

function startsWithKnownTestPrefix(value) {
  const text = normalizeLabel(value);
  if (!text) {
    return false;
  }

  return TEST_PATTERNS.some((pattern) => pattern.test(text));
}

function matchesExplicitUxLabel(value) {
  const text = normalizeLabel(value).toUpperCase();
  if (!text) {
    return false;
  }

  return EXPLICIT_LABELS.has(text);
}

function findReferenceName(doc = {}) {
  for (const fieldName of REFERENCE_NAME_FIELDS) {
    const value = toSafeString(doc[fieldName]);
    if (value) {
      return value;
    }
  }

  return "";
}

function formatTimestamp(raw) {
  if (!raw) {
    return null;
  }

  if (typeof raw?.toDate === "function") {
    try {
      return raw.toDate().toISOString();
    } catch {
      return null;
    }
  }

  if (typeof raw === "string") {
    const date = new Date(raw);
    if (Number.isFinite(date.getTime())) {
      return date.toISOString();
    }
    return raw;
  }

  if (typeof raw === "number") {
    const date = new Date(raw);
    if (Number.isFinite(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

async function createAdminDb({ apply = false } = {}) {
  const serviceAccountRaw = await readFile(SERVICE_ACCOUNT_PATH, "utf8");
  const serviceAccount = JSON.parse(serviceAccountRaw);

  if (apply) {
    assertAutomatedWriteAllowed({
      projectId: serviceAccount.project_id,
      operationName: "maintenance:cleanup-ux-test-references",
    });
  }

  const app = getApps().length
    ? getApps()[0]
    : initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

  return getFirestore(app);
}

async function loadCollectionDocs(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

function computeReferenceCandidate(doc, collectionName) {
  const name = findReferenceName(doc);
  const evidence = [];

  if (startsWithKnownTestPrefix(name)) {
    evidence.push(`name matches test prefix (${name})`);
  }

  if (matchesExplicitUxLabel(name)) {
    evidence.push(`name matches explicit ux test label (${name})`);
  }

  return {
    collection: collectionName,
    id: doc.id,
    name,
    createdAt: formatTimestamp(doc.createdAt),
    evidence,
    isCandidate: evidence.length > 0,
  };
}

function detectTransactionTestMarkers(transaction = {}) {
  const evidence = [];

  for (const fieldName of TX_TEXT_FIELDS) {
    const value = toSafeString(transaction[fieldName]);
    if (!value) {
      continue;
    }

    if (startsWithKnownTestPrefix(value)) {
      evidence.push(`tx.${fieldName} matches test prefix (${value})`);
    }

    if (matchesExplicitUxLabel(value)) {
      evidence.push(`tx.${fieldName} matches explicit ux test label (${value})`);
    }
  }

  return evidence;
}

function buildDependencyIndex(transactions = [], subcategories = [], projects = []) {
  const byAccountId = new Map();
  const byDestinationAccountId = new Map();
  const byCategoryId = new Map();
  const bySubcategoryId = new Map();
  const byThirdPartyId = new Map();
  const byActivityId = new Map();
  const byProjectId = new Map();
  const subcategoriesByCategoryId = new Map();
  const projectsByActivityId = new Map();

  const pushToMapArray = (map, key, value) => {
    const normalizedKey = toSafeString(key);
    if (!normalizedKey) {
      return;
    }

    if (!map.has(normalizedKey)) {
      map.set(normalizedKey, []);
    }

    map.get(normalizedKey).push(value);
  };

  for (const tx of transactions) {
    pushToMapArray(byAccountId, tx.accountId, tx);
    pushToMapArray(byDestinationAccountId, tx.destinationAccountId, tx);
    pushToMapArray(byCategoryId, tx.categoryId, tx);
    pushToMapArray(bySubcategoryId, tx.subcategoryId, tx);
    pushToMapArray(byThirdPartyId, tx.thirdPartyId, tx);
    pushToMapArray(byActivityId, tx.activityId, tx);
    pushToMapArray(byProjectId, tx.projectId, tx);
  }

  for (const subcategory of subcategories) {
    pushToMapArray(subcategoriesByCategoryId, subcategory.categoryId, subcategory);
  }

  for (const project of projects) {
    pushToMapArray(projectsByActivityId, project.activityId, project);
  }

  return {
    byAccountId,
    byDestinationAccountId,
    byCategoryId,
    bySubcategoryId,
    byThirdPartyId,
    byActivityId,
    byProjectId,
    subcategoriesByCategoryId,
    projectsByActivityId,
  };
}

function txDependencyListForReference(candidate, dependencies) {
  switch (candidate.collection) {
    case COLLECTIONS.accounts:
      return [
        ...(dependencies.byAccountId.get(candidate.id) || []),
        ...(dependencies.byDestinationAccountId.get(candidate.id) || []),
      ];
    case COLLECTIONS.categories:
      return dependencies.byCategoryId.get(candidate.id) || [];
    case COLLECTIONS.subcategories:
      return dependencies.bySubcategoryId.get(candidate.id) || [];
    case COLLECTIONS.thirdParties:
      return dependencies.byThirdPartyId.get(candidate.id) || [];
    case COLLECTIONS.activities:
      return dependencies.byActivityId.get(candidate.id) || [];
    case COLLECTIONS.projects:
      return dependencies.byProjectId.get(candidate.id) || [];
    default:
      return [];
  }
}

function childDependencyListForReference(candidate, dependencies, candidateByCollectionAndId) {
  if (candidate.collection === COLLECTIONS.categories) {
    const children = dependencies.subcategoriesByCategoryId.get(candidate.id) || [];
    return children.map((doc) => {
      const childCandidate = candidateByCollectionAndId.get(`${COLLECTIONS.subcategories}:${doc.id}`);
      return {
        collection: COLLECTIONS.subcategories,
        id: doc.id,
        name: findReferenceName(doc),
        isCandidate: Boolean(childCandidate),
      };
    });
  }

  if (candidate.collection === COLLECTIONS.activities) {
    const children = dependencies.projectsByActivityId.get(candidate.id) || [];
    return children.map((doc) => {
      const childCandidate = candidateByCollectionAndId.get(`${COLLECTIONS.projects}:${doc.id}`);
      return {
        collection: COLLECTIONS.projects,
        id: doc.id,
        name: findReferenceName(doc),
        isCandidate: Boolean(childCandidate),
      };
    });
  }

  return [];
}

function summarizeTx(tx) {
  const label = toSafeString(tx.label || tx.libelle || tx.description || tx.name || tx.categoryName || "");
  return {
    id: tx.id,
    label,
    createdAt: formatTimestamp(tx.createdAt),
  };
}

function buildInventory({ referenceCandidates, transactions, dependencies }) {
  const candidateByCollectionAndId = new Map(
    referenceCandidates.map((candidate) => [`${candidate.collection}:${candidate.id}`, candidate])
  );

  const transactionMarkersById = new Map();
  for (const tx of transactions) {
    const markers = detectTransactionTestMarkers(tx);
    if (markers.length > 0) {
      transactionMarkersById.set(tx.id, markers);
    }
  }

  const txCandidateRows = [];
  for (const tx of transactions) {
    const txMarkers = transactionMarkersById.get(tx.id) || [];
    if (!txMarkers.length) {
      continue;
    }

    txCandidateRows.push({
      collection: COLLECTIONS.transactions,
      id: tx.id,
      name: toSafeString(tx.label || tx.libelle || tx.description || tx.name || ""),
      createdAt: formatTimestamp(tx.createdAt),
      dependencies: "n/a",
      decision: "DELETE",
      justification: txMarkers.join("; "),
      txId: tx.id,
    });
  }

  const referenceRows = [];

  for (const candidate of referenceCandidates) {
    const txDeps = txDependencyListForReference(candidate, dependencies);
    const uniqueTxDeps = [...new Map(txDeps.map((tx) => [tx.id, tx])).values()];
    const clearTestTxDeps = [];
    const unclearTxDeps = [];

    for (const tx of uniqueTxDeps) {
      const markers = transactionMarkersById.get(tx.id) || [];
      if (markers.length > 0) {
        clearTestTxDeps.push({ tx, markers });
      } else {
        unclearTxDeps.push(tx);
      }
    }

    const childDeps = childDependencyListForReference(candidate, dependencies, candidateByCollectionAndId);
    const nonCandidateChildren = childDeps.filter((child) => !child.isCandidate);

    let decision = "KEEP";
    const decisionReasons = [];

    if (unclearTxDeps.length > 0) {
      decision = "KEEP";
      decisionReasons.push(`referenced by non-clearly-test transactions (${unclearTxDeps.length})`);
    }

    if (nonCandidateChildren.length > 0) {
      decision = "KEEP";
      decisionReasons.push(`has non-test child references (${nonCandidateChildren.length})`);
    }

    if (decisionReasons.length === 0) {
      decision = "DELETE";
      decisionReasons.push("name matches explicit ux/ui test convention and no unsafe dependency");
    }

    const txDepSummary = [];
    if (clearTestTxDeps.length > 0) {
      txDepSummary.push(`clear-test tx=${clearTestTxDeps.length}`);
    }
    if (unclearTxDeps.length > 0) {
      txDepSummary.push(`unclear tx=${unclearTxDeps.length}`);
    }
    if (childDeps.length > 0) {
      txDepSummary.push(`child refs=${childDeps.length}`);
    }

    referenceRows.push({
      collection: candidate.collection,
      id: candidate.id,
      name: candidate.name,
      createdAt: candidate.createdAt,
      dependencies: txDepSummary.join(", ") || "none",
      decision,
      justification: [...candidate.evidence, ...decisionReasons].join("; "),
      clearTestTxDependencies: clearTestTxDeps.map((entry) => ({
        ...summarizeTx(entry.tx),
        markers: entry.markers,
      })),
      unclearTxDependencies: unclearTxDeps.map((tx) => summarizeTx(tx)),
      childDependencies: childDeps,
      candidate,
    });
  }

  return {
    txCandidateRows,
    referenceRows,
    transactionMarkersById,
  };
}

async function deleteByIds(db, collectionName, ids = []) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  let deletedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < uniqueIds.length; i += 400) {
    const chunk = uniqueIds.slice(i, i + 400);
    const batch = db.batch();

    for (const id of chunk) {
      batch.delete(db.collection(collectionName).doc(id));
    }

    try {
      await batch.commit();
      deletedCount += chunk.length;
    } catch {
      failedCount += chunk.length;
    }
  }

  return {
    deletedCount,
    failedCount,
  };
}

function deletionPlanFromInventory(inventory) {
  const txIdsToDelete = inventory.txCandidateRows.map((row) => row.id);

  const refsToDelete = inventory.referenceRows
    .filter((row) => row.decision === "DELETE")
    .map((row) => ({ collection: row.collection, id: row.id }));

  return {
    txIdsToDelete,
    refsToDelete,
  };
}

function sortReferenceDeletes(refs = []) {
  const order = [
    COLLECTIONS.subcategories,
    COLLECTIONS.projects,
    COLLECTIONS.thirdParties,
    COLLECTIONS.activities,
    COLLECTIONS.categories,
    COLLECTIONS.accounts,
  ];

  const priority = new Map(order.map((collection, index) => [collection, index]));

  return [...refs].sort((a, b) => {
    const pa = priority.get(a.collection) ?? 999;
    const pb = priority.get(b.collection) ?? 999;

    if (pa !== pb) {
      return pa - pb;
    }

    return String(a.id).localeCompare(String(b.id));
  });
}

function inventoryTableRows(inventory) {
  const rows = [];

  for (const row of inventory.txCandidateRows) {
    rows.push({
      collection: row.collection,
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
      dependencies: row.dependencies,
      decision: row.decision,
      justification: row.justification,
    });
  }

  for (const row of inventory.referenceRows) {
    rows.push({
      collection: row.collection,
      id: row.id,
      name: row.name,
      createdAt: row.createdAt,
      dependencies: row.dependencies,
      decision: row.decision,
      justification: row.justification,
    });
  }

  rows.sort((a, b) => {
    if (a.collection !== b.collection) {
      return a.collection.localeCompare(b.collection);
    }

    return a.id.localeCompare(b.id);
  });

  return rows;
}

function printInventorySummary(inventory) {
  const rows = inventoryTableRows(inventory);
  console.log("INVENTORY_START");
  console.log(JSON.stringify(rows, null, 2));
  console.log("INVENTORY_END");

  const byDecision = rows.reduce((acc, row) => {
    acc[row.decision] = (acc[row.decision] || 0) + 1;
    return acc;
  }, {});

  console.log(`Inventory rows: ${rows.length}`);
  console.log(`- delete candidates: ${byDecision.DELETE || 0}`);
  console.log(`- keep candidates: ${byDecision.KEEP || 0}`);
}

async function writeReport(reportTag, phase, report) {
  await mkdir(REPORTS_DIR, { recursive: true });
  const filePath = resolve(REPORTS_DIR, `ux-test-cleanup-${reportTag}-${phase}.json`);
  await writeFile(filePath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return filePath;
}

async function loadState(db) {
  const [accounts, categories, subcategories, thirdParties, activities, projects, transactions] = await Promise.all([
    loadCollectionDocs(db, COLLECTIONS.accounts),
    loadCollectionDocs(db, COLLECTIONS.categories),
    loadCollectionDocs(db, COLLECTIONS.subcategories),
    loadCollectionDocs(db, COLLECTIONS.thirdParties),
    loadCollectionDocs(db, COLLECTIONS.activities),
    loadCollectionDocs(db, COLLECTIONS.projects),
    loadCollectionDocs(db, COLLECTIONS.transactions),
  ]);

  return { accounts, categories, subcategories, thirdParties, activities, projects, transactions };
}

function buildReferenceCandidates(state) {
  const refs = [];

  for (const [collectionName, docs] of Object.entries({
    [COLLECTIONS.accounts]: state.accounts,
    [COLLECTIONS.categories]: state.categories,
    [COLLECTIONS.subcategories]: state.subcategories,
    [COLLECTIONS.thirdParties]: state.thirdParties,
    [COLLECTIONS.activities]: state.activities,
    [COLLECTIONS.projects]: state.projects,
  })) {
    for (const doc of docs) {
      const candidate = computeReferenceCandidate(doc, collectionName);
      if (candidate.isCandidate) {
        refs.push(candidate);
      }
    }
  }

  return refs;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.apply && !args.confirm) {
    console.error("Refusing to apply deletion without --confirm-run");
    process.exitCode = 1;
    return;
  }

  const db = await createAdminDb({ apply: args.apply });
  const beforeState = await loadState(db);
  const beforeCandidates = buildReferenceCandidates(beforeState);
  const beforeDependencies = buildDependencyIndex(beforeState.transactions, beforeState.subcategories, beforeState.projects);
  const beforeInventory = buildInventory({
    referenceCandidates: beforeCandidates,
    transactions: beforeState.transactions,
    dependencies: beforeDependencies,
  });

  printInventorySummary(beforeInventory);

  const beforePlan = deletionPlanFromInventory(beforeInventory);
  const beforeReport = {
    mode: args.apply ? "apply" : "dry-run",
    phase: "before",
    plan: {
      transactionsToDelete: beforePlan.txIdsToDelete,
      referencesToDelete: sortReferenceDeletes(beforePlan.refsToDelete),
    },
    inventoryRows: inventoryTableRows(beforeInventory),
  };

  const beforeReportPath = await writeReport(args.reportTag, "before", beforeReport);
  console.log(`Report before written: ${beforeReportPath}`);

  if (!args.apply) {
    return;
  }

  const deleted = {
    transactions: await deleteByIds(db, COLLECTIONS.transactions, beforePlan.txIdsToDelete),
    referencesByCollection: {},
  };

  const refsInOrder = sortReferenceDeletes(beforePlan.refsToDelete);
  const refsByCollection = refsInOrder.reduce((acc, item) => {
    if (!acc[item.collection]) {
      acc[item.collection] = [];
    }
    acc[item.collection].push(item.id);
    return acc;
  }, {});

  for (const [collectionName, ids] of Object.entries(refsByCollection)) {
    deleted.referencesByCollection[collectionName] = await deleteByIds(db, collectionName, ids);
  }

  const afterState = await loadState(db);
  const afterCandidates = buildReferenceCandidates(afterState);
  const afterDependencies = buildDependencyIndex(afterState.transactions, afterState.subcategories, afterState.projects);
  const afterInventory = buildInventory({
    referenceCandidates: afterCandidates,
    transactions: afterState.transactions,
    dependencies: afterDependencies,
  });

  printInventorySummary(afterInventory);

  const afterReport = {
    mode: "apply",
    phase: "after",
    deleted,
    inventoryRows: inventoryTableRows(afterInventory),
  };

  const afterReportPath = await writeReport(args.reportTag, "after", afterReport);
  console.log(`Report after written: ${afterReportPath}`);
}

main().catch((error) => {
  console.error("UX test cleanup failed");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
