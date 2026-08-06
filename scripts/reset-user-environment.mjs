import process from "node:process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { buildDefaultCategoryDocumentId } from "../src/services/categoriesDefaults.js";

export const MAX_BATCH_SIZE = 400;

export const REFERENCE_CATEGORIES = [
  { name: "Alimentation", type: "depense", icon: "restaurant", color: "#FF9800", displayOrder: 1 },
  { name: "Logement", type: "depense", icon: "home", color: "#3F51B5", displayOrder: 2 },
  { name: "Transport", type: "depense", icon: "directions_car", color: "#009688", displayOrder: 3 },
  { name: "Santé", type: "depense", icon: "medical_services", color: "#E91E63", displayOrder: 4 },
  { name: "Loisirs", type: "depense", icon: "sports_esports", color: "#9C27B0", displayOrder: 5 },
  { name: "Abonnements", type: "depense", icon: "subscriptions", color: "#607D8B", displayOrder: 6 },
  { name: "Autre dépense", type: "depense", icon: "receipt_long", color: "#795548", displayOrder: 7 },
  { name: "Salaire", type: "revenu", icon: "work", color: "#4CAF50", displayOrder: 8 },
  { name: "Remboursement", type: "revenu", icon: "account_balance_wallet", color: "#8BC34A", displayOrder: 9 },
  { name: "Autre revenu", type: "revenu", icon: "payments", color: "#2196F3", displayOrder: 10 },
  { name: "Revenus professionnels", type: "revenu", icon: "business_center", color: "#2E7D32", displayOrder: 11 },
  { name: "Aides et prestations", type: "revenu", icon: "volunteer_activism", color: "#558B2F", displayOrder: 12 },
];

export const REFERENCE_SUBCATEGORIES = [
  ["Transport", "Carburant"], ["Transport", "Assurance véhicule"], ["Transport", "Entretien"],
  ["Transport", "Réparations"], ["Transport", "Péages"], ["Transport", "Stationnement"],
  ["Logement", "Loyer"], ["Logement", "Électricité"], ["Logement", "Eau"],
  ["Logement", "Assurance habitation"], ["Logement", "Entretien"], ["Logement", "Travaux"],
  ["Loisirs", "Matériel"], ["Loisirs", "Sorties"], ["Loisirs", "Culture"],
  ["Loisirs", "Vacances"], ["Loisirs", "Cotisations et permis"],
  ["Revenus professionnels", "Prestation"], ["Revenus professionnels", "Vente"],
  ["Revenus professionnels", "Acompte"], ["Revenus professionnels", "Solde de chantier"],
  ["Aides et prestations", "France Travail"], ["Aides et prestations", "CAF"],
  ["Aides et prestations", "CPAM"], ["Aides et prestations", "Pension d'invalidité"],
  ["Aides et prestations", "Prime d'activité"],
];

export function parseOptions(args) {
  const options = { apply: false, seed: false, projectId: undefined, databaseId: "(default)" };
  for (const arg of args) {
    if (arg === "--apply") options.apply = true;
    else if (arg === "--seed") options.seed = true;
    else if (arg.startsWith("--project-id=")) options.projectId = arg.slice(13).trim();
    else if (arg.startsWith("--database-id=")) options.databaseId = arg.slice(14).trim();
    else if (arg.startsWith("--uid=")) options.uid = arg.slice(6).trim();
    else throw new Error(`Argument inconnu : ${arg}`);
  }
  if (!options.projectId) throw new Error("--project-id est requis.");
  if (!options.uid || !/^[A-Za-z0-9_-]{10,128}$/.test(options.uid)) throw new Error("--uid est requis et doit être un UID Firebase valide.");
  if (options.seed && !options.apply) throw new Error("--seed exige --apply afin que la simulation reste strictement en lecture seule.");
  return options;
}

async function createFirestore(projectId, databaseId) {
  if (!getApps().length) {
    const credentialsPath = resolve(process.cwd(), "scripts/maintenance/service-account.json");
    let credential;
    try {
      credential = cert(JSON.parse(await readFile(credentialsPath, "utf8")));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
    initializeApp({ projectId, ...(credential ? { credential } : {}) });
  }
  return getFirestore(getApps()[0], databaseId);
}

function describeError(error, context) {
  return { context, code: error?.code || null, message: error?.message || String(error) };
}

export async function scanOwnedRootDocuments(db, uid) {
  const report = { documentsScanned: 0, deletable: 0, byCollection: {}, candidates: [], errors: [] };
  let collections;
  try {
    collections = await db.listCollections();
  } catch (error) {
    report.errors.push(describeError(error, "listCollections"));
    return report;
  }

  for (const collection of collections.sort((a, b) => a.id.localeCompare(b.id))) {
    const counts = { scanned: 0, deletable: 0 };
    try {
      const snapshot = await collection.get();
      for (const document of snapshot.docs) {
        counts.scanned += 1;
        report.documentsScanned += 1;
        if (document.get("ownerUid") !== uid) continue;
        counts.deletable += 1;
        report.deletable += 1;
        report.candidates.push({
          collection: collection.id,
          documentId: document.id,
          path: document.ref.path,
          ref: document.ref,
          updateTime: document.updateTime,
        });
      }
      if (counts.deletable > 0) report.byCollection[collection.id] = counts;
    } catch (error) {
      report.errors.push(describeError(error, `scan:${collection.id}`));
    }
  }
  return report;
}

export async function deleteCandidates(db, candidates, batchSize = MAX_BATCH_SIZE) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) throw new Error(`batchSize doit être compris entre 1 et ${MAX_BATCH_SIZE}.`);
  let deleted = 0;
  const errors = [];
  for (let offset = 0; offset < candidates.length; offset += batchSize) {
    const group = candidates.slice(offset, offset + batchSize);
    const batch = db.batch();
    for (const candidate of group) batch.delete(candidate.ref, { lastUpdateTime: candidate.updateTime });
    try {
      await batch.commit();
      deleted += group.length;
    } catch (error) {
      errors.push(describeError(error, `delete-batch:${offset / batchSize + 1}`));
    }
  }
  return { deleted, errors };
}

function slug(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function normalizeBusinessName(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

async function readOwnedDocuments(db, collectionName, uid) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.filter((document) => document.get("ownerUid") === uid).map((document) => ({ ref: document.ref, data: document.data() }));
}

async function createDocuments(db, documents, batchSize, context) {
  let created = 0;
  const errors = [];
  for (let offset = 0; offset < documents.length; offset += batchSize) {
    const group = documents.slice(offset, offset + batchSize);
    const batch = db.batch();
    for (const document of group) batch.create(document.ref, document.data);
    try { await batch.commit(); created += group.length; }
    catch (error) { errors.push(describeError(error, `${context}:${offset / batchSize + 1}`)); }
  }
  return { created, errors };
}
export function buildSeedDocuments(db, uid, timestamp = new Date()) {
  const prefix = `reset-${uid}`;
  const categoryRefs = new Map();
  const documents = [];
  documents.push({
    ref: db.collection("accounts").doc(`${prefix}-current`),
    data: { name: "Compte courant", initialBalance: 0, type: "standard", color: "#1976d2", isActive: true, isDefault: true, displayOrder: 0, ownerUid: uid, createdAt: timestamp, updatedAt: timestamp },
  });
  for (const category of REFERENCE_CATEGORIES) {
    const ref = db.collection("categories").doc(buildDefaultCategoryDocumentId(uid, category.name));
    categoryRefs.set(category.name, ref);
    documents.push({ ref, data: { ...category, nameNormalized: normalizeBusinessName(category.name), isActive: true, ownerUid: uid, createdAt: timestamp, updatedAt: timestamp } });
  }
  for (const [categoryName, name] of REFERENCE_SUBCATEGORIES) {
    const category = REFERENCE_CATEGORIES.find((item) => item.name === categoryName);
    const categoryRef = categoryRefs.get(categoryName);
    documents.push({
      ref: db.collection("subcategories").doc(`${prefix}-${slug(categoryName)}-${slug(name)}`),
      data: { name, categoryId: categoryRef.id, type: category.type, isActive: true, ownerUid: uid, createdAt: timestamp, updatedAt: timestamp },
    });
  }
  return documents;
}


export async function findExistingSeedDocumentPaths(db, uid) {
  const [accounts, categories, subcategories] = await Promise.all([
    readOwnedDocuments(db, "accounts", uid), readOwnedDocuments(db, "categories", uid), readOwnedDocuments(db, "subcategories", uid),
  ]);
  const paths = new Set(accounts.filter(({ data }) => ["compte courant", "courant"].includes(normalizeBusinessName(data.name))).map(({ ref }) => ref.path));
  const referenceCategoryNames = new Set(REFERENCE_CATEGORIES.map(({ name }) => normalizeBusinessName(name)));
  const referenceCategories = categories.filter(({ data }) => referenceCategoryNames.has(normalizeBusinessName(data.name)));
  const categoryNamesById = new Map(referenceCategories.map(({ ref, data }) => [ref.id, normalizeBusinessName(data.name)]));
  for (const { ref } of referenceCategories) paths.add(ref.path);
  const subcategoryKeys = new Set(REFERENCE_SUBCATEGORIES.map(([categoryName, name]) => `${normalizeBusinessName(categoryName)}::${normalizeBusinessName(name)}`));
  for (const { ref, data } of subcategories) {
    const categoryName = categoryNamesById.get(String(data.categoryId || "").trim());
    if (categoryName && subcategoryKeys.has(`${categoryName}::${normalizeBusinessName(data.name)}`)) paths.add(ref.path);
  }
  return paths;
}
export async function seedMinimalEnvironment(db, uid, batchSize = MAX_BATCH_SIZE) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) throw new Error(`batchSize doit être compris entre 1 et ${MAX_BATCH_SIZE}.`);
  const errors = [];
  let created = 0;
  const timestamp = new Date();
  const prefix = `reset-${uid}`;
  let accounts;
  let categories;
  let subcategories;

  try {
    [accounts, categories, subcategories] = await Promise.all([
      readOwnedDocuments(db, "accounts", uid), readOwnedDocuments(db, "categories", uid), readOwnedDocuments(db, "subcategories", uid),
    ]);
  } catch (error) {
    return { created, errors: [describeError(error, "seed-scan")] };
  }

  if (!accounts.some(({ data }) => ["compte courant", "courant"].includes(normalizeBusinessName(data.name)))) {
    const result = await createDocuments(db, [{ ref: db.collection("accounts").doc(`${prefix}-current`), data: { name: "Compte courant", initialBalance: 0, type: "standard", color: "#1976d2", isActive: true, isDefault: true, displayOrder: 0, ownerUid: uid, createdAt: timestamp, updatedAt: timestamp } }], batchSize, "seed-account-batch");
    created += result.created;
    errors.push(...result.errors);
  }

  const categoriesByName = new Map();
  for (const category of categories) {
    const key = normalizeBusinessName(category.data.name);
    if (key && !categoriesByName.has(key)) categoriesByName.set(key, category.ref);
  }
  const missingCategories = [];
  for (const category of REFERENCE_CATEGORIES) {
    const key = normalizeBusinessName(category.name);
    if (categoriesByName.has(key)) continue;
    const ref = db.collection("categories").doc(`${prefix}-${slug(category.name)}`);
    categoriesByName.set(key, ref);
    missingCategories.push({ ref, data: { ...category, isActive: true, ownerUid: uid, createdAt: timestamp, updatedAt: timestamp } });
  }
  const categoryResult = await createDocuments(db, missingCategories, batchSize, "seed-category-batch");
  created += categoryResult.created;
  errors.push(...categoryResult.errors);

  if (categoryResult.errors.length === 0) {
    const keys = new Set(subcategories.map(({ data }) => data.categoryId && data.name ? `${data.categoryId}::${normalizeBusinessName(data.name)}` : "").filter(Boolean));
    const missing = [];
    for (const [categoryName, name] of REFERENCE_SUBCATEGORIES) {
      const category = REFERENCE_CATEGORIES.find((item) => item.name === categoryName);
      const categoryRef = categoriesByName.get(normalizeBusinessName(categoryName));
      const key = `${categoryRef.id}::${normalizeBusinessName(name)}`;
      if (keys.has(key)) continue;
      keys.add(key);
      missing.push({ ref: db.collection("subcategories").doc(`${prefix}-${slug(categoryName)}-${slug(name)}`), data: { name, categoryId: categoryRef.id, type: category.type, isActive: true, ownerUid: uid, createdAt: timestamp, updatedAt: timestamp } });
    }
    const result = await createDocuments(db, missing, batchSize, "seed-subcategory-batch");
    created += result.created;
    errors.push(...result.errors);
  }
  return { created, errors };
}
function printReport(report, { apply, seed }, result, elapsedMs) {
  console.log(`\nMode : ${apply ? "APPLY" : "SIMULATION (lecture seule)"}`);
  console.log("\nRépartition par collection contenant des documents supprimables :");
  if (!Object.keys(report.byCollection).length) console.log("  Aucune");
  for (const [collection, counts] of Object.entries(report.byCollection)) {
    console.log(`  ${collection}: trouvés=${counts.scanned}, à supprimer=${counts.deletable}`);
  }
  const errors = [...report.errors, ...result.errors];
  console.log("\nRapport :");
  console.log(`  Documents analysés : ${report.documentsScanned}`);
  console.log(`  Documents supprimables : ${report.deletable}`);
  console.log(`  Documents supprimés : ${result.deleted}`);
  if (seed) console.log(`  Documents de seed créés : ${result.seedCreated}`);
  console.log(`  Temps d’exécution : ${elapsedMs} ms`);
  console.log(`  Erreurs : ${errors.length}`);
  for (const error of errors) console.error(`  [${error.context}] ${error.code ? `${error.code}: ` : ""}${error.message}`);
  return errors;
}

async function main() {
  const startedAt = Date.now();
  const options = parseOptions(process.argv.slice(2));
  const db = await createFirestore(options.projectId, options.databaseId);
  const report = await scanOwnedRootDocuments(db, options.uid);
  const result = { deleted: 0, seedCreated: 0, errors: [] };

  if (options.apply && !options.seed && report.errors.length === 0) {
    let deletionCandidates = report.candidates;
    if (options.seed) {
      const seedPaths = await findExistingSeedDocumentPaths(db, options.uid);
      deletionCandidates = deletionCandidates.filter((candidate) => !seedPaths.has(candidate.path));
    }
    const deletion = await deleteCandidates(db, deletionCandidates);
    result.deleted = deletion.deleted;
    result.errors.push(...deletion.errors);
  } else if (options.apply && options.seed && report.errors.length === 0) {
    const deletion = await deleteCandidates(db, report.candidates);
    result.deleted = deletion.deleted;
    result.errors.push(...deletion.errors);
    if (deletion.errors.length === 0) {
      const seeded = await seedMinimalEnvironment(db, options.uid);
      result.seedCreated = seeded.created;
      result.errors.push(...seeded.errors);
    }
  }
  const errors = printReport(report, options, result, Date.now() - startedAt);
  if (options.apply && report.errors.length) console.error("Suppression annulée : le scan contient des erreurs.");
  if (errors.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(`Erreur fatale : ${error?.stack || error}`);
    process.exitCode = 1;
  });
}

