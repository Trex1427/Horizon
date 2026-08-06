import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function source(path) {
  return readFile(resolve(process.cwd(), path), "utf8");
}

test("Referentiels exposes the pilot-center reference surfaces with shared UX controls", async () => {
  const content = await source("src/pages/Referentiels.jsx");

  for (const label of ["Catégories", "Sous-catégories", "Activités", "Tiers", "Projets", "Frais fixes", "Revenus récurrents"]) {
    assert.equal(content.includes(label), true);
  }
  assert.equal(content.includes("ReferenceHeader"), true);
  assert.equal(content.includes("ReferenceSearch"), true);
  assert.equal(content.includes("ReferenceCard"), true);
  assert.equal(content.includes("StatusChip"), true);
  assert.equal(content.includes("Effacer la recherche"), true);
  assert.equal(content.includes("Actions "), true);
  assert.equal(content.includes("ReferentialPilotDrawer"), true);
});

test("Referentiels keeps local search, status filters and sort controls without engine changes", async () => {
  const content = await source("src/pages/Referentiels.jsx");

  assert.equal(content.includes("applySearch"), true);
  assert.equal(content.includes("statusByTab"), true);
  assert.equal(content.includes("sortByTab"), true);
  assert.equal(content.includes("accounts = []"), true);
});

test("Referentiels keeps CRUD entry points and receives the transaction-opening callback", async () => {
  const content = await source("src/pages/Referentiels.jsx");
  const app = await source("src/App.jsx");

  for (const action of [
    "startCreateAccount",
    "startCreateSubcategory",
    "startCreateActivity",
    "startCreateThirdParty",
    "startCreateProject",
  ]) {
    assert.match(content, new RegExp(`onAdd=\\{${action}\\}`));
  }
  assert.match(content, /handleSaveAccount/);
  assert.match(content, /addAccount/);
  assert.match(content, /updateAccount/);
  assert.match(content, /deleteAccount/);
  assert.match(app, /<Referentiels/);
  for (const prop of ["accounts", "addAccount", "updateAccount", "deleteAccount"]) {
    assert.match(app, new RegExp(`${prop}=\\{${prop}\\}`));
  }
  assert.match(app, /onOpenTransactionsFiltered=\{openTransactionsWithContext\}/);
});

test("Referentiels pilot center exposes impact preview and cross-reference opening", async () => {
  const content = await source("src/pages/Referentiels.jsx");

  for (const label of ["Fusionner", "Remplacer par...", "Réactiver", "Désactiver", "openReferenceDetail", "mergePreview", "Aperçu d'impact"]) {
    assert.equal(content.includes(label), true, label);
  }
});

test("Categories page has the shared header, search, counters, and empty states", async () => {
  const content = await source("src/pages/Categories.jsx");

  assert.equal(content.includes("Rechercher une catégorie"), true);
  assert.equal(content.includes("catégorie(s) affichée(s)"), true);
  assert.equal(content.includes("Aucune catégorie ne correspond à votre recherche."), true);
  assert.equal(content.includes("Effacer la recherche"), true);
});
