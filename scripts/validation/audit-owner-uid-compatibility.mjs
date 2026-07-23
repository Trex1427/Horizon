import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BACKUP_ROOT = path.join(ROOT, "backups", "firestore");
const ARTIFACT_DIR = path.join(ROOT, "artifacts", "security");
const JSON_REPORT_PATH = path.join(ARTIFACT_DIR, "owner-uid-compatibility-audit.json");
const MD_REPORT_PATH = path.join(ROOT, "OWNER_UID_COMPATIBILITY_AUDIT.md");
const ALTERNATE_OWNER_FIELDS = ["userId", "uid", "ownerId", "createdBy"];
const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs"]);
const SOURCE_ROOTS = ["src", "scripts", "functions"];
const WRITE_PATTERN = /\b(addDoc|setDoc|updateDoc|writeBatch|runTransaction|deleteDoc|batch\.(set|update|delete)|transaction\.(set|update|delete))\b/g;
const COLLECTION_PATTERN = /["'`]([A-Za-z][A-Za-z0-9_-]+)["'`]/g;

function isLikelyUid(value) {
  return typeof value === "string" && value.trim() === value && value.length >= 6 && !/\s/.test(value);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function latestBackupPath() {
  const entries = await readdir(BACKUP_ROOT, { withFileTypes: true });
  const folders = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !entry.name.startsWith("FAILED-"))
    .map((entry) => path.join(BACKUP_ROOT, entry.name))
    .sort();

  if (!folders.length) {
    throw new Error(`No Firestore backup folder found in ${BACKUP_ROOT}`);
  }

  return folders.at(-1);
}

function collectRulesCollections(rulesText) {
  const collections = [];
  const matcher = /match\s+\/([A-Za-z][A-Za-z0-9_-]+)\/\{documentId\}/g;
  let match;

  while ((match = matcher.exec(rulesText)) !== null) {
    collections.push(match[1]);
  }

  return collections;
}

function flattenDocuments(collectionExport, output = []) {
  for (const document of collectionExport.documents || []) {
    output.push(document);
    for (const nested of Object.values(document.subcollections || {})) {
      flattenDocuments(nested, output);
    }
  }

  return output;
}

function auditDocument(document) {
  const data = document.data || {};
  const ownerUid = data.ownerUid;
  const alternateFields = ALTERNATE_OWNER_FIELDS.filter((field) => Object.hasOwn(data, field));
  const present = Object.hasOwn(data, "ownerUid");
  const valid = present && isLikelyUid(ownerUid);

  return {
    path: document.path,
    present,
    valid,
    invalidReason: !present
      ? "missing"
      : typeof ownerUid !== "string"
        ? `type:${typeof ownerUid}`
        : !ownerUid.trim()
          ? "empty"
          : !isLikelyUid(ownerUid)
            ? "format"
            : null,
    ownerUid: typeof ownerUid === "string" ? ownerUid : null,
    alternateFields,
  };
}

async function auditBackup(backupPath, rulesCollections) {
  const manifest = await readJson(path.join(backupPath, "manifest.json"));
  const collectionsDir = path.join(backupPath, "collections");
  const collectionSummaries = [];
  const nonCompliantDocuments = [];
  const allOwnerValues = new Set();

  for (const collectionName of rulesCollections) {
    const collectionPath = path.join(collectionsDir, `${collectionName}.json`);
    const exists = existsSync(collectionPath);
    const documents = exists ? flattenDocuments(await readJson(collectionPath)) : [];
    const audits = documents.map(auditDocument);

    for (const audit of audits) {
      if (audit.ownerUid) {
        allOwnerValues.add(audit.ownerUid);
      }

      if (!audit.valid) {
        nonCompliantDocuments.push({
          collection: collectionName,
          path: audit.path,
          reason: audit.invalidReason,
          alternateFields: audit.alternateFields,
        });
      }
    }

    collectionSummaries.push({
      collection: collectionName,
      backupFileFound: exists,
      documents: documents.length,
      ownerUidPresent: audits.filter((entry) => entry.present).length,
      ownerUidMissing: audits.filter((entry) => !entry.present).length,
      invalid: audits.filter((entry) => entry.present && !entry.valid).length,
      distinctOwnerUidValues: new Set(audits.map((entry) => entry.ownerUid).filter(Boolean)).size,
      alternateOwnerFields: Object.fromEntries(ALTERNATE_OWNER_FIELDS.map((field) => [
        field,
        audits.filter((entry) => entry.alternateFields.includes(field)).length,
      ])),
    });
  }

  return {
    manifest,
    collectionSummaries,
    nonCompliantDocuments,
    allOwnerValues: Array.from(allOwnerValues).sort(),
  };
}

async function listSourceFiles(folder) {
  const output = [];

  if (!existsSync(folder)) {
    return output;
  }

  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const entryPath = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      output.push(...await listSourceFiles(entryPath));
    } else if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
      output.push(entryPath);
    }
  }

  return output;
}

function inferCollectionsFromText(text) {
  const known = new Set([
    "accounts",
    "transactions",
    "categories",
    "subcategories",
    "thirdParties",
    "activities",
    "projects",
    "budgets",
    "goals",
    "objectives",
    "fixedExpenses",
    "recurringIncome",
    "bankImports",
    "receiptDrafts",
    "transactionDrafts",
    "opportunities",
    "transfers",
  ]);
  const found = new Set();
  let match;

  while ((match = COLLECTION_PATTERN.exec(text)) !== null) {
    if (known.has(match[1])) {
      found.add(match[1]);
    }
  }

  return Array.from(found).sort();
}

async function auditWriteServices(rulesCollections) {
  const files = (await Promise.all(SOURCE_ROOTS.map((folder) => listSourceFiles(path.join(ROOT, folder)))))
    .flat();
  const services = [];

  for (const filePath of files) {
    const text = await readFile(filePath, "utf8");
    const writes = Array.from(text.matchAll(WRITE_PATTERN)).map((match) => match[1]);
    const collections = inferCollectionsFromText(text).filter((collection) => rulesCollections.includes(collection));

    if (!writes.length || !collections.length) {
      continue;
    }

    const relativePath = path.relative(ROOT, filePath).replaceAll("\\", "/");
    const writesOwnerUid = /\bownerUid\b/.test(text);
    const usesAlternateOwner = ALTERNATE_OWNER_FIELDS.filter((field) => new RegExp(`\\b${field}\\b`).test(text));
    const hasCreateLikeWrite = writes.some((write) => ["addDoc", "setDoc", "writeBatch", "batch.set", "transaction.set", "runTransaction"].includes(write));
    const hasUpdateLikeWrite = writes.some((write) => ["updateDoc", "writeBatch", "batch.update", "transaction.update", "runTransaction"].includes(write));

    services.push({
      flux: relativePath,
      file: relativePath,
      collections,
      writeApis: Array.from(new Set(writes)).sort(),
      creation: hasCreateLikeWrite,
      ownerUidWritten: writesOwnerUid,
      update: hasUpdateLikeWrite,
      updateSafe: hasUpdateLikeWrite ? writesOwnerUid : true,
      alternateOwnerFields: usesAlternateOwner,
      compatible: (!hasCreateLikeWrite || writesOwnerUid) && (!hasUpdateLikeWrite || writesOwnerUid),
    });
  }

  return services.sort((a, b) => a.file.localeCompare(b.file));
}

function buildRulesInventory(rulesCollections) {
  return rulesCollections.map((collection) => ({
    collection,
    read: "get,list if authenticated ownerUid == request.auth.uid",
    create: "request.resource.data.ownerUid string == request.auth.uid",
    update: "existing ownerUid == request.auth.uid and incoming ownerUid unchanged",
    delete: "existing ownerUid == request.auth.uid",
    ownerUidRequired: true,
  }));
}

function markdownTable(headers, rows) {
  const header = `| ${headers.join(" | ")} |`;
  const separator = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((row) => `| ${row.map((value) => String(value ?? "").replaceAll("\n", " ")).join(" | ")} |`);
  return [header, separator, ...body].join("\n");
}

function buildMarkdown(report) {
  const docRows = report.collectionsAudited.map((entry) => [
    entry.collection,
    entry.documents,
    entry.ownerUidPresent,
    entry.ownerUidMissing,
    entry.invalid,
    entry.distinctOwnerUidValues,
  ]);
  const serviceRows = report.servicesAudited.map((entry) => [
    entry.flux,
    entry.file,
    entry.collections.join(", "),
    entry.creation ? "oui" : "non",
    entry.ownerUidWritten ? "oui" : "non",
    entry.updateSafe ? "oui" : "non",
  ]);
  const rulesRows = report.rulesInventory.map((entry) => [
    entry.collection,
    entry.read,
    entry.create,
    entry.update,
    entry.delete,
    entry.ownerUidRequired ? "oui" : "non",
  ]);

  return `# OwnerUid Compatibility Audit

## Resume

- Date: ${report.date}
- Project ID: ${report.projectId}
- Backup utilise: ${report.backup.outputFolder}
- UID attendu: ${report.expectedUid.value || report.expectedUid.status}
- Verdict: ${report.verdict}

## Inventaire des rules

${markdownTable(["Collection", "Read", "Create", "Update", "Delete", "ownerUid requis"], rulesRows)}

## Audit Firestore lecture seule

${markdownTable(["Collection", "Documents", "ownerUid present", "ownerUid absent", "invalide", "valeurs distinctes"], docRows)}

## UID attendu

${report.expectedUid.explanation}

Valeurs ownerUid distinctes detectees: ${report.ownerUidDistinctValues.length ? report.ownerUidDistinctValues.join(", ") : "aucune"}.

## Services d'ecriture

${markdownTable(["Flux", "Fichier", "Collection", "Creation", "ownerUid ecrit", "Mise a jour sure"], serviceRows)}

## Tests Emulator

${report.emulatorResults.summary}

## Bloquants

${report.blockers.length ? report.blockers.map((entry) => `- ${entry.severity}: ${entry.message}`).join("\n") : "- Aucun bloquant detecte."}

## Plan de correction

${report.remediationPlan.map((entry) => `- ${entry}`).join("\n")}

## Deploiement

NON EFFECTUE

## Conclusion

${report.verdict}
`;
}

async function main() {
  const backupPath = process.argv[2] ? path.resolve(process.argv[2]) : await latestBackupPath();
  const rulesText = await readFile(path.join(ROOT, "firestore.rules"), "utf8");
  const rulesCollections = collectRulesCollections(rulesText);
  const backupAudit = await auditBackup(backupPath, rulesCollections);
  const servicesAudited = await auditWriteServices(rulesCollections);
  const documentsAudited = backupAudit.collectionSummaries.reduce((sum, entry) => sum + entry.documents, 0);
  const documentsCompliant = backupAudit.collectionSummaries.reduce((sum, entry) => sum + entry.ownerUidPresent - entry.invalid, 0);
  const documentsMissingOwnerUid = backupAudit.collectionSummaries.reduce((sum, entry) => sum + entry.ownerUidMissing, 0);
  const documentsInvalidOwnerUid = backupAudit.collectionSummaries.reduce((sum, entry) => sum + entry.invalid, 0);
  const serviceNonCompliant = servicesAudited.filter((entry) => !entry.compatible);
  const expectedUid = backupAudit.allOwnerValues.length === 1
    ? {
      status: "determined_from_existing_ownerUid",
      value: backupAudit.allOwnerValues[0],
      explanation: "Un seul ownerUid distinct est present dans les donnees auditees.",
    }
    : {
      status: "not_determined",
      value: null,
      explanation: "Aucun UID Firebase Authentication fiable n'a pu etre determine: src/firebase.js initialise Firestore et Storage mais aucun module Auth n'est configure, et les donnees auditees ne contiennent pas un ownerUid unique exploitable.",
    };

  const blockers = [];

  if (documentsMissingOwnerUid > 0) {
    blockers.push({
      severity: "CRITIQUE",
      message: `${documentsMissingOwnerUid} documents couverts par les rules n'ont pas ownerUid.`,
    });
  }

  if (documentsInvalidOwnerUid > 0) {
    blockers.push({
      severity: "CRITIQUE",
      message: `${documentsInvalidOwnerUid} documents ont un ownerUid invalide.`,
    });
  }

  if (serviceNonCompliant.length > 0) {
    blockers.push({
      severity: "CRITIQUE",
      message: `${serviceNonCompliant.length} flux d'ecriture ne garantissent pas ownerUid.`,
    });
  }

  if (expectedUid.status === "not_determined") {
    blockers.push({
      severity: "IMPORTANT",
      message: "UID attendu non determine depuis la configuration Auth, la session ou les donnees.",
    });
  }

  const verdict = blockers.some((entry) => entry.severity === "CRITIQUE")
    ? "NOT_READY_FOR_RULES_DEPLOYMENT"
    : "READY_FOR_RULES_DEPLOYMENT";

  const report = {
    date: new Date().toISOString(),
    projectId: backupAudit.manifest.projectId,
    backup: {
      outputFolder: backupAudit.manifest.outputFolder,
      rootCollectionsCount: backupAudit.manifest.rootCollectionsCount,
      totalDocuments: backupAudit.manifest.totalDocuments,
      documentsPerCollection: backupAudit.manifest.documentsPerCollection,
    },
    expectedUid,
    rulesInventory: buildRulesInventory(rulesCollections),
    collectionsAudited: backupAudit.collectionSummaries,
    documentsAudited,
    documentsCompliant,
    documentsNonCompliant: documentsMissingOwnerUid + documentsInvalidOwnerUid,
    documentsMissingOwnerUid,
    documentsInvalidOwnerUid,
    ownerUidDistinctValues: backupAudit.allOwnerValues,
    nonCompliantDocuments: backupAudit.nonCompliantDocuments,
    servicesAudited,
    servicesCompliant: servicesAudited.filter((entry) => entry.compatible),
    servicesNonCompliant: serviceNonCompliant,
    emulatorResults: {
      summary: "A executer via npm run test:rules; le test couvre les refus anonyme/mauvais UID et les operations ownerUid.",
      command: "npm run test:rules",
    },
    blockedFlows: serviceNonCompliant.map((entry) => ({
      file: entry.file,
      collections: entry.collections,
      reason: "ownerUid non ecrit ou non garanti dans un flux d'ecriture.",
    })),
    blockers,
    remediationPlan: [
      "Ne pas deployer les rules tant que les donnees existantes n'ont pas ownerUid valide.",
      "Determiner le UID Firebase Authentication cible depuis une session Auth reelle ou une source d'identite fiable.",
      "Preparer un script de migration dry-run qui ne selectionne que les documents sans ownerUid des collections couvertes.",
      "Ajouter des garde-fous: projectId attendu, sauvegarde obligatoire, confirmation explicite, compteur avant/apres, journal d'execution.",
      "Tester la migration sur Firestore Emulator avec une copie representative avant toute execution distante.",
      "Modifier les services de creation pour ecrire ownerUid depuis l'utilisateur authentifie, jamais depuis une saisie utilisateur.",
      "Modifier les services de mise a jour pour conserver ownerUid et refuser toute mutation de proprietaire.",
      "Relancer npm run test:rules, npm test et npm run build apres corrections.",
      "Prevoir rollback par restauration depuis la sauvegarde si une migration future introduit une incoherence.",
    ],
    verdict,
  };

  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(JSON_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(MD_REPORT_PATH, buildMarkdown(report), "utf8");

  console.log(`OwnerUid compatibility audit completed: ${verdict}`);
  console.log(`JSON report: ${JSON_REPORT_PATH}`);
  console.log(`Markdown report: ${MD_REPORT_PATH}`);
  console.log(`Documents audited: ${documentsAudited}`);
  console.log(`Documents missing ownerUid: ${documentsMissingOwnerUid}`);
  console.log(`Services non compliant: ${serviceNonCompliant.length}`);
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
