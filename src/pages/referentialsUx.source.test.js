import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function source(path) {
  return readFile(resolve(process.cwd(), path), "utf8");
}

test("Referentiels exposes the six reference surfaces with shared UX controls", async () => {
  const content = await source("src/pages/Referentiels.jsx");

  for (const label of ["Comptes", "Sous-catégories", "Activités", "Tiers", "Projets"]) {
    assert.equal(content.includes(label), true);
  }
  assert.equal(content.includes("ReferenceHeader"), true);
  assert.equal(content.includes("ReferenceSearch"), true);
  assert.equal(content.includes("ReferenceCard"), true);
  assert.equal(content.includes("StatusChip"), true);
  assert.equal(content.includes("Effacer la recherche"), true);
  assert.equal(content.includes("Actions "), true);
});

test("Referentiels keeps local search and status filters without service changes", async () => {
  const content = await source("src/pages/Referentiels.jsx");

  assert.equal(content.includes("applySearch"), true);
  assert.equal(content.includes("statusByTab"), true);
  assert.equal(content.includes("useAccounts"), false);
  assert.equal(content.includes("accounts = []"), true);
});

test("Categories page has the shared header, search, counters, and empty states", async () => {
  const content = await source("src/pages/Categories.jsx");

  assert.equal(content.includes("Rechercher une catégorie"), true);
  assert.equal(content.includes("catégorie(s) affichée(s)"), true);
  assert.equal(content.includes("Aucune catégorie ne correspond à votre recherche."), true);
  assert.equal(content.includes("Effacer la recherche"), true);
});
