import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const files = {
  compactCard: resolve(process.cwd(), "src/components/CompactFinanceCard.jsx"),
  fixedCard: resolve(process.cwd(), "src/components/FixedExpenseCard.jsx"),
  recurringCard: resolve(process.cwd(), "src/components/RecurringIncomeCard.jsx"),
  opportunityCard: resolve(process.cwd(), "src/components/OpportunityCard.jsx"),
  fixedPage: resolve(process.cwd(), "src/pages/FraisFixes.jsx"),
  recurringPage: resolve(process.cwd(), "src/pages/RevenusRecurrents.jsx"),
  opportunityPage: resolve(process.cwd(), "src/pages/Opportunites.jsx"),
  payloads: resolve(process.cwd(), "src/services/opportunityPayloads.js"),
};

test("Flux previsionnels cards expose explicit nature badges", async () => {
  const compactCard = await readFile(files.compactCard, "utf8");
  const fixedCard = await readFile(files.fixedCard, "utf8");
  const recurringCard = await readFile(files.recurringCard, "utf8");
  const opportunityCard = await readFile(files.opportunityCard, "utf8");

  assert.equal(compactCard.includes('label: "Dépense fixe"'), true);
  assert.equal(compactCard.includes('label: "Revenu récurrent"'), true);
  assert.equal(compactCard.includes('label: "Revenu futur"'), true);
  assert.equal(fixedCard.includes('transactionKind="fixedExpense"'), true);
  assert.equal(recurringCard.includes('transactionKind="recurringIncome"'), true);
  assert.equal(opportunityCard.includes('transactionKind="futureIncome"'), true);
});

test("Opportunities never persist or reuse a transaction type for display", async () => {
  const opportunityCard = await readFile(files.opportunityCard, "utf8");
  const payloads = await readFile(files.payloads, "utf8");

  assert.equal(opportunityCard.includes("opportunity.type"), false);
  assert.equal(opportunityCard.includes('transactionKind="futureIncome"'), true);
  assert.equal(payloads.includes("type:"), false);
});

test("Flux previsionnels pages share header summary search list and existing actions", async () => {
  const fixedPage = await readFile(files.fixedPage, "utf8");
  const recurringPage = await readFile(files.recurringPage, "utf8");
  const opportunityPage = await readFile(files.opportunityPage, "utf8");

  for (const content of [fixedPage, recurringPage, opportunityPage]) {
    assert.equal(content.includes("PilotagePageShell") || content.includes("AppPage"), true);
    assert.equal(content.includes("PilotageHeader") || content.includes("AppToolbar"), true);
    assert.equal(content.includes("PilotageSummary") || content.includes("AppStatCard"), true);
    assert.equal(content.includes("PilotageSection") || content.includes("AppSection"), true);
    assert.equal(content.includes("searchValue={searchText}") || content.includes("value={searchText}"), true);
    assert.equal(content.includes("enableDoubleClickEdit={enableDesktopDoubleClickEdit}"), true);
  }

  assert.equal(fixedPage.includes("Rechercher un frais fixe"), true);
  assert.equal(recurringPage.includes("Rechercher un revenu récurrent"), true);
  assert.equal(opportunityPage.includes("Rechercher une opportunité"), true);
  assert.equal(opportunityPage.includes("onCreateTransaction={openTransactionForOpportunity}"), true);
  assert.equal(opportunityPage.includes("onOpenTransaction={openExistingTransaction}"), true);
});

test("Flux previsionnels empty states and statuses are visible text", async () => {
  const fixedCard = await readFile(files.fixedCard, "utf8");
  const recurringCard = await readFile(files.recurringCard, "utf8");
  const opportunityCard = await readFile(files.opportunityCard, "utf8");
  const fixedPage = await readFile(files.fixedPage, "utf8");
  const recurringPage = await readFile(files.recurringPage, "utf8");
  const opportunityPage = await readFile(files.opportunityPage, "utf8");

  assert.equal(fixedCard.includes("Actif"), true);
  assert.equal(fixedCard.includes("Inactif"), true);
  assert.equal(recurringCard.includes("Terminé"), true);
  assert.equal(opportunityCard.includes("À étudier"), true);
  assert.equal(opportunityCard.includes("Non incluse - opportunité abandonnée"), true);
  assert.equal(fixedPage.includes("Aucune correspondance de recherche."), true);
  assert.equal(recurringPage.includes("Aucune correspondance de recherche."), true);
  assert.equal(opportunityPage.includes("Aucune correspondance de recherche."), true);
});
