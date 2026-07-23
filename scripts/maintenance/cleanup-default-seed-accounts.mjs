import process from "node:process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { createHash } from "node:crypto";

export const EXPECTED_PROJECT_ID = "budget-alexandre";
export const APPLY_FLAG = "--apply-confirmed-cleanup-5-default-accounts";
export const FORBIDDEN_FLAGS = new Set(["--write", "--force", "--confirm"]);
export const REPORT_ROOT = resolve(process.cwd(), "artifacts/maintenance");
export const SERVICE_ACCOUNT_PATH = resolve(process.cwd(), "scripts/maintenance/service-account.json");

export const CANONICAL_ACCOUNTS = Object.freeze({
  "Compte courant": "0avb84dmhKodiC7OxZ5p",
  "Livret A": "g7fftTkK60S66pTnBHaq",
  "Compte professionnel": "Rk8aRhNrov5Yc4hW7ndu",
  "Espèces": "WDhjgHcNqiCkSPQz9U5S",
  PayPal: "WeNZaVlY4BCsudxSSxhP",
});

export const DEFAULT_SEED_ACCOUNTS = Object.freeze([
  { id: "default-current-account", canonicalName: "Compte courant", canonicalId: CANONICAL_ACCOUNTS["Compte courant"] },
  { id: "default-savings-a", canonicalName: "Livret A", canonicalId: CANONICAL_ACCOUNTS["Livret A"] },
  { id: "default-professional-account", canonicalName: "Compte professionnel", canonicalId: CANONICAL_ACCOUNTS["Compte professionnel"] },
  { id: "default-cash", canonicalName: "Espèces", canonicalId: CANONICAL_ACCOUNTS["Espèces"] },
  { id: "default-paypal", canonicalName: "PayPal", canonicalId: CANONICAL_ACCOUNTS.PayPal },
]);

const BUSINESS_FIELDS = ["name", "type", "icon", "color", "initialBalance", "displayOrder", "isActive"];
const ACCOUNT_REFERENCE_FIELD_RE = /(^|\.)(accountId|fromAccountId|toAccountId|sourceAccountId|destinationAccountId|importAccountId|transferSourceAccountId|transferDestinationAccountId)$/;
const CANONICAL_IDS = new Set(Object.values(CANONICAL_ACCOUNTS));
const SEED_IDS = new Set(DEFAULT_SEED_ACCOUNTS.map((account) => account.id));

function timestampForPath(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}_${pad(date.getUTCHours())}-${pad(date.getUTCMinutes())}-${pad(date.getUTCSeconds())}`;
}

function normalizeName(value) {
  return String(value || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLocaleLowerCase("fr-FR");
}

function toNumber(value) {
  return Number(value) || 0;
}

function toTransactionType(value) {
  const normalized = normalizeName(value);
  if (["revenu", "income", "recette"].includes(normalized)) return "revenu";
  if (["depense", "expense"].includes(normalized)) return "depense";
  if (normalized === "adjustment") return "adjustment";
  return normalized || null;
}

function parseArgs(argv) {
  const options = {
    apply: false,
    backupDir: null,
    projectId: null,
    reportPath: null,
    reportTag: "manual",
    databaseId: null,
    expectedAccountCount: null,
    expectedDefaultCount: null,
    confirmProjectId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (FORBIDDEN_FLAGS.has(arg)) throw new Error(`Forbidden generic destructive flag: ${arg}`);
    if (arg === APPLY_FLAG) {
      options.apply = true;
      continue;
    }
    if (arg === "--apply") {
      options.apply = true;
      continue;
    }
    if (arg === "--dry-run") continue;
    if (arg === "--project") {
      options.projectId = argv[index + 1] || null;
      index += 1;
      continue;
    }
    if (arg.startsWith("--project=")) {
      options.projectId = arg.slice("--project=".length);
      continue;
    }
    if (arg.startsWith("--project-id=")) {
      options.projectId = arg.slice("--project-id=".length);
      continue;
    }
    if (arg.startsWith("--database-id=")) {
      options.databaseId = arg.slice("--database-id=".length);
      continue;
    }
    if (arg.startsWith("--backup-path=")) {
      options.backupDir = resolve(process.cwd(), arg.slice("--backup-path=".length));
      continue;
    }
    if (arg.startsWith("--report-dir=")) {
      options.reportPath = resolve(process.cwd(), arg.slice("--report-dir=".length), "duplicate-default-accounts-cleanup.json");
      continue;
    }
    if (arg.startsWith("--expected-account-count=")) {
      options.expectedAccountCount = Number(arg.slice("--expected-account-count=".length));
      continue;
    }
    if (arg.startsWith("--expected-default-count=")) {
      options.expectedDefaultCount = Number(arg.slice("--expected-default-count=".length));
      continue;
    }
    if (arg.startsWith("--confirm-project-id=")) {
      options.confirmProjectId = arg.slice("--confirm-project-id=".length);
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
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function stateFingerprint(state) {
  const documents = Object.values(state.collections || {}).flat()
    .map((document) => ({ path: document.path, data: document.data }))
    .sort((left, right) => left.path.localeCompare(right.path));
  return createHash("sha256").update(JSON.stringify(documents)).digest("hex");
}

function validateCliContract(options, backupState) {
  const errors = [];
  if (!options.projectId) errors.push("--project-id is required.");
  if (options.confirmProjectId !== options.projectId) errors.push("--confirm-project-id must exactly match --project-id.");
  if (!options.databaseId) errors.push("--database-id is required.");
  if (!options.backupDir) errors.push("--backup-path is required.");
  if (!Number.isInteger(options.expectedAccountCount)) errors.push("--expected-account-count is required.");
  if (!Number.isInteger(options.expectedDefaultCount)) errors.push("--expected-default-count is required.");
  if (backupState) {
    const accounts = getAccounts(backupState);
    const defaults = accounts.filter((account) => SEED_IDS.has(account.id));
    if (backupState.projectId !== options.projectId) errors.push("backup projectId does not match --project-id.");
    if (backupState.manifest?.databaseId !== options.databaseId) errors.push("backup databaseId does not match --database-id.");
    if (accounts.length !== options.expectedAccountCount) errors.push(`backup account count differs: expected ${options.expectedAccountCount}, got ${accounts.length}.`);
    if (defaults.length !== options.expectedDefaultCount) errors.push(`backup default count differs: expected ${options.expectedDefaultCount}, got ${defaults.length}.`);
    if (JSON.stringify(defaults.map((account) => account.id).sort()) !== JSON.stringify([...SEED_IDS].sort())) errors.push("backup default ID list differs from the five-ID whitelist.");
  }
  if (errors.length) throw new Error(errors.join(" | "));
}

function serializeFirestoreValue(value) {
  if (value === null || value === undefined) return value ?? null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map((entry) => serializeFirestoreValue(entry));
  if (typeof value?.toDate === "function" && typeof value?.seconds === "number") {
    return { __firestoreType: "timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds || 0, iso: value.toDate().toISOString() };
  }
  if (typeof value?.path === "string" && typeof value?.id === "string") {
    return { __firestoreType: "documentReference", path: value.path, id: value.id };
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, serializeFirestoreValue(nested)]));
  }
  return String(value);
}

function flattenDocumentsFromBackupCollection(collection, output = []) {
  for (const document of collection.documents || []) {
    output.push({
      id: document.id,
      path: document.path,
      collection: collection.path,
      data: document.data || {},
      createTime: document.createTime || null,
      updateTime: document.updateTime || null,
    });
    for (const subcollection of Object.values(document.subcollections || {})) {
      flattenDocumentsFromBackupCollection(subcollection, output);
    }
  }
  return output;
}

async function loadBackupState(backupDir) {
  const manifest = JSON.parse(await readFile(join(backupDir, "manifest.json"), "utf8"));
  const collections = {};
  for (const collectionName of manifest.collectionsExported || []) {
    const parsed = JSON.parse(await readFile(join(backupDir, "collections", `${collectionName}.json`), "utf8"));
    collections[collectionName] = flattenDocumentsFromBackupCollection(parsed);
  }
  return { source: `backup:${backupDir}`, projectId: manifest.projectId, manifest, collections };
}

async function exportCollectionRecursive(collectionRef, collections) {
  const snapshot = await collectionRef.get();
  collections[collectionRef.path] = collections[collectionRef.path] || [];
  for (const document of snapshot.docs) {
    collections[collectionRef.path].push({
      id: document.id,
      path: document.ref.path,
      collection: collectionRef.path,
      data: serializeFirestoreValue(document.data()),
      createTime: serializeFirestoreValue(document.createTime),
      updateTime: serializeFirestoreValue(document.updateTime),
    });
    for (const subcollectionRef of await document.ref.listCollections()) {
      await exportCollectionRecursive(subcollectionRef, collections);
    }
  }
}

async function loadServiceAccount() {
  const serviceAccount = JSON.parse(await readFile(SERVICE_ACCOUNT_PATH, "utf8"));
  if (serviceAccount.project_id !== EXPECTED_PROJECT_ID) {
    throw new Error(`service account project mismatch: expected ${EXPECTED_PROJECT_ID}, got ${serviceAccount.project_id || "<missing>"}.`);
  }
  return serviceAccount;
}

async function loadFirestoreDb(projectId) {
  const serviceAccount = process.env.FIRESTORE_EMULATOR_HOST ? { project_id: projectId || EXPECTED_PROJECT_ID } : await loadServiceAccount();
  const app = getApps().length ? getApps()[0] : initializeApp(
    process.env.FIRESTORE_EMULATOR_HOST
      ? { projectId: serviceAccount.project_id }
      : { credential: cert(serviceAccount), projectId: serviceAccount.project_id }
  );
  return { db: getFirestore(app), projectId: serviceAccount.project_id };
}

async function loadLiveState(db, projectId) {
  const collections = {};
  for (const collectionRef of await db.listCollections()) {
    await exportCollectionRecursive(collectionRef, collections);
  }
  const totalDocuments = Object.values(collections).reduce((sum, docs) => sum + docs.length, 0);
  return {
    source: process.env.FIRESTORE_EMULATOR_HOST ? `emulator:${process.env.FIRESTORE_EMULATOR_HOST}` : `firestore:${projectId}`,
    projectId,
    manifest: {
      projectId,
      rootCollectionsCount: Object.keys(collections).filter((path) => !path.includes("/")).length,
      totalDocuments,
      documentsPerCollection: Object.fromEntries(Object.entries(collections).filter(([path]) => !path.includes("/")).map(([path, docs]) => [path, { rootDocumentCount: docs.length, totalDocumentsIncludingSubcollections: docs.length }])),
      collectionsExported: Object.keys(collections).filter((path) => !path.includes("/")),
    },
    collections,
  };
}

function getRootCollectionName(path) {
  return String(path || "").split("/")[0];
}

function documentsForCollection(state, collectionName) {
  return Object.values(state.collections || {})
    .flat()
    .filter((document) => getRootCollectionName(document.path) === collectionName)
    .map((document) => ({ id: document.id, path: document.path, createTime: document.createTime, updateTime: document.updateTime, ...document.data }));
}

function getAccounts(state) {
  return documentsForCollection(state, "accounts");
}

function getTransactions(state) {
  return documentsForCollection(state, "transactions");
}

function getTransfers(state) {
  return documentsForCollection(state, "transfers");
}

function scanValueForReferences(value, context, matches) {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    if (SEED_IDS.has(value)) matches.push({ ...context, value, matchType: "seed-id" });
    if (value.startsWith("accounts/") && SEED_IDS.has(value.slice("accounts/".length))) {
      matches.push({ ...context, value, matchType: "account-document-path" });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => scanValueForReferences(entry, { ...context, fieldPath: `${context.fieldPath}[${index}]` }, matches));
    return;
  }
  if (value && typeof value === "object") {
    if (value.__firestoreType === "documentReference" && typeof value.path === "string") {
      scanValueForReferences(value.path, context, matches);
    }
    for (const [key, nested] of Object.entries(value)) {
      const fieldPath = context.fieldPath ? `${context.fieldPath}.${key}` : key;
      scanValueForReferences(nested, { ...context, fieldPath }, matches);
    }
  }
}

function collectAllSeedReferences(state) {
  const referencesBySeedId = Object.fromEntries([...SEED_IDS].map((id) => [id, []]));
  const referencesByCollection = {};

  for (const documents of Object.values(state.collections || {})) {
    for (const document of documents) {
      const matches = [];
      scanValueForReferences(document.data, {
        collection: getRootCollectionName(document.path),
        documentPath: document.path,
        fieldPath: "",
      }, matches);
      for (const match of matches) {
        referencesBySeedId[match.value] = referencesBySeedId[match.value] || [];
        referencesBySeedId[match.value].push(match);
        referencesByCollection[match.collection] = referencesByCollection[match.collection] || 0;
        referencesByCollection[match.collection] += 1;
      }
    }
  }

  return { referencesBySeedId, referencesByCollection };
}

function collectAccountReferenceValues(value, context, output) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectAccountReferenceValues(entry, { ...context, fieldPath: `${context.fieldPath}[${index}]` }, output));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      const fieldPath = context.fieldPath ? `${context.fieldPath}.${key}` : key;
      if (ACCOUNT_REFERENCE_FIELD_RE.test(fieldPath) && typeof nested === "string" && nested) {
        output.push({ ...context, fieldPath, accountId: nested });
      }
      collectAccountReferenceValues(nested, { ...context, fieldPath }, output);
    }
  }
}

function collectUnknownAccountReferences(state, accounts) {
  const accountIds = new Set(accounts.map((account) => account.id));
  const references = [];
  for (const documents of Object.values(state.collections || {})) {
    for (const document of documents) {
      collectAccountReferenceValues(document.data, {
        collection: getRootCollectionName(document.path),
        documentPath: document.path,
        fieldPath: "",
      }, references);
    }
  }
  return references.filter((reference) => !accountIds.has(reference.accountId));
}

function referenceCountsByAccountId(documents, fieldNames) {
  const counts = {};
  for (const document of documents) {
    for (const fieldName of fieldNames) {
      const accountId = document[fieldName];
      if (typeof accountId === "string" && accountId) {
        counts[accountId] = (counts[accountId] || 0) + 1;
      }
    }
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function buildTransfersByAccount(transfers) {
  const impact = {};
  for (const transfer of transfers) {
    const sourceAccountId = transfer.sourceAccountId || transfer.fromAccountId || transfer.transferSourceAccountId || "";
    const destinationAccountId = transfer.destinationAccountId || transfer.toAccountId || transfer.transferDestinationAccountId || "";
    const amount = toNumber(transfer.amount ?? transfer.montant);
    if (!sourceAccountId || !destinationAccountId || sourceAccountId === destinationAccountId || amount <= 0) continue;
    impact[sourceAccountId] = impact[sourceAccountId] || { sent: 0, received: 0, net: 0 };
    impact[destinationAccountId] = impact[destinationAccountId] || { sent: 0, received: 0, net: 0 };
    impact[sourceAccountId].sent += amount;
    impact[sourceAccountId].net -= amount;
    impact[destinationAccountId].received += amount;
    impact[destinationAccountId].net += amount;
  }
  return impact;
}

function calculateBalances(accounts, transactions, transfers) {
  const transferImpact = buildTransfersByAccount(transfers);
  const balances = {};
  for (const account of accounts) {
    const accountTransactions = transactions.filter((transaction) => transaction.accountId === account.id || (!transaction.accountId && account.name === "Compte courant"));
    const revenues = accountTransactions.filter((transaction) => toTransactionType(transaction.type) === "revenu").reduce((sum, transaction) => sum + toNumber(transaction.montant ?? transaction.amount), 0);
    const expenses = accountTransactions.filter((transaction) => toTransactionType(transaction.type) === "depense").reduce((sum, transaction) => sum + toNumber(transaction.montant ?? transaction.amount), 0);
    const adjustments = accountTransactions.filter((transaction) => toTransactionType(transaction.type) === "adjustment").reduce((sum, transaction) => sum + toNumber(transaction.montant ?? transaction.amount), 0);
    const transfersSent = toNumber(transferImpact[account.id]?.sent);
    const transfersReceived = toNumber(transferImpact[account.id]?.received);
    balances[account.id] = {
      accountId: account.id,
      name: account.name,
      initialBalance: toNumber(account.initialBalance),
      transactions: accountTransactions.length,
      revenues,
      expenses,
      adjustments,
      transfersSent,
      transfersReceived,
      balance: toNumber(account.initialBalance) + revenues - expenses + adjustments - transfersSent + transfersReceived,
    };
  }
  return balances;
}

function compareBusinessFields(seed, canonical) {
  return BUSINESS_FIELDS
    .filter((field) => JSON.stringify(seed?.[field] ?? null) !== JSON.stringify(canonical?.[field] ?? null))
    .map((field) => ({ field, seed: seed?.[field] ?? null, canonical: canonical?.[field] ?? null }));
}

function accountInventory(accounts) {
  return accounts
    .map((account) => ({
      id: account.id,
      name: account.name ?? null,
      type: account.type ?? null,
      isActive: account.isActive ?? null,
      initialBalance: account.initialBalance ?? null,
      createdAt: account.createdAt ?? account.createTime ?? null,
      updatedAt: account.updatedAt ?? account.updateTime ?? null,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function buildAuditReport({ state, apply = false, generatedAtUtc = new Date().toISOString(), deletedIds = [], writesPerformed = 0, afterState = null }) {
  const accounts = getAccounts(state);
  const transactions = getTransactions(state);
  const transfers = getTransfers(state);
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const canonicalAccounts = Object.entries(CANONICAL_ACCOUNTS).map(([name, id]) => ({ name, id, account: accountsById.get(id) || null }));
  const seedAccounts = DEFAULT_SEED_ACCOUNTS.map((seed) => ({ ...seed, account: accountsById.get(seed.id) || null }));
  const referenceAudit = collectAllSeedReferences(state);
  const unknownAccountReferences = collectUnknownAccountReferences(state, accounts);
  const balancesBefore = calculateBalances(accounts, transactions, transfers);
  const transactionReferenceCounts = referenceCountsByAccountId(transactions, ["accountId"]);
  const transferReferenceCounts = referenceCountsByAccountId(transfers, ["sourceAccountId", "destinationAccountId", "fromAccountId", "toAccountId", "transferSourceAccountId", "transferDestinationAccountId"]);
  const errors = [];

  if (state.projectId !== EXPECTED_PROJECT_ID) errors.push(`projectId must be ${EXPECTED_PROJECT_ID}, got ${state.projectId || "<missing>"}.`);
  if (accounts.length !== 10) errors.push(`accounts total must be exactly 10, got ${accounts.length}.`);
  if (new Set(accounts.map((account) => account.id)).size !== 10) errors.push("account IDs must be exactly 10 unique IDs.");
  if (seedAccounts.filter((seed) => seed.account).length !== 5) errors.push("seed account count must be exactly 5.");
  if (canonicalAccounts.filter((entry) => entry.account).length !== 5) errors.push("canonical account count must be exactly 5.");

  for (const canonical of canonicalAccounts) {
    if (!canonical.account) errors.push(`canonical account missing: ${canonical.name} / ${canonical.id}.`);
    if (canonical.account && normalizeName(canonical.account.name) !== normalizeName(canonical.name)) {
      errors.push(`canonical account name mismatch: ${canonical.id}.`);
    }
  }

  const accountNames = new Map();
  for (const account of accounts) {
    const key = `${normalizeName(account.name)}::${account.type || ""}`;
    accountNames.set(key, (accountNames.get(key) || 0) + 1);
  }

  const seedComparisons = seedAccounts.map((seed) => {
    const seedAccount = seed.account;
    const canonical = accountsById.get(seed.canonicalId) || null;
    const sameNameTypeCandidates = accounts.filter((account) => account.id !== seed.id && normalizeName(account.name) === normalizeName(seedAccount?.name) && account.type === seedAccount?.type && !String(account.id).startsWith("default-"));
    const businessDifferences = compareBusinessFields(seedAccount, canonical);
    const seedReferences = referenceAudit.referencesBySeedId[seed.id] || [];
    const transactionReferences = seedReferences.filter((reference) => reference.collection === "transactions").length;
    const otherReferences = seedReferences.length - transactionReferences;
    const seedBalance = balancesBefore[seed.id]?.balance ?? null;
    const safeToDelete = Boolean(seedAccount && canonical)
      && sameNameTypeCandidates.length === 1
      && sameNameTypeCandidates[0].id === seed.canonicalId
      && transactionReferences === 0
      && otherReferences === 0
      && toNumber(seedAccount.initialBalance) === 0
      && toNumber(seedBalance) === 0
      && businessDifferences.length === 0
      && !CANONICAL_IDS.has(seed.id);

    if (!seedAccount) errors.push(`seed account missing: ${seed.id}.`);
    if (!canonical) errors.push(`canonical equivalent missing for seed ${seed.id}: ${seed.canonicalId}.`);
    if (sameNameTypeCandidates.length !== 1) errors.push(`seed ${seed.id} must have exactly one non-default canonical equivalent, got ${sameNameTypeCandidates.length}.`);
    if (sameNameTypeCandidates.length === 1 && sameNameTypeCandidates[0].id !== seed.canonicalId) errors.push(`seed ${seed.id} canonical equivalent mismatch.`);
    if (transactionReferences > 0) errors.push(`seed ${seed.id} has ${transactionReferences} transaction reference(s).`);
    if (otherReferences > 0) errors.push(`seed ${seed.id} has ${otherReferences} non-transaction reference(s).`);
    if (toNumber(seedAccount?.initialBalance) !== 0) errors.push(`seed ${seed.id} has non-zero initialBalance.`);
    if (toNumber(seedBalance) !== 0) errors.push(`seed ${seed.id} has non-zero calculated balance.`);
    if (businessDifferences.length > 0) errors.push(`seed ${seed.id} has incompatible business properties.`);
    if (CANONICAL_IDS.has(seed.id)) errors.push(`seed ${seed.id} is a canonical ID.`);

    return {
      seedId: seed.id,
      name: seedAccount?.name || null,
      canonicalEquivalent: seed.canonicalId,
      transactions: transactionReferences,
      otherReferences,
      balance: seedBalance,
      businessDifferences,
      safeToDelete,
    };
  });

  if (unknownAccountReferences.length > 0) errors.push("unknown accountId references detected.");
  if (DEFAULT_SEED_ACCOUNTS.length !== 5 || new Set(DEFAULT_SEED_ACCOUNTS.map((seed) => seed.id)).size !== 5) errors.push("deletion whitelist must contain exactly five unique seed IDs.");
  if (DEFAULT_SEED_ACCOUNTS.some((seed) => !SEED_IDS.has(seed.id) || CANONICAL_IDS.has(seed.id))) errors.push("deletion whitelist contains an unauthorized ID.");
  if (seedComparisons.filter((entry) => entry.safeToDelete).length !== 5) errors.push("final deletion list is not exactly the five audited safe seeds.");

  const beforeCanonicalSnapshot = Object.fromEntries([...CANONICAL_IDS].map((id) => [id, accountsById.get(id) || null]));
  let after = null;
  if (afterState) {
    const afterAccounts = getAccounts(afterState);
    const afterTransactions = getTransactions(afterState);
    const afterTransfers = getTransfers(afterState);
    const afterAccountsById = new Map(afterAccounts.map((account) => [account.id, account]));
    const balancesAfter = calculateBalances(afterAccounts, afterTransactions, afterTransfers);
    const afterErrors = [];
    if (afterAccounts.length !== 5) afterErrors.push(`accounts after cleanup must be 5, got ${afterAccounts.length}.`);
    if (new Set(afterAccounts.map((account) => account.id)).size !== 5) afterErrors.push("after cleanup account IDs must be unique.");
    if (afterAccounts.some((account) => String(account.id).startsWith("default-"))) afterErrors.push("default account remains after cleanup.");
    if (afterTransactions.length !== transactions.length) afterErrors.push("transactions count changed.");
    for (const id of CANONICAL_IDS) {
      if (JSON.stringify(afterAccountsById.get(id) || null) !== JSON.stringify(beforeCanonicalSnapshot[id] || null)) {
        afterErrors.push(`canonical account changed: ${id}.`);
      }
      if (JSON.stringify(balancesAfter[id] || null) !== JSON.stringify(balancesBefore[id] || null)) {
        afterErrors.push(`canonical balance changed: ${id}.`);
      }
    }
    after = {
      accountsCount: afterAccounts.length,
      transactionsCount: afterTransactions.length,
      accountIds: afterAccounts.map((account) => account.id).sort(),
      defaultAccountIds: afterAccounts.filter((account) => String(account.id).startsWith("default-")).map((account) => account.id).sort(),
      balances: balancesAfter,
      errors: afterErrors,
    };
    errors.push(...afterErrors);
  }

  const verdict = errors.length === 0
    ? (apply ? "NETTOYAGE VALIDE - 5 COMPTES DEFAULT SUPPRIMES, 5 COMPTES CANONIQUES CONSERVES" : "DRY_RUN_OK")
    : "NETTOYAGE ANNULE - GARDE-FOU DECLENCHE";

  return {
    projectId: state.projectId,
    generatedAtUtc,
    source: state.source,
    mode: apply ? "apply" : "dry-run",
    backupManifest: state.manifest,
    accountInventory: accountInventory(accounts),
    canonicalAccounts: canonicalAccounts.map(({ name, id, account }) => ({ name, id, present: Boolean(account), account })),
    seedAccounts: seedAccounts.map(({ id, canonicalName, canonicalId, account }) => ({ id, canonicalName, canonicalId, present: Boolean(account), account })),
    referencesByCollection: referenceAudit.referencesByCollection,
    referencesBySeedId: referenceAudit.referencesBySeedId,
    unknownAccountReferences,
    balancesBefore,
    globalBalanceBefore: Object.values(balancesBefore).reduce((sum, balance) => sum + toNumber(balance.balance), 0),
    transactionReferenceCounts,
    transferReferenceCounts,
    seedComparisons,
    deletionWhitelist: DEFAULT_SEED_ACCOUNTS.map((seed) => seed.id),
    dryRunResult: errors.length === 0 ? "DRY_RUN_OK" : "DRY_RUN_REFUSED",
    guards: errors,
    flagUsed: apply ? APPLY_FLAG : null,
    deletedIds,
    writesPerformed,
    after,
    anomalies: errors,
    verdict,
  };
}

export async function runCleanupWithDb({ db, projectId, apply = false, source = "firestore" }) {
  if (projectId !== EXPECTED_PROJECT_ID) {
    throw new Error(`--project must be exactly ${EXPECTED_PROJECT_ID}. Received ${projectId || "<missing>"}.`);
  }
  const state = await loadLiveState(db, projectId);
  state.source = source;
  const dryRunReport = buildAuditReport({ state, apply: false });
  if (dryRunReport.guards.length > 0 || !apply) return dryRunReport;

  const batch = db.batch();
  for (const seed of DEFAULT_SEED_ACCOUNTS) {
    if (!SEED_IDS.has(seed.id) || CANONICAL_IDS.has(seed.id)) {
      throw new Error(`refusing to add unauthorized account to delete batch: ${seed.id}.`);
    }
    batch.delete(db.collection("accounts").doc(seed.id));
  }
  await batch.commit();

  const afterState = await loadLiveState(db, projectId);
  afterState.source = source;
  return buildAuditReport({
    state,
    apply: true,
    deletedIds: DEFAULT_SEED_ACCOUNTS.map((seed) => seed.id),
    writesPerformed: DEFAULT_SEED_ACCOUNTS.length,
    afterState,
  });
}

function buildReportPath(options, prefix) {
  return options.reportPath || resolve(REPORT_ROOT, `${prefix}-${options.reportTag}-${timestampForPath()}.json`);
}

async function writeReport(reportPath, report) {
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.backupDir) throw new Error("--backup-path is mandatory for dry-run and apply.");
  const backupState = await loadBackupState(options.backupDir);
  validateCliContract(options, backupState);
  if (options.projectId !== EXPECTED_PROJECT_ID) throw new Error(`--project-id must be exactly ${EXPECTED_PROJECT_ID}.`);

  let report;
  if (!options.apply) {
    report = buildAuditReport({ state: backupState, apply: false });
  } else {
    const { db, projectId } = await loadFirestoreDb(options.projectId);
    const liveState = await loadLiveState(db, projectId);
    if (stateFingerprint(liveState) !== stateFingerprint(backupState)) {
      throw new Error("Firestore changed since the supplied backup; create a new backup and repeat the dry-run.");
    }
    report = await runCleanupWithDb({
      db,
      projectId,
      apply: options.apply,
      source: process.env.FIRESTORE_EMULATOR_HOST ? `emulator:${process.env.FIRESTORE_EMULATOR_HOST}` : `firestore:${projectId}`,
    });
  }

  const reportPath = buildReportPath(options, options.apply ? "cleanup-default-seed-accounts-apply" : "cleanup-default-seed-accounts-dry-run");
  await writeReport(reportPath, report);
  console.log(`Report: ${reportPath}`);
  console.log(`Whitelist: ${report.deletionWhitelist.join(", ")}`);
  console.log(`Verdict: ${report.verdict}`);
  console.log(JSON.stringify(report, null, 2));
  if (report.verdict !== "DRY_RUN_OK" && !report.verdict.startsWith("NETTOYAGE VALIDE")) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch((error) => {
    console.error("Default seed account cleanup failed:");
    console.error(error?.stack || error?.message || String(error));
    process.exitCode = 1;
  });
}
