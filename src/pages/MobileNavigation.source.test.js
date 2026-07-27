import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const appPath = resolve(process.cwd(), "src/App.jsx");

test("mobile portrait navigation exposes direct actions, Plus and Android safe area", async () => {
  const content = await readFile(appPath, "utf8");
  assert.match(content, /max-width:600px.*orientation: portrait/);
  assert.match(content, /label="Résumé"/);
  assert.match(content, /label="Transactions"/);
  assert.match(content, /label="Budgets"/);
  assert.match(content, /value="MORE" label="Plus"/);
  assert.match(content, /gridTemplateColumns: "repeat\(5, minmax\(0, 1fr\)\)"/);
  assert.match(content, /overflowX: "hidden"/);
  assert.match(content, /safe-area-inset-bottom/);
  assert.match(content, /aria-label="Ouvrir le résumé mensuel"/);
  assert.match(content, /aria-label="Ouvrir les autres sections"/);
});

test("Plus is active on secondary pages and closes after navigation", async () => {
  const content = await readFile(appPath, "utf8");
  assert.match(content, /MOBILE_SECONDARY_PAGES\.includes\(page\) \? "MORE"/);
  assert.match(content, /selected=\{item\.page === page/);
  assert.match(content, /navigateToPage\(item\.page\);[\s\S]*setMoreDrawerOpen\(false\);/);
  assert.match(content, /onClose=\{\(\) => setMoreDrawerOpen\(false\)\}/);
});

test("browser history, refresh and back navigation are wired without replacing desktop navigation", async () => {
  const content = await readFile(appPath, "utf8");
  assert.match(content, /getPageFromLocation\(typeof window/);
  assert.match(content, /window\.history\[replace \? "replaceState" : "pushState"\]/);
  assert.match(content, /window\.addEventListener\("popstate", handlePopState\)/);
  assert.match(content, /window\.removeEventListener\("popstate", handlePopState\)/);
  assert.match(content, /value=\{PAGE_ORDER\.indexOf\(page\)\}/);
  assert.match(content, /onChange=\{\(event, value\) => navigateToPage\(PAGE_ORDER\[value\]\)\}/);
});

test("Plus has no duplicate summary alias and retains all secondary module entries", async () => {
  const content = await readFile(appPath, "utf8");
  assert.doesNotMatch(content, /key: "COMPTES"/);
  for (const label of [
    "Catégories", "Référentiels", "Frais fixes", "Revenus récurrents", "Opportunités",
    "Dettes et créances", "Objectifs", "Prévisions", "Analyse", "Historique des imports", "Paramètres",
  ]) {
    assert.equal(content.includes(`label: "${label}"`), true, label);
  }
});
