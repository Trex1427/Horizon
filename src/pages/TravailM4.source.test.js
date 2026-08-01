/* global process */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");

test("M4 Travail mobile navigation is compact, URL-backed and browser-aware", async () => {
  const source = await read("src/pages/Travail.jsx");
  assert.match(source, /label="Section Travail"/);
  assert.match(source, /params\.set\("section", nextSection\)/);
  assert.match(source, /window\.history\[replace \? "replaceState" : "pushState"\]/);
  assert.match(source, /window\.addEventListener\("popstate", onPopState\)/);
  assert.match(source, /SECTIONS\.some/);
});

test("M4 quote cards support touch, keyboard and desktop double click", async () => {
  const source = await read("src/pages/Travail.jsx");
  assert.match(source, /role="button" tabIndex=\{0\}/);
  assert.match(source, /if \(isMobile\) openQuote\(quote\)/);
  assert.match(source, /onDoubleClick=\{\(\) => \{ setPdfFile\(null\); setExtraction\(null\); setDialog\(\{ \.\.\.quote \}\); \}\}/);
  assert.match(source, /aria-label="Modifier le devis"/);
  assert.match(source, /minHeight: 44/);
});

test("M4 quote and activity dialogs become full screen with sticky actions on mobile", async () => {
  const source = await read("src/pages/Travail.jsx");
  assert.match(source, /fullScreen=\{isMobile\}/);
  assert.match(source, /position: "sticky", bottom: 0/);
  assert.match(source, /quote-dialog-title/);
  assert.match(source, /quickActivitySaving/);
  assert.match(source, /Créer et sélectionner/);
});

test("M4 invoice import and three-choice dialogs are mobile safe", async () => {
  const source = await read("src/features/work/WorkInvoicesViews.jsx");
  assert.match(source, /invoice-import-title/);
  assert.match(source, /fullScreen=\{isMobile\}/);
  assert.match(source, /Supprimer uniquement la facture/);
  assert.match(source, /Supprimer la facture et la transaction/);
  assert.match(source, /Marquer payée sans transaction/);
  assert.match(source, /Créer la transaction/);
  assert.match(source, /Repasser non payée et supprimer la transaction/);
});

test("M4 projects stay card-based and expose financial context without a mobile table", async () => {
  const source = await read("src/features/work/WorkProjectsViews.jsx");
  assert.doesNotMatch(source, /<table/i);
  for (const label of ["Dépenses prévues", "Marge prévue", "Dépenses réelles", "Marge réelle", "Marge prévisionnelle", "Factures", "Dépenses"]) {
    assert.equal(source.includes(label), true, label);
  }
  assert.match(source, /role="button" tabIndex=\{0\}/);
});

test("M4 dashboard reuses existing quote, project and invoice values", async () => {
  const source = await read("src/features/work/WorkProjectsViews.jsx");
  for (const label of ["Devis en attente", "Devis acceptés sans dossier", "CA signé", "CA facturé", "CA encaissé", "Créances", "Marge prévisionnelle", "Marge réelle"]) {
    assert.equal(source.includes(label), true, label);
  }
  assert.match(source, /calculateWorkProjectMetrics/);
  assert.match(source, /calculateInvoiceMetrics/);
});
