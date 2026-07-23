import process from "node:process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const EXPECTED_PROJECT_ID = "budget-alexandre";
export const APPLY_FLAG = "--apply-confirmed-cleanup-15-accounts";
export const CURRENT_ACCOUNT_ID = "0avb84dmhKodiC7OxZ5p";
export const BUSINESS_FIELDS = ["name", "type", "icon", "color", "initialBalance", "isActive", "displayOrder"];

export const CANONICAL_ACCOUNTS = Object.freeze({
  "Compte courant": "0avb84dmhKodiC7OxZ5p",
  "Espèces": "WDhjgHcNqiCkSPQz9U5S",
  PayPal: "WeNZaVlY4BCsudxSSxhP",
  "Compte professionnel": "Rk8aRhNrov5Yc4hW7ndu",
  "Livret A": "g7fftTkK60S66pTnBHaq",
});

export const CLEANUP_CANDIDATES = Object.freeze([
  { group: "Compte courant", canonicalId: CANONICAL_ACCOUNTS["Compte courant"], id: "NkXb45Fc6xg6J9lk9VRK" },
  { group: "Compte courant", canonicalId: CANONICAL_ACCOUNTS["Compte courant"], id: "FXJIDQejNMS8wwqvFuGh" },
  { group: "Compte courant", canonicalId: CANONICAL_ACCOUNTS["Compte courant"], id: "1axzCNIWfv0hCOUJlkIf" },
  { group: "Compte professionnel", canonicalId: CANONICAL_ACCOUNTS["Compte professionnel"], id: "qpnKgI6CmcUzdeoyxCkG" },
  { group: "Compte professionnel", canonicalId: CANONICAL_ACCOUNTS["Compte professionnel"], id: "Nng3U5DMBAL4YiyOA05m" },
  { group: "Compte professionnel", canonicalId: CANONICAL_ACCOUNTS["Compte professionnel"], id: "FtnqQ0b2uZi2WvXxTXEq" },
  { group: "Espèces", canonicalId: CANONICAL_ACCOUNTS["Espèces"], id: "1WFggMcWy2Ew7qBt7eZH" },
  { group: "Espèces", canonicalId: CANONICAL_ACCOUNTS["Espèces"], id: "kXi7qITstdXWo938XUfN" },
  { group: "Espèces", canonicalId: CANONICAL_ACCOUNTS["Espèces"], id: "V4AJ0DXmQymoBfQB8jTO" },
  { group: "Livret A", canonicalId: CANONICAL_ACCOUNTS["Livret A"], id: "fLS1C64hUHJ0few9WB6j" },
  { group: "Livret A", canonicalId: CANONICAL_ACCOUNTS["Livret A"], id: "dZoRK7jMlRZtSfZOa4D3" },
  { group: "Livret A", canonicalId: CANONICAL_ACCOUNTS["Livret A"], id: "Rmh7sHaxl3u0bMlQjKe0" },
  { group: "PayPal", canonicalId: CANONICAL_ACCOUNTS.PayPal, id: "DZwutxIuhRFtmgQ3fXnL" },
  { group: "PayPal", canonicalId: CANONICAL_ACCOUNTS.PayPal, id: "of5ikhyMqhgO4sYkOxFf" },
  { group: "PayPal", canonicalId: CANONICAL_ACCOUNTS.PayPal, id: "Gwz0QBEkpiNRMhbA5MbY" },
]);

const EXPECTED_ACCOUNTS_BEFORE = 20;
const EXPECTED_ACCOUNTS_AFTER = 5;
const EXPECTED_TRANSACTIONS = 96;
const EXPECTED_GROUPS_BEFORE = 5;
const EXPECTED_GROUP_SIZE_BEFORE = 4;
const EXPECTED_CANDIDATES = 15;
const REPORT_ROOT = resolve(process.cwd(), "artifacts/maintenance");
const SERVICE_ACCOUNT_PATH = resolve(process.cwd(), "scripts/maintenance/service-account.json");
const CANDIDATE_IDS = new Set(CLEANUP_CANDIDATES.map((candidate) => candidate.id));
const CANONICAL_IDS = new Set(Object.values(CANONICAL_ACCOUNTS));

function timestampForPath(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}_${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}-${pad(date.getUTCSeconds())}`;
}

function normalizeName(value) {
  return String(value || "").trim().toLocaleLowerCase("fr-FR");
}

function parseArgs(argv) {
  const options = {
    apply: false,
    backupDir: null,
    projectId: null,
    reportPath: null,
    reportTag: "manual",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === APPLY_FLAG) {
      options.apply = true;
      continue;
    }
    if (arg === "--dry-run") {
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

    throw new Error(`Unknown or forbidden argument: ${arg}`);
  }

  return options;
}

function toComparableTimestamp(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.iso === "string") {
    const parsed = Date.parse(value.iso);
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  }
  if (typeof value?.seconds === "number") {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1_000_000);
  }
  return Number.POSITIVE_INFINITY;
}

function compareCanonicalOrder(left, right) {
  const createdDelta = toComparableTimestamp(left.createdAt) - toComparableTimestamp(right.createdAt);
  if (createdDelta !== 0) return createdDelta;
  return String(left.id || "").localeCompare(String(right.id || ""));
}

function groupAccountsByName(accounts) {
  const groups = new Map();
  for (const account of accounts) {
    const key = normalizeName(account.name);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(account);
  }
  return groups;
}

function buildReferenceCounts(transactions) {
  const counts = new Map();
  for (const transaction of transactions) {
    const accountId = transaction.accountId ?? null;
    counts.set(accountId, (counts.get(accountId) || 0) + 1);
  }
  return counts;
}

function asSortedObject(map) {
  return Object.fromEntries([...map.entries()].sort(([left], [right]) => String(left).localeCompare(String(right))));
}

function hasUnexpectedStatus(account) {
  return account?.isActive !== true
    || Boolean(account?.deletedAt)
    || Boolean(account?.deletedReason)
    || Boolean(account?.archivedAt)
    || Boolean(account?.archived)
    || (account?.status !== undefined && account.status !== "active");
}

function compareBusinessFields(left, right) {
  const differences = [];
  for (const field of BUSINESS_FIELDS) {
    if (JSON.stringify(left?.[field] ?? null) !== JSON.stringify(right?.[field] ?? null)) {
      differences.push({ field, canonical: left?.[field] ?? null, candidate: right?.[field] ?? null });
    }
  }
  return differences;
}

function selectCanonicalAccount(groupAccounts) {
  const forced = groupAccounts.find((account) => account.id === CURRENT_ACCOUNT_ID);
  if (forced) {
    return { account: forced, rule: `forced current-account canonical ${CURRENT_ACCOUNT_ID}` };
  }
  return { account: [...groupAccounts].sort(compareCanonicalOrder)[0], rule: "oldest createdAt, then Firestore ID ascending" };
}

export function buildDuplicateAccountsDryRunReport({ accounts, transactions, source = "unknown", generatedAtUtc = new Date().toISOString() }) {
  const preflight = validateBeforeCleanup({ accounts, transactions });
  const groups = preflight.groups.map((group) => ({
    key: normalizeName(group.name),
    name: group.name,
    documentCount: group.documentCount,
    canonicalId: group.canonicalId,
    canonicalReferences: group.canonicalReferences,
    canonicalSelectionRule: group.canonicalSelectionRule,
    businessPropertiesCompared: BUSINESS_FIELDS,
    businessDifferences: group.businessDifferences,
    unexpectedStatusIds: group.unexpectedStatusIds,
    candidates: group.candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.name,
      references: candidate.references,
      businessPropertiesCompared: BUSINESS_FIELDS,
      safeToDelete: candidate.safeToDelete,
    })),
  }));

  return {
    mode: "dry-run",
    source,
    generatedAtUtc,
    accountsTotal: accounts.length,
    uniqueAccountIds: new Set(accounts.map((account) => account.id)).size,
    transactionsTotal: transactions.length,
    referenceCountsByAccountId: asSortedObject(buildReferenceCounts(transactions)),
    unknownReferences: preflight.unknownReferences,
    groups,
    safeCandidatesCount: preflight.safeCandidatesCount,
    unsafeCandidatesCount: preflight.unsafeCandidatesCount,
    writesPerformed: 0,
    errors: preflight.errors,
    verdict: preflight.errors.length === 0 ? "DRY-RUN VALIDE" : "DRY-RUN REFUSE",
  };
}

export function validateBeforeCleanup({ accounts, transactions, deletionCandidates = CLEANUP_CANDIDATES }) {
  const errors = [];
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const referenceCounts = buildReferenceCounts(transactions);
  const groupsByName = groupAccountsByName(accounts);
  const unknownReferences = [];
  const groups = [];
  let safeCandidatesCount = 0;
  let unsafeCandidatesCount = 0;

  for (const [accountId, references] of referenceCounts.entries()) {
    if (!accountId || !accountsById.has(accountId)) {
      unknownReferences.push({ accountId, references });
    }
  }

  if (accounts.length !== EXPECTED_ACCOUNTS_BEFORE) errors.push(`accounts total must be ${EXPECTED_ACCOUNTS_BEFORE}, got ${accounts.length}.`);
  if (new Set(accounts.map((account) => account.id)).size !== EXPECTED_ACCOUNTS_BEFORE) errors.push("account IDs must be exactly 20 unique IDs.");
  if (transactions.length !== EXPECTED_TRANSACTIONS) errors.push(`transactions total must be ${EXPECTED_TRANSACTIONS}, got ${transactions.length}.`);
  if (groupsByName.size !== EXPECTED_GROUPS_BEFORE) errors.push(`account groups total must be ${EXPECTED_GROUPS_BEFORE}, got ${groupsByName.size}.`);
  if (unknownReferences.length > 0) errors.push("transactions contain unknown accountId references.");
  if ((referenceCounts.get(CURRENT_ACCOUNT_ID) || 0) !== EXPECTED_TRANSACTIONS) {
    errors.push(`current account ${CURRENT_ACCOUNT_ID} must have ${EXPECTED_TRANSACTIONS} references.`);
  }
  for (const [accountId, references] of referenceCounts.entries()) {
    if (accountId !== CURRENT_ACCOUNT_ID && references > 0) {
      errors.push(`account ${accountId} has ${references} unexpected transaction reference(s).`);
    }
  }

  for (const [name, canonicalId] of Object.entries(CANONICAL_ACCOUNTS)) {
    const canonical = accountsById.get(canonicalId);
    if (!canonical) {
      errors.push(`canonical account missing: ${name} / ${canonicalId}.`);
    } else if (hasUnexpectedStatus(canonical)) {
      errors.push(`canonical account has unexpected status: ${canonicalId}.`);
    }
  }

  for (const [key, groupAccounts] of [...groupsByName.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const sorted = [...groupAccounts].sort(compareCanonicalOrder);
    const selection = selectCanonicalAccount(sorted);
    const canonical = selection.account;
    const expectedCanonicalId = CANONICAL_ACCOUNTS[canonical?.name];
    const businessDifferences = [];
    const unexpectedStatusIds = sorted.filter(hasUnexpectedStatus).map((account) => account.id);

    if (sorted.length !== EXPECTED_GROUP_SIZE_BEFORE) {
      errors.push(`group ${canonical?.name || key} must contain ${EXPECTED_GROUP_SIZE_BEFORE} accounts, got ${sorted.length}.`);
    }
    if (!expectedCanonicalId || canonical.id !== expectedCanonicalId) {
      errors.push(`group ${canonical?.name || key} canonical mismatch: expected ${expectedCanonicalId || "<known canonical>"}, got ${canonical?.id || "<missing>"}.`);
    }

    const candidates = sorted.filter((account) => account.id !== canonical.id).map((account) => {
      const whitelistEntry = deletionCandidates.find((candidate) => candidate.id === account.id);
      const references = referenceCounts.get(account.id) || 0;
      const candidateDifferences = compareBusinessFields(canonical, account);
      if (candidateDifferences.length > 0) {
        businessDifferences.push({ id: account.id, differences: candidateDifferences });
      }
      const safeToDelete = Boolean(whitelistEntry)
        && whitelistEntry.group === canonical.name
        && whitelistEntry.canonicalId === canonical.id
        && !CANONICAL_IDS.has(account.id)
        && references === 0
        && candidateDifferences.length === 0
        && !hasUnexpectedStatus(account)
        && sorted.length === EXPECTED_GROUP_SIZE_BEFORE;

      if (safeToDelete) safeCandidatesCount += 1;
      else unsafeCandidatesCount += 1;

      return {
        id: account.id,
        name: account.name,
        group: canonical.name,
        canonicalId: canonical.id,
        references,
        businessDifferences: candidateDifferences,
        safeToDelete,
      };
    });

    groups.push({
      name: canonical?.name || sorted[0]?.name || key,
      documentCount: sorted.length,
      canonicalId: canonical?.id || null,
      canonicalReferences: referenceCounts.get(canonical?.id) || 0,
      canonicalSelectionRule: selection.rule,
      businessDifferences,
      unexpectedStatusIds,
      candidates,
    });

    if (businessDifferences.length > 0) errors.push(`group ${canonical?.name || key} has business property differences.`);
    if (unexpectedStatusIds.length > 0) errors.push(`group ${canonical?.name || key} contains inactive, archived, deleted, or unexpected-status account(s).`);
  }

  for (const candidate of deletionCandidates) {
    const account = accountsById.get(candidate.id);
    if (!CANDIDATE_IDS.has(candidate.id)) errors.push(`candidate ${candidate.id} is outside the whitelist constant.`);
    if (CANONICAL_IDS.has(candidate.id)) errors.push(`candidate ${candidate.id} is a canonical account.`);
    if (!account) errors.push(`candidate account missing: ${candidate.id}.`);
    if (account && hasUnexpectedStatus(account)) errors.push(`candidate account has unexpected status: ${candidate.id}.`);
    if ((referenceCounts.get(candidate.id) || 0) > 0) errors.push(`candidate ${candidate.id} is referenced by ${referenceCounts.get(candidate.id)} transaction(s).`);
  }

  if (deletionCandidates.length !== EXPECTED_CANDIDATES) errors.push(`deletion candidate list must contain ${EXPECTED_CANDIDATES} IDs.`);
  if (new Set(deletionCandidates.map((candidate) => candidate.id)).size !== EXPECTED_CANDIDATES) errors.push("deletion candidate list must contain 15 unique IDs.");
  if (safeCandidatesCount !== EXPECTED_CANDIDATES) errors.push(`safe candidate count must be ${EXPECTED_CANDIDATES}, got ${safeCandidatesCount}.`);

  return {
    ok: errors.length === 0,
    errors,
    unknownReferences,
    groups,
    safeCandidatesCount,
    unsafeCandidatesCount,
    referenceCountsByAccountId: asSortedObject(referenceCounts),
  };
}

export function validateAfterCleanup({ accounts, transactions, beforeCanonicalAccounts = null, beforeTransactions = null }) {
  const errors = [];
  const accountIds = accounts.map((account) => account.id).sort();
  const expectedCanonicalIds = [...CANONICAL_IDS].sort();
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const referenceCounts = buildReferenceCounts(transactions);
  const groupsByName = groupAccountsByName(accounts);
  const unknownReferences = [];

  for (const [accountId, references] of referenceCounts.entries()) {
    if (!accountId || !accountsById.has(accountId)) unknownReferences.push({ accountId, references });
  }

  if (accounts.length !== EXPECTED_ACCOUNTS_AFTER) errors.push(`accounts total after cleanup must be ${EXPECTED_ACCOUNTS_AFTER}, got ${accounts.length}.`);
  if (JSON.stringify(accountIds) !== JSON.stringify(expectedCanonicalIds)) errors.push("remaining account IDs do not match the five canonical IDs.");
  if (transactions.length !== EXPECTED_TRANSACTIONS) errors.push(`transactions total after cleanup must be ${EXPECTED_TRANSACTIONS}, got ${transactions.length}.`);
  if ((referenceCounts.get(CURRENT_ACCOUNT_ID) || 0) !== EXPECTED_TRANSACTIONS) errors.push(`current account must still have ${EXPECTED_TRANSACTIONS} references.`);
  if (unknownReferences.length > 0) errors.push("transactions contain unknown accountId references after cleanup.");
  if (groupsByName.size !== EXPECTED_ACCOUNTS_AFTER) errors.push("canonical account names must each appear exactly once.");

  if (beforeCanonicalAccounts) {
    for (const id of expectedCanonicalIds) {
      if (JSON.stringify(beforeCanonicalAccounts.get(id) || null) !== JSON.stringify(accountsById.get(id) || null)) {
        errors.push(`canonical account changed: ${id}.`);
      }
    }
  }

  if (beforeTransactions) {
    const afterTransactions = new Map(transactions.map((transaction) => [transaction.id, transaction]));
    for (const [id, beforeTransaction] of beforeTransactions.entries()) {
      if (JSON.stringify(beforeTransaction) !== JSON.stringify(afterTransactions.get(id) || null)) {
        errors.push(`transaction changed: ${id}.`);
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    accountIds,
    transactionsTotal: transactions.length,
    referenceCountsByAccountId: asSortedObject(referenceCounts),
    unknownReferences,
  };
}

async function readBackupCollection(backupDir, collectionName) {
  const collectionPath = join(backupDir, "collections", `${collectionName}.json`);
  const parsed = JSON.parse(await readFile(collectionPath, "utf8"));
  return parsed.documents.map((document) => ({ id: document.id, createTime: document.createTime, updateTime: document.updateTime, ...document.data }));
}

async function loadFromBackup(backupDir) {
  return {
    source: `backup:${backupDir}`,
    accounts: await readBackupCollection(backupDir, "accounts"),
    transactions: await readBackupCollection(backupDir, "transactions"),
  };
}

async function loadServiceAccount() {
  const serviceAccount = JSON.parse(await readFile(SERVICE_ACCOUNT_PATH, "utf8"));
  if (serviceAccount.project_id !== EXPECTED_PROJECT_ID) {
    throw new Error(`service account project mismatch: expected ${EXPECTED_PROJECT_ID}, got ${serviceAccount.project_id || "<missing>"}.`);
  }
  return serviceAccount;
}

async function loadFirestoreDb(projectId) {
  const serviceAccount = process.env.FIRESTORE_EMULATOR_HOST
    ? { project_id: projectId || EXPECTED_PROJECT_ID }
    : await loadServiceAccount();

  const app = getApps().length
    ? getApps()[0]
    : initializeApp(process.env.FIRESTORE_EMULATOR_HOST
      ? { projectId: serviceAccount.project_id }
      : { credential: cert(serviceAccount), projectId: serviceAccount.project_id });

  return {
    db: getFirestore(app),
    projectId: serviceAccount.project_id,
  };
}

async function loadLiveState(db) {
  const [accountsSnapshot, transactionsSnapshot] = await Promise.all([
    db.collection("accounts").get(),
    db.collection("transactions").get(),
  ]);

  return {
    accounts: accountsSnapshot.docs.map((document) => ({ id: document.id, ...document.data() })),
    transactions: transactionsSnapshot.docs.map((document) => ({ id: document.id, ...document.data() })),
  };
}

export async function runCleanupWithDb({ db, projectId, apply = false, source = "firestore" }) {
  if (projectId !== EXPECTED_PROJECT_ID) {
    throw new Error(`--project must be exactly ${EXPECTED_PROJECT_ID}. Received ${projectId || "<missing>"}.`);
  }

  const before = await loadLiveState(db);
  const beforeCanonicalAccounts = new Map(before.accounts.filter((account) => CANONICAL_IDS.has(account.id)).map((account) => [account.id, account]));
  const beforeTransactions = new Map(before.transactions.map((transaction) => [transaction.id, transaction]));
  const beforeControls = validateBeforeCleanup(before);
  const report = {
    projectId,
    mode: apply ? "apply" : "dry-run",
    source,
    generatedAtUtc: new Date().toISOString(),
    canonicalAccounts: CANONICAL_ACCOUNTS,
    deletionWhitelist: CLEANUP_CANDIDATES,
    beforeControls,
    deletedIds: [],
    writesPerformed: 0,
    afterControls: null,
    verdict: beforeControls.ok ? "PRECHECK_OK" : "CLEANUP_REFUSED",
  };

  if (!beforeControls.ok) {
    report.verdict = "NETTOYAGE ANNULE - GARDE-FOU DECLENCHE";
    return report;
  }

  if (!apply) {
    report.verdict = "DRY-RUN VALIDATED - NO WRITES";
    return report;
  }

  const batch = db.batch();
  for (const candidate of CLEANUP_CANDIDATES) {
    if (!CANDIDATE_IDS.has(candidate.id) || CANONICAL_IDS.has(candidate.id)) {
      throw new Error(`refusing to add unauthorized account to delete batch: ${candidate.id}.`);
    }
    batch.delete(db.collection("accounts").doc(candidate.id));
  }
  await batch.commit();

  report.deletedIds = CLEANUP_CANDIDATES.map((candidate) => candidate.id);
  report.writesPerformed = CLEANUP_CANDIDATES.length;

  const after = await loadLiveState(db);
  report.afterControls = validateAfterCleanup({
    ...after,
    beforeCanonicalAccounts,
    beforeTransactions,
  });
  report.verdict = report.afterControls.ok
    ? "NETTOYAGE VALIDE - 15 DOUBLONS SUPPRIMES, 5 COMPTES CONSERVES"
    : "NETTOYAGE ANNULE - GARDE-FOU DECLENCHE";

  if (!report.afterControls.ok) {
    throw new Error(`post-cleanup verification failed: ${report.afterControls.errors.join(" | ")}`);
  }

  return report;
}

function buildReportPath(options, prefix) {
  return options.reportPath || resolve(REPORT_ROOT, `${prefix}-${options.reportTag}-${timestampForPath()}.json`);
}

async function writeReport(reportPath, report) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function printCleanupPlan(preflight) {
  console.log("Deletion batch candidates:");
  for (const candidate of CLEANUP_CANDIDATES) {
    const group = preflight.groups.find((entry) => entry.name === candidate.group);
    const candidateDetail = group?.candidates.find((entry) => entry.id === candidate.id);
    console.log(`- ${candidate.group}: ${candidate.id} references=${candidateDetail?.references ?? "n/a"} canonical=${candidate.canonicalId}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.apply && options.backupDir) {
    throw new Error("Apply mode cannot run against a backup directory.");
  }

  if (options.apply && options.projectId !== EXPECTED_PROJECT_ID) {
    throw new Error(`Apply mode requires --project ${EXPECTED_PROJECT_ID}.`);
  }

  if (options.backupDir) {
    const loaded = await loadFromBackup(options.backupDir);
    const report = buildDuplicateAccountsDryRunReport(loaded);
    const reportPath = buildReportPath(options, "cleanup-duplicate-accounts-dry-run");
    await writeReport(reportPath, report);
    console.log(JSON.stringify(report, null, 2));
    if (report.errors.length > 0) process.exitCode = 1;
    return;
  }

  const { db, projectId } = await loadFirestoreDb(options.projectId || EXPECTED_PROJECT_ID);
  const report = await runCleanupWithDb({
    db,
    projectId,
    apply: options.apply,
    source: process.env.FIRESTORE_EMULATOR_HOST ? `emulator:${process.env.FIRESTORE_EMULATOR_HOST}` : `firestore:${projectId}`,
  });
  const reportPath = buildReportPath(options, options.apply ? "cleanup-duplicate-accounts-apply" : "cleanup-duplicate-accounts-dry-run");

  await writeReport(reportPath, report);
  printCleanupPlan(report.beforeControls);
  console.log(`Report: ${reportPath}`);
  console.log(JSON.stringify(report, null, 2));

  if (report.verdict.includes("ANNULE") || report.verdict.includes("REFUSED")) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error("Duplicate account cleanup failed:");
    console.error(error?.message || String(error));
    process.exitCode = 1;
  });
}
