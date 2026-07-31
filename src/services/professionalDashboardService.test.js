import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateProfessionalDashboard,
  filterAndSortDashboardProjects,
} from "./professionalDashboardService.js";

const data = {
  activities: [{ id: "a1", name: "Conseil" }],
  thirdParties: [{ id: "c1", name: "Acme" }],
  quotes: [
    { id: "q1", amount: 1_500, status: "accepted" },
    { id: "q2", amount: 400, status: "pending" },
  ],
  projects: [
    {
      id: "p1", quoteId: "q1", name: "Mission Alpha", thirdPartyId: "c1",
      professionalActivityId: "a1", plannedRevenue: 1_500, plannedExpenses: 300,
      status: "in_progress",
    },
    {
      id: "p2", name: "Mission Beta", plannedRevenue: 200, plannedExpenses: 250,
      status: "planned",
    },
  ],
  invoices: [
    { id: "i1", workProjectId: "p1", status: "paid", amountHT: 1_000, amountTTC: 1_200 },
    { id: "i2", workProjectId: "p1", status: "pending_payment", dueDate: "2026-07-01", amountHT: 250, amountTTC: 300 },
    { id: "i3", workProjectId: "p1", status: "cancelled", amountHT: 999, amountTTC: 1_198.8 },
  ],
  transactions: [
    { id: "t1", workProjectId: "p1", type: "depense", montant: -200 },
    { id: "t2", workProjectId: "p1", type: "revenu", montant: 1_200 },
    { id: "t3", workProjectId: "p1", type: "depense", montant: 500, isDeleted: true },
  ],
};

test("calcule les KPI du dashboard sans inclure les éléments annulés ou supprimés", () => {
  const dashboard = calculateProfessionalDashboard(data, { today: new Date("2026-07-31T12:00:00Z") });

  assert.deepEqual(dashboard.kpis.revenue, {
    ht: 1_250,
    ttc: 1_500,
    received: 1_200,
    outstanding: 300,
  });
  assert.deepEqual(dashboard.kpis.profitability, {
    plannedMargin: 1_150,
    actualMargin: 1_050,
    marginRate: 84,
  });
  assert.deepEqual(dashboard.kpis.activity, { quotes: 2, projects: 2, invoices: 2 });
  assert.deepEqual(dashboard.kpis.collections, { paid: 1, pending: 1, overdue: 1 });
  assert.equal(dashboard.alerts.quotesToFollowUp[0].id, "q2");
});

test("construit une ligne par dossier avec marge réelle ou prévisionnelle", () => {
  const rows = calculateProfessionalDashboard(data).projects;
  assert.deepEqual(rows[0], {
    id: "p1",
    name: "Mission Alpha",
    client: "Acme",
    activity: "Conseil",
    quoteAmount: 1_500,
    billed: 1_250,
    billedTTC: 1_500,
    received: 1_200,
    expenses: 200,
    plannedMargin: 1_200,
    actualMargin: 1_050,
    margin: 1_050,
    profitabilityRate: 84,
    profitabilityKind: "actual",
    status: "in_progress",
    statusLabel: "En cours",
  });
  assert.equal(rows[1].margin, -50);
  assert.equal(rows[1].profitabilityRate, -25);
  assert.equal(rows[1].profitabilityKind, "forecast");
});

test("recherche sur les libellés et trie les montants sans muter les lignes", () => {
  const rows = calculateProfessionalDashboard(data).projects;
  const initialOrder = rows.map((row) => row.id);
  const result = filterAndSortDashboardProjects(rows, {
    search: "mission",
    sort: { key: "margin", direction: "asc" },
  });

  assert.deepEqual(result.map((row) => row.id), ["p2", "p1"]);
  assert.deepEqual(rows.map((row) => row.id), initialOrder);
  assert.equal(filterAndSortDashboardProjects(rows, { search: "ACME" }).length, 1);
});
