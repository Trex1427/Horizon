import process from "node:process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { assertAutomatedWriteAllowed } from "./safety/automatedWriteGuard.mjs";
import {
  REQUIRED_PARENT_CATEGORIES,
  SEED_SOURCE,
  buildNameIndex,
  normalizeName,
  planRequiredCategories,
  planSubcategorySeed,
  resolveActivityIdByName,
} from "./reference-seed-lib.mjs";

const SERVICE_ACCOUNT_PATH = resolve(process.cwd(), "scripts/maintenance/service-account.json");
const GITIGNORE_PATH = resolve(process.cwd(), ".gitignore");
const OWNER_UID_ENV = "HORIZON_OWNER_UID";

const ACTIVITIES = [
  { name: "Auto-entreprise", kind: "profit_center" },
  { name: "Pet sitting", kind: "profit_center" },
  { name: "Pêche", kind: "interest_center" },
  { name: "Chasse", kind: "interest_center" },
  { name: "Sport", kind: "interest_center" },
  { name: "Bricolage", kind: "interest_center" },
  { name: "Jardinage", kind: "interest_center" },
  { name: "Maison", kind: "interest_center" },
  { name: "Personnel", kind: "mixed" },
  { name: "Animaux", kind: "mixed" },
  { name: "Voyages", kind: "mixed" },
];

const THIRD_PARTIES = [
  { name: "EDF", type: "supplier" },
  { name: "TotalEnergies", type: "supplier" },
  { name: "Carrefour", type: "supplier" },
  { name: "Amazon", type: "supplier" },
  { name: "France Travail", type: "administration" },
  { name: "CAF", type: "administration" },
  { name: "CPAM", type: "social_organization" },
  { name: "Client Dupont", type: "client" },
];

const PROJECTS = [
  { name: "Chantier Monod", activityName: "Auto-entreprise" },
  { name: "Garde Roy", activityName: "Pet sitting" },
];

const SUBCATEGORIES_BY_PARENT = {
  Transport: [
    "Carburant",
    "Assurance véhicule",
    "Entretien",
    "Réparations",
    "Péages",
    "Stationnement",
  ],
  Logement: [
    "Loyer",
    "Électricité",
    "Eau",
    "Assurance habitation",
    "Entretien",
    "Travaux",
  ],
  Loisirs: ["Matériel", "Sorties", "Culture", "Vacances", "Cotisations et permis"],
  "Revenus professionnels": ["Prestation", "Vente", "Acompte", "Solde de chantier"],
  "Aides et prestations": [
    "France Travail",
    "CAF",
    "CPAM",
    "Pension d’invalidité",
    "Prime d’activité",
  ],
};

function loadServiceAccount(path) {
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    console.error("Impossible de charger le fichier de credentials Firebase Admin.");
    console.error(`Chemin attendu: ${path}`);
    console.error("Assurez-vous que le fichier existe et est valide JSON.");
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

function nowIso() {
  return new Date().toISOString();
}

function requireSeedOwnerUid() {
  const ownerUid = String(process.env[OWNER_UID_ENV] || "").trim();
  if (!ownerUid) {
    throw new Error(`${OWNER_UID_ENV} est requis pour creer des references avec ownerUid.`);
  }
  return ownerUid;
}

function createEmptySummary() {
  return {
    created: 0,
    existing: 0,
    errors: 0,
  };
}

function printSeedSummary(summary) {
  console.log("\nCategories:");
  console.log(`- creees : ${summary.categories.created}`);
  console.log(`- deja existantes : ${summary.categories.existing}`);
  console.log(`- erreurs : ${summary.categories.errors}`);

  console.log("\nActivites:");
  console.log(`- creees : ${summary.activities.created}`);
  console.log(`- deja existantes : ${summary.activities.existing}`);
  console.log(`- erreurs : ${summary.activities.errors}`);

  console.log("\nTiers:");
  console.log(`- crees : ${summary.thirdParties.created}`);
  console.log(`- deja existants : ${summary.thirdParties.existing}`);
  console.log(`- erreurs : ${summary.thirdParties.errors}`);

  console.log("\nProjets:");
  console.log(`- crees : ${summary.projects.created}`);
  console.log(`- deja existants : ${summary.projects.existing}`);
  console.log(`- erreurs : ${summary.projects.errors}`);

  console.log("\nSous-categories:");
  console.log(`- creees : ${summary.subcategories.created}`);
  console.log(`- deja existantes : ${summary.subcategories.existing}`);
  console.log(`- ignorees parent introuvable : ${summary.subcategories.skippedMissingParent}`);
  console.log(`- erreurs : ${summary.subcategories.errors}`);
}

async function loadCollectionDocs(db, collectionName) {
  const snapshot = await db.collection(collectionName).get();
  return snapshot.docs.map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }));
}

async function main() {
  verifyGitIgnoreRules();

  const serviceAccount = loadServiceAccount(SERVICE_ACCOUNT_PATH);
  assertAutomatedWriteAllowed({
    projectId: serviceAccount.project_id,
    operationName: "seed:references",
  });

  const app = getApps().length > 0
    ? getApps()[0]
    : initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });

  const db = getFirestore(app);
  const ownerUid = requireSeedOwnerUid();
  const summary = {
    categories: createEmptySummary(),
    activities: createEmptySummary(),
    thirdParties: createEmptySummary(),
    projects: createEmptySummary(),
    subcategories: {
      ...createEmptySummary(),
      skippedMissingParent: 0,
    },
  };

  const existingActivities = await loadCollectionDocs(db, "activities");
  const activityIndex = buildNameIndex(existingActivities);

  for (const activity of ACTIVITIES) {
    const key = normalizeName(activity.name);
    const existing = activityIndex.get(key);
    if (existing) {
      summary.activities.existing += 1;
      continue;
    }

    try {
      const createdAt = nowIso();
      const docRef = await db.collection("activities").add({
        name: activity.name,
        kind: activity.kind,
        isActive: true,
        seedSource: SEED_SOURCE,
        ownerUid,
        createdAt,
        updatedAt: createdAt,
      });

      activityIndex.set(key, {
        id: docRef.id,
        ...activity,
      });
      summary.activities.created += 1;
    } catch (error) {
      summary.activities.errors += 1;
      console.error(`Erreur creation activite ${activity.name}: ${error?.message || "inconnue"}`);
    }
  }

  const existingThirdParties = await loadCollectionDocs(db, "thirdParties");
  const thirdPartyIndex = buildNameIndex(existingThirdParties);

  for (const thirdParty of THIRD_PARTIES) {
    const key = normalizeName(thirdParty.name);
    if (thirdPartyIndex.has(key)) {
      summary.thirdParties.existing += 1;
      continue;
    }

    try {
      const createdAt = nowIso();
      await db.collection("thirdParties").add({
        name: thirdParty.name,
        type: thirdParty.type,
        notes: "",
        isActive: true,
        seedSource: SEED_SOURCE,
        ownerUid,
        createdAt,
        updatedAt: createdAt,
      });

      thirdPartyIndex.set(key, thirdParty);
      summary.thirdParties.created += 1;
    } catch (error) {
      summary.thirdParties.errors += 1;
      console.error(`Erreur creation tiers ${thirdParty.name}: ${error?.message || "inconnue"}`);
    }
  }

  const existingProjects = await loadCollectionDocs(db, "projects");
  const projectIndex = buildNameIndex(existingProjects);

  for (const project of PROJECTS) {
    const projectNameKey = normalizeName(project.name);

    if (projectIndex.has(projectNameKey)) {
      summary.projects.existing += 1;
      continue;
    }

    const activityId = resolveActivityIdByName(Array.from(activityIndex.values()), project.activityName);
    if (!activityId) {
      summary.projects.errors += 1;
      console.error(`Erreur projet ${project.name}: activity introuvable (${project.activityName})`);
      continue;
    }

    try {
      const createdAt = nowIso();
      const docRef = await db.collection("projects").add({
        name: project.name,
        activityId,
        isActive: true,
        startDate: null,
        endDate: null,
        notes: "",
        seedSource: SEED_SOURCE,
        ownerUid,
        createdAt,
        updatedAt: createdAt,
      });

      projectIndex.set(projectNameKey, {
        id: docRef.id,
        name: project.name,
      });
      summary.projects.created += 1;
    } catch (error) {
      summary.projects.errors += 1;
      console.error(`Erreur creation projet ${project.name}: ${error?.message || "inconnue"}`);
    }
  }

  const categories = await loadCollectionDocs(db, "categories");
  const parentCategoryPlan = planRequiredCategories(categories, REQUIRED_PARENT_CATEGORIES);
  summary.categories.existing += parentCategoryPlan.alreadyExisting.length;

  for (const category of parentCategoryPlan.toCreate) {
    try {
      const createdAt = nowIso();
      const docRef = await db.collection("categories").add({
        name: category.name,
        type: category.type,
        isActive: true,
        seedSource: SEED_SOURCE,
        ownerUid,
        createdAt,
        updatedAt: createdAt,
      });

      categories.push({
        id: docRef.id,
        name: category.name,
        type: category.type,
      });
      summary.categories.created += 1;
    } catch (error) {
      summary.categories.errors += 1;
      console.error(`Erreur creation categorie ${category.name}: ${error?.message || "inconnue"}`);
    }
  }

  const existingSubcategories = await loadCollectionDocs(db, "subcategories");
  const subcategoryPlan = planSubcategorySeed({
    categories,
    existingSubcategories,
    subcategoriesByParent: SUBCATEGORIES_BY_PARENT,
  });

  for (const missingParent of subcategoryPlan.missingParents) {
    summary.subcategories.skippedMissingParent += missingParent.skippedCount;
    console.warn(`WARNING: categorie parente introuvable (${missingParent.parentName}), sous-categories ignorees.`);
  }

  summary.subcategories.existing += subcategoryPlan.alreadyExisting.length;

  for (const subcategory of subcategoryPlan.toCreate) {
    try {
      const createdAt = nowIso();
      await db.collection("subcategories").add({
        name: subcategory.name,
        categoryId: subcategory.parent.id,
        type: subcategory.type,
        isActive: true,
        seedSource: SEED_SOURCE,
        ownerUid,
        createdAt,
        updatedAt: createdAt,
      });
      summary.subcategories.created += 1;
    } catch (error) {
      summary.subcategories.errors += 1;
      console.error(`Erreur creation sous-categorie ${subcategory.name}: ${error?.message || "inconnue"}`);
    }
  }

  printSeedSummary(summary);
}

main().catch((error) => {
  console.error("Seed references echoue.");
  console.error(error?.message || error);
  process.exitCode = 1;
});
