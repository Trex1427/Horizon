import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const componentPath = resolve(process.cwd(), "src/components/TransactionUsageExplorer.jsx");

test("TransactionUsageExplorer uses Drawer on desktop and BottomSheet on mobile with local filters", async () => {
  const content = await readFile(componentPath, "utf8");

  assert.equal(content.includes("BottomSheet"), true);
  assert.equal(content.includes("Drawer"), true);
  assert.equal(content.includes('useMediaQuery("(max-width:899px)")'), true);
  assert.equal(content.includes("Recherche"), true);
  assert.equal(content.includes("Tri"), true);
  assert.equal(content.includes("Compte"), true);
  assert.equal(content.includes("Date début"), true);
  assert.equal(content.includes("Montant min"), true);
});

test("TransactionUsageExplorer restores scroll and exposes transaction actions", async () => {
  const content = await readFile(componentPath, "utf8");

  assert.equal(content.includes("window.scrollTo"), true);
  assert.equal(content.includes("scrollRestoreRef"), true);
  assert.equal(content.includes("Ouvrir la transaction"), true);
  assert.equal(content.includes("Modifier"), true);
  assert.equal(content.includes("Supprimer"), true);
  assert.equal(content.includes("Détacher du frais fixe"), true);
  assert.equal(content.includes("Relancer la réconciliation"), true);
});