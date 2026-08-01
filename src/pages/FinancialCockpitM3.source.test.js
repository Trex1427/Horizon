import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { calculateProfessionalDashboard } from "../services/professionalDashboardService.js";
import { calculateAnnualTrajectory } from "../services/annualTrajectoryService.js";

const read = (path) => readFile(resolve(process.cwd(), path), "utf8");

test("M3 pending quotes summary excludes accepted and soft-deleted quotes", () => {
  const result = calculateProfessionalDashboard({
    quotes: [
      { id: "pending", status: "pending", amount: 1200 },
      { id: "accepted", status: "accepted", amount: 800 },
      { id: "deleted", status: "pending", amount: 900, isDeleted: true },
    ], projects: [], invoices: [], transactions: [], activities: [], thirdParties: [],
  });
  assert.equal(result.alerts.quotesToFollowUp.length, 1);
  assert.equal(result.alerts.quotesToFollowUp[0].id, "pending");
  assert.equal(result.alerts.quotesToFollowUp.reduce((sum, quote) => sum + quote.amount, 0), 1200);
});


test("M3 pending quotes never inflate the annual trajectory", () => {
  const rows = calculateAnnualTrajectory({
    accounts: [{ id: "cash", initialBalance: 100, isActive: true }],
    quotes: [{ id: "quote", status: "pending", amount: 50000 }],
    year: 2026,
    referenceDate: new Date(2026, 7, 1),
  });
  assert.equal(rows.at(-1).closingBalance, 100);
  assert.equal(rows.every((row) => row.monthlyIncome === 0), true);
});
test("M3 home no longer subscribes to opportunities or feeds them to trajectory", async () => {
  const [home, forecast] = await Promise.all([read("src/pages/FinancialHome.jsx"), read("src/hooks/useForecast.js")]);
  assert.equal(home.includes("useOpportunities"), false);
  assert.equal(forecast.includes("useOpportunities"), false);
  assert.equal(home.includes("opportunities:"), false);
  assert.equal(home.includes("useWorkQuotes({ includeDocuments: false })"), true);
});

test("M3 removes Opportunities from user navigation while keeping legacy route compatibility", async () => {
  const [navigation, app] = await Promise.all([read("src/navigation/appNavigation.js"), read("src/App.jsx")]);
  const order = navigation.slice(navigation.indexOf("export const PAGE_ORDER"), navigation.indexOf("export const MOBILE_PRIMARY_PAGES"));
  assert.equal(order.includes("PAGES.OPPORTUNITES"), false);
  assert.equal(app.includes('label: "Opportunités"'), false);
  assert.equal(app.includes("page === PAGES.OPPORTUNITES"), true);
});

test("M3 cockpit prioritizes month-end forecast and exposes responsive destinations", async () => {
  const cockpit = await read("src/components/HorizonCockpit.jsx");
  assert.equal(cockpit.includes('title="Solde prévu fin de mois"'), true);
  assert.equal(cockpit.includes("priority={1}"), true);
  assert.equal(cockpit.includes("daysUntilMonthEnd"), true);
  assert.equal(cockpit.includes("À surveiller"), true);
  assert.equal(cockpit.includes('gridTemplateColumns: { xs: "1fr"'), true);
  for (const label of ["Transactions", "Prévisions", "Analyse", "Comptes", "Devis", "Factures"]) assert.equal(cockpit.includes(`>${label}</Button>`), true);
});

test("M3 analysis protects narrow layouts and keeps primary financial sections", async () => {
  const analysis = await read("src/pages/Analyse.jsx");
  assert.equal(analysis.includes('overflowX: "hidden"'), true);
  for (const label of ["Dépenses", "Revenus", "Épargne", "Graphiques", "Classements"]) assert.equal(analysis.includes(label), true);
});
