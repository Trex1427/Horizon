import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");

test("V1 routes are lazy-loaded behind one accessible Suspense fallback", async () => {
  const app = await read("src/App.jsx");
  const pageNames = [
    "Transactions", "Objectifs", "FraisFixes", "RevenusRecurrents", "Opportunites",
    "DettesCreances", "Budgets", "Analyse", "Previsions", "Categories", "Referentiels",
    "Parametres", "ImportHistory", "Travail", "Vehicles", "FinancialHome",
  ];

  for (const pageName of pageNames) {
    assert.equal(app.includes(`const ${pageName} = lazy(() => import("./pages/${pageName}"))`), true, pageName);
    assert.equal(app.includes(`import ${pageName} from "./pages/${pageName}"`), false, pageName);
  }

  assert.match(app, /<Suspense fallback=/);
  assert.match(app, /role="status" aria-live="polite"/);
  assert.match(app, /Chargement de la page/);
});

test("V1 document declares French content and safe-area viewport support", async () => {
  const html = await read("index.html");
  assert.match(html, /<html lang="fr">/);
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /name="theme-color"/);
});

test("V1 PWA keeps auto-update, manifest icons and offline app-shell precache", async () => {
  const vite = await read("vite.config.js");
  assert.match(vite, /registerType: 'autoUpdate'/);
  assert.match(vite, /icon-192\.svg/);
  assert.match(vite, /icon-512\.svg/);
  assert.match(vite, /globPatterns: \['\*\*\/\*\.\{js,css,html,svg,ico,png,webmanifest\}'\]/);
});