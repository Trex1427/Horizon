import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
test("Travail exposes all V1 sections and mobile card quote list", async () => {
  const source = await readFile(resolve(root, "src/pages/Travail.jsx"), "utf8");
  for (const label of ["Tableau de bord", "Devis", "Dossiers", "Factures", "Activités professionnelles", "Paramètres"]) assert.equal(source.includes(label), true, label);
  assert.equal(source.includes("Importer un devis Tiiime"), true);
  assert.equal(source.includes("<Card variant=\"outlined\" key={quote.id}"), true);
  assert.equal(source.includes("<table"), false);
});

test("shared quote form supports manual/imported drafts, filters, PDF and dossier creation", async () => {
  const source = await readFile(resolve(root, "src/pages/Travail.jsx"), "utf8");
  for (const label of ["Activité professionnelle", "Tiers", "Numéro du devis", "Date", "Montant", "Statut"]) assert.equal(source.includes(label), true, label);
  assert.equal(source.includes("matchThirdParties"), true);
  assert.equal(source.includes("Créer le dossier"), true);
  assert.equal(source.includes("archiveQuote"), true);
  assert.equal(source.includes("openWorkQuoteDocument"), true);
});

test("navigation registers Travail with direct URL and primary mobile access", async () => {
  const navigation = await readFile(resolve(root, "src/navigation/appNavigation.js"), "utf8");
  const app = await readFile(resolve(root, "src/App.jsx"), "utf8");
  assert.equal(navigation.includes('TRAVAIL: "TRAVAIL"'), true);
  assert.equal(navigation.includes('[PAGES.TRAVAIL]: "travail"'), true);
  assert.equal(app.includes("page === PAGES.TRAVAIL && <Travail onOpenTransaction="), true);
  assert.equal(app.includes('value={PAGES.TRAVAIL} label="Travail"'), true);
});

test("professional records are separate from transactional activities and use ownerUid guards", async () => {
  const service = await readFile(resolve(root, "src/services/professionalActivitiesService.js"), "utf8");
  const quoteService = await readFile(resolve(root, "src/services/workQuotesService.js"), "utf8");
  assert.equal(service.includes('"professionalActivities"'), true);
  assert.equal(service.includes('"activities"'), false);
  assert.equal(service.includes("where(\"ownerUid\", \"==\", ownerUid)"), true);
  assert.equal(quoteService.includes("withOwnerUidForCreate"), true);
  assert.equal(quoteService.includes("deletedAt: now"), true);
  assert.equal(quoteService.includes("users/${ownerUid}/documents/quotes/"), true);
});
