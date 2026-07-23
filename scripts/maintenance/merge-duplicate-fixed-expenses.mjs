import process from "node:process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { buildFixedExpenseDuplicateMergeReport } from "../../src/services/fixedExpenseDuplicateMerge.js";

export const EXPECTED_PROJECT_ID = "budget-alexandre";
export const APPLY_FLAG = "--apply-confirmed-fixed-expense-merge";
export const AUTHORIZED_CANONICAL_FIXED_EXPENSE_IDS = [
  "xgnGCIIo4tqtRYZFuQRD",
  "Lwf4ibPfj7ckq1a5a7Or",
];
export const AUTHORIZED_FIXED_EXPENSE_DELETE_IDS = [
  "3pTtB9XjCQzBBXd12VPI",
  "AxaZ1YTImrIRT4qQXtlL",
  "I6kHEijqJDCFcjQCEjWz",
  "OLEn0ZuMLensdL7Zpr4H",
];

const REPORT_ROOT = resolve(process.cwd(), "artifacts/maintenance");
const SERVICE_ACCOUNT_PATH = resolve(process.cwd(), "scripts/maintenance/service-account.json");
const COLLECTIONS = [
  "fixedExpenses",
  "transactions",
  "accounts",
  "categories",
  "subcategories",
  "thirdParties",
  "projects",
  "activities",
];

function timestampForPath(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}_${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}-${pad(date.getUTCSeconds())}`;
}

function parseArgs(argv) {
  const options = {
    apply: false,
    backupDir: null,
    projectId: null,
    reportPath: null,
    reportTag: "manual",
    year: new Date().getFullYear(),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") continue;
    if (arg === APPLY_FLAG) {
      options.apply = true;
      continue;
    }
    if (arg === "--project") {
      options.projectId = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg.startsWith("--project=")) {
      options.projectId = arg.slice("--project=".length);
      continue;
    }
    if (arg.startsWith("--backup-dir=")) {
      options.backupDir = resolve(process.cwd(), arg.slice("--backup-dir=".length));
      continue;
    }
    if (arg.startsWith("--report-path=")) {
      options.reportPath = resolve(process.cwd(), arg.slice("--report-path=".length));
      continue;
    }
    if (arg.startsWith("--report-tag=")) {
      options.reportTag = arg.slice("--report-tag=".length).replace(/[^a-zA-Z0-9._-]/g, "_") || "manual";
      continue;
    }
    if (arg.startsWith("--year=")) {
      options.year = Number(arg.slice("--year=".length));
      continue;
    }
    throw new Error(`Argument interdit ou inconnu: ${arg}`);
  }

  if (!Number.isInteger(options.year)) {
    throw new Error("--year doit etre une annee entiere.");
  }

  return options;
}

function buildReportPath(options, prefix) {
  return options.reportPath || resolve(REPORT_ROOT, `${prefix}-${options.reportTag}-${timestampForPath()}.json`);
}

function sortStrings(values) {
  return [...values].map(String).sort();
}

function sameStringSet(left, right) {
  return JSON.stringify(sortStrings(left)) === JSON.stringify(sortStrings(right));
}

function roundCents(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function assertForecastMonths(forecast, months, expectedAmount, label) {
  for (const month of months) {
    const entry = forecast.find((item) => item.month === month);
    if (!entry || roundCents(entry.expectedFixedExpenses) !== expectedAmount) {
      throw new Error(`Garde-fou ${label}: prevision ${month} attendue ${expectedAmount}, recue ${entry?.expectedFixedExpenses ?? "<absente>"}.`);
    }
  }
}

function canonicalizeFirestoreValue(value) {
  if (Array.isArray(value)) return value.map(canonicalizeFirestoreValue);
  if (value && typeof value === "object") {
    if (typeof value.toMillis === "function") return { __timestampMs: value.toMillis() };
    if (typeof value.toDate === "function") return { __date: value.toDate().toISOString() };
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalizeFirestoreValue(entry)]));
  }
  return value;
}

function stableStateJson(value) {
  return JSON.stringify(canonicalizeFirestoreValue(value));
}

function assertUnchangedDocuments(beforeItems, afterItems, removedIds, collectionName) {
  const removed = new Set(removedIds);
  const afterById = new Map(afterItems.map((item) => [item.id, item]));
  for (const beforeItem of beforeItems) {
    if (removed.has(beforeItem.id)) continue;
    const afterItem = afterById.get(beforeItem.id);
    if (!afterItem) {
      throw new Error(`Garde-fou post-commit: document ${collectionName}/${beforeItem.id} absent apres commit.`);
    }
    if (stableStateJson(beforeItem) !== stableStateJson(afterItem)) {
      throw new Error(`Garde-fou post-commit: document ${collectionName}/${beforeItem.id} modifie.`);
    }
  }
}

function assertAuthorizedPreApplyReport(report, plan) {
  const expectedMonths = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];
  const fixedExpenseIds = new Set(report.allFixedExpenses.map((item) => item.id));
  const groupsByCanonical = new Map(report.duplicateGroups.map((group) => [group.canonicalId, group]));

  if (report.fixedExpenseCountBefore !== 15) throw new Error(`Garde-fou avant: fixedExpenses attendu 15, recu ${report.fixedExpenseCountBefore}.`);
  if (report.transactionCount !== 208) throw new Error(`Garde-fou avant: transactions attendu 208, recu ${report.transactionCount}.`);
  if (report.fixedExpenseIdsUsed.length !== 0) throw new Error("Garde-fou avant: des transactions utilisent fixedExpenseId.");
  if (report.orphanTransactions.length !== 0) throw new Error("Garde-fou avant: transactions orphelines detectees.");
  if (report.duplicateGroups.length !== 2) throw new Error(`Garde-fou avant: 2 groupes compatibles attendus, recus ${report.duplicateGroups.length}.`);
  if (report.incompatibleGroups.length !== 0) throw new Error("Garde-fou avant: nouvel element compatible ou ambigu detecte.");
  if (plan.transactionUpdates.length !== 0) throw new Error("Garde-fou avant: aucune transaction ne doit etre reaffectee.");
  if (plan.fixedExpenseDeletes.length !== 4 || plan.writeCount !== 4) throw new Error(`Garde-fou avant: 4 suppressions attendues, plan=${plan.fixedExpenseDeletes.length}, writes=${plan.writeCount}.`);
  if (!sameStringSet(plan.fixedExpenseDeletes, AUTHORIZED_FIXED_EXPENSE_DELETE_IDS)) throw new Error(`Garde-fou avant: liste destructive non autorisee: ${plan.fixedExpenseDeletes.join(", ")}.`);

  for (const id of AUTHORIZED_FIXED_EXPENSE_DELETE_IDS) {
    if (!fixedExpenseIds.has(id)) throw new Error(`Garde-fou avant: doublon autorise absent: ${id}.`);
  }
  for (const id of AUTHORIZED_CANONICAL_FIXED_EXPENSE_IDS) {
    if (!fixedExpenseIds.has(id)) throw new Error(`Garde-fou avant: canonique absent: ${id}.`);
  }
  if (!report.allFixedExpenses.find((item) => item.id === "3pTtB9XjCQzBBXd12VPI" && item.isActive === true)) {
    throw new Error("Garde-fou avant: le doublon Impots actif n'existe plus.");
  }

  if (!sameStringSet([...groupsByCanonical.keys()], AUTHORIZED_CANONICAL_FIXED_EXPENSE_IDS)) {
    throw new Error(`Garde-fou avant: canoniques detectes non autorises: ${[...groupsByCanonical.keys()].join(", ")}.`);
  }
  for (const [canonicalId, group] of groupsByCanonical.entries()) {
    if (!group.safeToMerge) throw new Error(`Garde-fou avant: groupe ${canonicalId} non compatible.`);
    if (!Object.values(group.guardrails).every((value) => value === true)) {
      throw new Error(`Garde-fou avant: proprietes metier divergentes pour ${canonicalId}.`);
    }
  }

  assertForecastMonths(report.before.forecast, expectedMonths, 937.52, "avant");
  assertForecastMonths(report.after.forecast, expectedMonths, 908.52, "apres-planifie");
  for (const month of expectedMonths) {
    const entry = report.comparison.monthlyForecasts.find((item) => item.month === month);
    if (!entry || roundCents(entry.delta) !== -29) {
      throw new Error(`Garde-fou avant: delta ${month} attendu -29, recu ${entry?.delta ?? "<absent>"}.`);
    }
  }
}

function assertAuthorizedPostApplyState({ beforeState, afterState, afterReport, plan }) {
  const expectedMonths = ["2026-07", "2026-08", "2026-09", "2026-10", "2026-11", "2026-12"];
  const afterFixedExpenseIds = new Set(afterState.fixedExpenses.map((item) => item.id));

  if (afterState.fixedExpenses.length !== 11) throw new Error(`Garde-fou apres: fixedExpenses attendu 11, recu ${afterState.fixedExpenses.length}.`);
  if (afterState.transactions.length !== 208) throw new Error(`Garde-fou apres: transactions attendu 208, recu ${afterState.transactions.length}.`);
  if (afterReport.fixedExpenseIdsUsed.length !== 0) throw new Error("Garde-fou apres: des transactions utilisent fixedExpenseId.");
  if (afterReport.orphanTransactions.length !== 0) throw new Error("Garde-fou apres: transactions orphelines detectees.");
  for (const id of AUTHORIZED_CANONICAL_FIXED_EXPENSE_IDS) {
    if (!afterFixedExpenseIds.has(id)) throw new Error(`Garde-fou apres: canonique absent: ${id}.`);
  }
  for (const id of AUTHORIZED_FIXED_EXPENSE_DELETE_IDS) {
    if (afterFixedExpenseIds.has(id)) throw new Error(`Garde-fou apres: doublon encore present: ${id}.`);
  }
  assertUnchangedDocuments(beforeState.fixedExpenses, afterState.fixedExpenses, plan.fixedExpenseDeletes, "fixedExpenses");
  assertUnchangedDocuments(beforeState.transactions, afterState.transactions, [], "transactions");
  assertForecastMonths(afterReport.before.forecast, expectedMonths, 908.52, "apres");
}

async function writeReport(reportPath, report) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function readBackupCollection(backupDir, collectionName) {
  const collectionPath = join(backupDir, "collections", `${collectionName}.json`);
  const parsed = JSON.parse(await readFile(collectionPath, "utf8"));
  return (parsed.documents || []).map((document) => ({
    id: document.id,
    path: document.path,
    createTime: document.createTime,
    updateTime: document.updateTime,
    ...document.data,
  }));
}

async function loadFromBackup(backupDir) {
  const entries = await Promise.all(COLLECTIONS.map(async (collectionName) => [
    collectionName,
    await readBackupCollection(backupDir, collectionName),
  ]));
  return Object.fromEntries(entries);
}

async function loadServiceAccount() {
  const serviceAccount = JSON.parse(await readFile(SERVICE_ACCOUNT_PATH, "utf8"));
  if (serviceAccount.project_id !== EXPECTED_PROJECT_ID) {
    throw new Error(`Projet service account invalide: attendu ${EXPECTED_PROJECT_ID}, recu ${serviceAccount.project_id || "<absent>"}.`);
  }
  return serviceAccount;
}

async function loadFirestoreDb(projectId) {
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  const serviceAccount = emulatorHost
    ? { project_id: projectId || EXPECTED_PROJECT_ID }
    : await loadServiceAccount();
  const app = getApps().length
    ? getApps()[0]
    : initializeApp(emulatorHost
      ? { projectId: serviceAccount.project_id }
      : { credential: cert(serviceAccount), projectId: serviceAccount.project_id });

  return {
    db: getFirestore(app),
    projectId: serviceAccount.project_id,
    source: emulatorHost ? `emulator:${emulatorHost}` : `firestore:${serviceAccount.project_id}`,
  };
}

async function loadCollection(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((document) => ({ id: document.id, ...document.data() }));
}

async function loadLiveState(db) {
  const entries = await Promise.all(COLLECTIONS.map(async (collectionName) => [
    collectionName,
    await loadCollection(db, collectionName),
  ]));
  return Object.fromEntries(entries);
}

export function buildWritePlan(report) {
  const safeGroups = report.duplicateGroups.filter((group) => group.safeToMerge);
  const transactionUpdates = safeGroups.flatMap((group) =>
    group.duplicateIds.flatMap((duplicateId) =>
      (group.linkedTransactionsByFixedExpenseId[duplicateId] || []).map((transactionId) => ({
        transactionId,
        fromFixedExpenseId: duplicateId,
        toFixedExpenseId: group.canonicalId,
      }))
    )
  );
  const fixedExpenseDeletes = safeGroups.flatMap((group) => group.duplicateIds);

  return {
    transactionUpdates,
    fixedExpenseDeletes,
    writeCount: transactionUpdates.length + fixedExpenseDeletes.length,
  };
}

function assertReportCanApply(report, plan) {
  if (report.verdict !== "DRY_RUN_OK") {
    throw new Error(`Fusion refusee par garde-fous: ${report.errors.join(" | ")}`);
  }
  if (plan.writeCount === 0) {
    throw new Error("Fusion refusee: aucun doublon compatible a fusionner.");
  }
  if (plan.writeCount > 500) {
    throw new Error(`Fusion refusee: ${plan.writeCount} ecritures depassent la limite atomique de 500.`);
  }
  const duplicateIds = new Set(plan.fixedExpenseDeletes);
  const canonicalIds = new Set(report.duplicateGroups.map((group) => group.canonicalId));
  for (const fixedExpenseId of duplicateIds) {
    if (canonicalIds.has(fixedExpenseId)) {
      throw new Error(`Fusion refusee: tentative de suppression du canonique ${fixedExpenseId}.`);
    }
  }
}

export async function runFixedExpenseDuplicateMergeWithDb({ db, projectId, apply = false, year = new Date().getFullYear(), source = "firestore" }) {
  if (projectId !== EXPECTED_PROJECT_ID) {
    throw new Error(`--project doit etre exactement ${EXPECTED_PROJECT_ID}. Recu: ${projectId || "<absent>"}.`);
  }

  const startedAt = Date.now();
  const state = await loadLiveState(db);
  const report = buildFixedExpenseDuplicateMergeReport({ ...state, source, year });
  const plan = buildWritePlan(report);

  report.mode = apply ? "apply" : "dry-run";
  report.writePlan = plan;
  report.during = {
    applyRequested: apply,
    writesPerformed: 0,
    deletedFixedExpenseIds: [],
    reassignedTransactionIds: [],
  };

  if (!apply) {
    report.durationMs = Date.now() - startedAt;
    return report;
  }

  assertReportCanApply(report, plan);
  assertAuthorizedPreApplyReport(report, plan);

  const batch = db.batch();
  for (const update of plan.transactionUpdates) {
    batch.update(db.collection("transactions").doc(update.transactionId), {
      fixedExpenseId: update.toFixedExpenseId,
      updatedAt: new Date(),
    });
  }
  for (const fixedExpenseId of plan.fixedExpenseDeletes) {
    batch.delete(db.collection("fixedExpenses").doc(fixedExpenseId));
  }
  await batch.commit();

  const afterState = await loadLiveState(db);
  const afterReport = buildFixedExpenseDuplicateMergeReport({ ...afterState, source: `${source}:after`, year });
  assertAuthorizedPostApplyState({ beforeState: state, afterState, afterReport, plan });
  report.after = afterReport.after;
  report.comparison.afterActualDuplicateGroups = afterReport.duplicateGroups;
  report.during.writesPerformed = plan.writeCount;
  report.during.deletedFixedExpenseIds = plan.fixedExpenseDeletes;
  report.during.reassignedTransactionIds = plan.transactionUpdates.map((update) => update.transactionId);
  report.durationMs = Date.now() - startedAt;
  report.verdict = afterReport.duplicateGroups.length === 0 && afterReport.orphanTransactions.length === 0
    ? "MERGE_APPLIED_OK"
    : "MERGE_APPLIED_WITH_REMAINING_ANOMALIES";

  if (report.verdict !== "MERGE_APPLIED_OK") {
    throw new Error("Verification apres fusion refusee: doublons ou transactions orphelines restantes.");
  }

  return report;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.apply && options.backupDir) {
    throw new Error("Le mode apply ne peut pas utiliser un backup local.");
  }
  if (options.apply && options.projectId !== EXPECTED_PROJECT_ID) {
    throw new Error(`Le mode apply exige --project ${EXPECTED_PROJECT_ID} et ${APPLY_FLAG}.`);
  }

  const startedAt = Date.now();
  let report;
  if (options.backupDir) {
    const state = await loadFromBackup(options.backupDir);
    report = buildFixedExpenseDuplicateMergeReport({
      ...state,
      source: `backup:${options.backupDir}`,
      year: options.year,
    });
    report.writePlan = buildWritePlan(report);
    report.durationMs = Date.now() - startedAt;
  } else {
    const { db, projectId, source } = await loadFirestoreDb(options.projectId || EXPECTED_PROJECT_ID);
    report = await runFixedExpenseDuplicateMergeWithDb({
      db,
      projectId,
      apply: options.apply,
      year: options.year,
      source,
    });
  }

  const reportPath = buildReportPath(options, options.apply ? "fixed-expenses-merge-apply" : "fixed-expenses-merge-dry-run");
  await writeReport(reportPath, report);
  console.log(`Report: ${reportPath}`);
  console.log(JSON.stringify(report, null, 2));

  if (report.verdict && report.verdict.includes("REFUSED")) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error("Fixed expense duplicate merge failed:");
    console.error(error?.message || String(error));
    process.exitCode = 1;
  });
}
