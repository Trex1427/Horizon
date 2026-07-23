import process from "node:process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { assertAutomatedWriteAllowed } from "./safety/automatedWriteGuard.mjs";
import {
  DEMO_SEED_SOURCE,
  buildNameIndex,
  buildSubcategoryIndex,
  classifyDemoTransactionsByFingerprint,
  normalizeName,
} from "./reference-seed-lib.mjs";

const SERVICE_ACCOUNT_PATH = resolve(process.cwd(), "scripts/maintenance/service-account.json");
const GITIGNORE_PATH = resolve(process.cwd(), ".gitignore");
const REQUIRED_CONFIRMATION_FLAG = "--confirm-run";
const OWNER_UID_ENV = "HORIZON_OWNER_UID";

const DEMO_TRANSACTION_DEFINITIONS = [
  {
    seedFingerprint: "horizon-v4-demo:depense-carburant-auto-monod",
    date: "2026-07-03",
    montant: 92.4,
    type: "depense",
    categoryName: "Transport",
    subcategoryName: "Carburant",
    activityName: "Auto-entreprise",
    thirdPartyName: "TotalEnergies",
    projectName: "Chantier Monod",
    description: "Plein utilitaire chantier Monod",
  },
  {
    seedFingerprint: "horizon-v4-demo:depense-electricite-edf",
    date: "2026-07-05",
    montant: 74.9,
    type: "depense",
    categoryName: "Logement",
    subcategoryName: "Électricité",
    activityName: null,
    thirdPartyName: "EDF",
    projectName: null,
    description: "Facture electricite habitation",
  },
  {
    seedFingerprint: "horizon-v4-demo:revenu-petsitting-client-roy",
    date: "2026-07-07",
    montant: 160,
    type: "revenu",
    categoryName: "Revenus professionnels",
    subcategoryName: "Prestation",
    activityName: "Pet sitting",
    thirdPartyName: "Client Dupont",
    projectName: "Garde Roy",
    description: "Mission pet sitting - acompte",
  },
  {
    seedFingerprint: "horizon-v4-demo:depense-materiel-peche",
    date: "2026-07-10",
    montant: 48.5,
    type: "depense",
    categoryName: "Loisirs",
    subcategoryName: "Matériel",
    activityName: "Pêche",
    thirdPartyName: null,
    projectName: null,
    description: "Petit materiel peche",
  },
  {
    seedFingerprint: "horizon-v4-demo:revenu-prestation-auto-monod",
    date: "2026-07-12",
    montant: 420,
    type: "revenu",
    categoryName: "Revenus professionnels",
    subcategoryName: "Prestation",
    activityName: "Auto-entreprise",
    thirdPartyName: "Client Dupont",
    projectName: "Chantier Monod",
    description: "Prestation facturee chantier Monod",
  },
];

function verifyExplicitConfirmation(argv = []) {
  console.warn("WARNING: seed:demo ecrit des transactions de demonstration dans Firestore.");
  console.warn("WARNING: execution bloquee sans confirmation explicite.");

  if (!argv.includes(REQUIRED_CONFIRMATION_FLAG)) {
    console.warn(`Relancez avec: npm run seed:demo -- ${REQUIRED_CONFIRMATION_FLAG}`);
    process.exitCode = 1;
    return false;
  }

  return true;
}

function requireSeedOwnerUid() {
  const ownerUid = String(process.env[OWNER_UID_ENV] || "").trim();
  if (!ownerUid) {
    throw new Error(`${OWNER_UID_ENV} est requis pour creer des transactions demo avec ownerUid.`);
  }
  return ownerUid;
}

function loadServiceAccount(path) {
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("Impossible de charger le fichier de credentials Firebase Admin.");
    console.error(`Chemin attendu: ${path}`);
    throw error;
  }
}

function verifyGitIgnoreRules() {
  try {
    const content = readFileSync(GITIGNORE_PATH, "utf8");
    const requiredRules = ["scripts/maintenance/service-account.json", "**/service-account.json"];
    const missingRules = requiredRules.filter((rule) => !content.includes(rule));

    if (missingRules.length > 0) {
      console.warn("WARNING: .gitignore ne contient pas toutes les regles attendues pour les credentials.");
      for (const rule of missingRules) {
        console.warn(`- Regle manquante: ${rule}`);
      }
    }
  } catch {
    console.warn("WARNING: impossible de verifier .gitignore.");
  }
}

async function loadCollectionDocs(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }));
}

function resolveNameId(index, name) {
  if (!name) {
    return null;
  }

  return index.get(normalizeName(name))?.id || null;
}

function buildDemoPayload(definition, lookups, defaultAccountId, ownerUid) {
  const category = lookups.categoryByName.get(normalizeName(definition.categoryName));
  const categoryId = category?.id || null;
  const subcategoryKey = categoryId ? `${categoryId}::${normalizeName(definition.subcategoryName || "")}` : "";
  const subcategory = subcategoryKey ? lookups.subcategoryByCategoryAndName.get(subcategoryKey) : null;

  return {
    date: definition.date,
    montant: Number(definition.montant),
    type: definition.type,
    categorie: definition.categoryName,
    categoryId,
    categoryName: definition.categoryName,
    subcategoryId: subcategory?.id || null,
    subcategoryName: subcategory?.name || null,
    activityId: resolveNameId(lookups.activityByName, definition.activityName),
    activityName: definition.activityName || null,
    thirdPartyId: resolveNameId(lookups.thirdPartyByName, definition.thirdPartyName),
    thirdPartyName: definition.thirdPartyName || null,
    projectId: resolveNameId(lookups.projectByName, definition.projectName),
    projectName: definition.projectName || null,
    description: definition.description,
    accountId: defaultAccountId,
    destinationAccountId: null,
    isDeleted: false,
    seedSource: DEMO_SEED_SOURCE,
    seedFingerprint: definition.seedFingerprint,
    ownerUid,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function createSummary() {
  return {
    created: 0,
    existing: 0,
    skippedMissingDependencies: 0,
    errors: 0,
  };
}

function hasRequiredDependencies(payload) {
  if (!payload.accountId) {
    return false;
  }

  if (!payload.categoryId || !payload.subcategoryId) {
    return false;
  }

  return true;
}

async function main() {
  if (!verifyExplicitConfirmation(process.argv.slice(2))) {
    return;
  }

  verifyGitIgnoreRules();

  const serviceAccount = loadServiceAccount(SERVICE_ACCOUNT_PATH);
  assertAutomatedWriteAllowed({
    projectId: serviceAccount.project_id,
    operationName: "seed:demo",
  });

  const app = getApps().length > 0
    ? getApps()[0]
    : initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

  const db = getFirestore(app);
  const ownerUid = requireSeedOwnerUid();
  const summary = createSummary();

  const [
    categories,
    subcategories,
    activities,
    thirdParties,
    projects,
    accounts,
    transactions,
  ] = await Promise.all([
    loadCollectionDocs(db, "categories"),
    loadCollectionDocs(db, "subcategories"),
    loadCollectionDocs(db, "activities"),
    loadCollectionDocs(db, "thirdParties"),
    loadCollectionDocs(db, "projects"),
    loadCollectionDocs(db, "accounts"),
    loadCollectionDocs(db, "transactions"),
  ]);

  const activeAccount = accounts.find((account) => account.isActive !== false) || null;
  if (!activeAccount?.id) {
    console.error("Aucun compte actif trouve. Seed demo annule pour eviter des transactions invalides.");
    process.exitCode = 1;
    return;
  }

  const lookups = {
    categoryByName: buildNameIndex(categories),
    subcategoryByCategoryAndName: buildSubcategoryIndex(subcategories),
    activityByName: buildNameIndex(activities),
    thirdPartyByName: buildNameIndex(thirdParties),
    projectByName: buildNameIndex(projects),
  };

  const plannedPayloads = DEMO_TRANSACTION_DEFINITIONS.map((definition) =>
    buildDemoPayload(definition, lookups, activeAccount.id, ownerUid)
  );

  const { created: toCreate, alreadyExisting } = classifyDemoTransactionsByFingerprint(plannedPayloads, transactions);
  summary.existing += alreadyExisting.length;

  for (const payload of toCreate) {
    if (!hasRequiredDependencies(payload)) {
      summary.skippedMissingDependencies += 1;
      console.warn(`WARNING: transaction demo ignoree (dependances manquantes) ${payload.seedFingerprint}`);
      continue;
    }

    try {
      await db.collection("transactions").add(payload);
      summary.created += 1;
    } catch (error) {
      summary.errors += 1;
      console.error(`Erreur creation transaction demo ${payload.seedFingerprint}: ${error?.message || "inconnue"}`);
    }
  }

  console.log("\nTransactions demo:");
  console.log(`- creees : ${summary.created}`);
  console.log(`- deja existantes : ${summary.existing}`);
  console.log(`- ignorees dependances manquantes : ${summary.skippedMissingDependencies}`);
  console.log(`- erreurs : ${summary.errors}`);
}

main().catch((error) => {
  console.error("Seed demo echoue.");
  console.error(error?.message || error);
  process.exitCode = 1;
});
