import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";

const AUTHORIZED_FIXED_EXPENSE_DELETE_IDS = [
  "3pTtB9XjCQzBBXd12VPI",
  "AxaZ1YTImrIRT4qQXtlL",
  "I6kHEijqJDCFcjQCEjWz",
  "OLEn0ZuMLensdL7Zpr4H",
];
const AUTHORIZED_CANONICAL_FIXED_EXPENSE_IDS = [
  "xgnGCIIo4tqtRYZFuQRD",
  "Lwf4ibPfj7ckq1a5a7Or",
];

function parseArgs(argv) {
  const options = {};
  for (const arg of argv) {
    const [key, ...rest] = arg.split("=");
    const value = rest.join("=");
    if (key === "--before") options.before = resolve(process.cwd(), value);
    if (key === "--after") options.after = resolve(process.cwd(), value);
    if (key === "--apply-report") options.applyReport = resolve(process.cwd(), value);
    if (key === "--pre-report") options.preReport = resolve(process.cwd(), value);
    if (key === "--post-report") options.postReport = resolve(process.cwd(), value);
    if (key === "--output") options.output = resolve(process.cwd(), value);
  }
  for (const key of ["before", "after", "applyReport", "preReport", "postReport", "output"]) {
    if (!options[key]) throw new Error(`Argument manquant: --${key}`);
  }
  return options;
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function readCollection(root, collectionName) {
  const payload = await readJson(join(root, "collections", `${collectionName}.json`));
  return new Map((payload.documents || []).map((document) => [document.id, document]));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function forecastSlice(report, key) {
  return report[key].forecast
    .filter((month) => month.month >= "2026-07" && month.month <= "2026-12")
    .map((month) => ({
      month: month.month,
      expectedFixedExpenses: Math.round(month.expectedFixedExpenses * 100) / 100,
    }));
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const beforeManifest = await readJson(join(options.before, "manifest.json"));
  const afterManifest = await readJson(join(options.after, "manifest.json"));
  const preReport = await readJson(options.preReport);
  const applyReport = await readJson(options.applyReport);
  const postReport = await readJson(options.postReport);
  const allCollections = [...new Set([
    ...beforeManifest.collectionsExported,
    ...afterManifest.collectionsExported,
  ])].sort();

  const comparison = {};
  for (const collectionName of allCollections) {
    const beforeDocs = await readCollection(options.before, collectionName);
    const afterDocs = await readCollection(options.after, collectionName);
    const added = [...afterDocs.keys()].filter((id) => !beforeDocs.has(id)).sort();
    const removed = [...beforeDocs.keys()].filter((id) => !afterDocs.has(id)).sort();
    const changed = [...beforeDocs.entries()]
      .filter(([id, document]) => afterDocs.has(id) && stableJson(document.data) !== stableJson(afterDocs.get(id).data))
      .map(([id]) => id)
      .sort();
    comparison[collectionName] = {
      beforeCount: beforeDocs.size,
      afterCount: afterDocs.size,
      added,
      removed,
      changed,
    };
  }

  const unauthorizedCollections = Object.entries(comparison)
    .filter(([collectionName, diff]) => collectionName !== "fixedExpenses" && (
      diff.added.length > 0 || diff.removed.length > 0 || diff.changed.length > 0
    ))
    .map(([collectionName]) => collectionName);
  const fixedExpenseDiff = comparison.fixedExpenses;
  const fixedExpenseDiffAuthorized =
    fixedExpenseDiff.added.length === 0 &&
    fixedExpenseDiff.changed.length === 0 &&
    JSON.stringify(fixedExpenseDiff.removed) === JSON.stringify([...AUTHORIZED_FIXED_EXPENSE_DELETE_IDS].sort());

  const report = {
    projectId: "budget-alexandre",
    generatedAt: new Date().toISOString(),
    backupBefore: {
      path: options.before,
      totalDocuments: beforeManifest.totalDocuments,
      fixedExpenses: beforeManifest.documentsPerCollection.fixedExpenses.rootDocumentCount,
      transactions: beforeManifest.documentsPerCollection.transactions.rootDocumentCount,
    },
    canonicalFixedExpenseIds: AUTHORIZED_CANONICAL_FIXED_EXPENSE_IDS,
    authorizedDeleteIds: AUTHORIZED_FIXED_EXPENSE_DELETE_IDS,
    checksBefore: {
      fixedExpenseCount: preReport.fixedExpenseCountBefore,
      transactionCount: preReport.transactionCount,
      fixedExpenseIdsUsed: preReport.fixedExpenseIdsUsed.length,
      orphanTransactions: preReport.orphanTransactions.length,
      duplicateGroups: preReport.duplicateGroups.length,
      destructiveList: preReport.writePlan.fixedExpenseDeletes,
      verdict: preReport.verdict,
    },
    deletedFixedExpenseIds: applyReport.during.deletedFixedExpenseIds,
    writesPerformed: applyReport.during.writesPerformed,
    checksAfter: {
      fixedExpenseCount: postReport.fixedExpenseCountBefore,
      transactionCount: postReport.transactionCount,
      fixedExpenseIdsUsed: postReport.fixedExpenseIdsUsed.length,
      orphanTransactions: postReport.orphanTransactions.length,
      duplicateGroups: postReport.duplicateGroups.length,
      verdict: postReport.verdict,
    },
    forecastBefore: forecastSlice(preReport, "before"),
    forecastAfter: forecastSlice(postReport, "before"),
    backupAfter: {
      path: options.after,
      totalDocuments: afterManifest.totalDocuments,
      fixedExpenses: afterManifest.documentsPerCollection.fixedExpenses.rootDocumentCount,
      transactions: afterManifest.documentsPerCollection.transactions.rootDocumentCount,
    },
    comparison: {
      totalDocumentsDelta: afterManifest.totalDocuments - beforeManifest.totalDocuments,
      collections: comparison,
      unauthorizedCollections,
      fixedExpenseDiffAuthorized,
    },
    verdict: unauthorizedCollections.length === 0 && fixedExpenseDiffAuthorized
      ? "FUSION DES FRAIS FIXES VALIDEE - 4 DOUBLONS SUPPRIMES, 11 FICHES CONSERVEES"
      : "FUSION ANNULEE - GARDE-FOU DECLENCHE",
  };

  await mkdir(dirname(options.output), { recursive: true });
  await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Report: ${options.output}`);
  console.log(JSON.stringify(report, null, 2));
  if (!fixedExpenseDiffAuthorized || unauthorizedCollections.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("COMPARE_FIXED_EXPENSE_MERGE_BACKUPS_FAILED");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
