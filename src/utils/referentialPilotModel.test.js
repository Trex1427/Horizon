import test from "node:test";
import assert from "node:assert/strict";
import { buildReferentialPilotData, filterReferentialDetails, sortReferentialDetails } from "./referentialPilotModel.js";

function buildFixture() {
  const categories = [{ id: "cat-1", name: "Transport", type: "depense", isActive: true, createdAt: "2026-01-01", updatedAt: "2026-02-01" }];
  const subcategories = [{ id: "sub-1", name: "Carburant", categoryId: "cat-1", type: "depense", isActive: true }];
  const thirdParties = [{ id: "tp-1", name: "Station Total", type: "supplier", isActive: true }];
  const activities = [{ id: "act-1", name: "Auto", kind: "profit_center", isActive: true }];
  const projects = [{ id: "proj-1", name: "Véhicule A", activityId: "act-1", isActive: true }];
  const fixedExpenses = [{ id: "fx-1", name: "Assurance", categoryId: "cat-1", subcategoryId: "sub-1", thirdPartyId: "tp-1", activityId: "act-1", projectId: "proj-1", isActive: true }];
  const recurringIncome = [{ id: "ri-1", name: "Salaire", categoryId: "cat-1", isActive: true }];
  const budgets = [{ id: "b-1", name: "Budget transport", categoryId: "cat-1", subcategoryId: "sub-1", isActive: true }];
  const transactions = [
    { id: "t-1", date: "2026-01-10", type: "depense", montant: 40, accountId: "acc-1", categoryId: "cat-1", subcategoryId: "sub-1", thirdPartyId: "tp-1", activityId: "act-1", projectId: "proj-1", fixedExpenseId: "fx-1", description: "Plein 1" },
    { id: "t-2", date: "2026-02-10", type: "depense", montant: 60, accountId: "acc-1", categoryId: "cat-1", subcategoryId: "sub-1", thirdPartyId: "tp-1", activityId: "act-1", projectId: "proj-1", description: "Plein 2" },
  ];
  const accounts = [{ id: "acc-1", name: "Compte courant" }];
  return { categories, subcategories, thirdParties, activities, projects, fixedExpenses, recurringIncome, budgets, transactions, accounts };
}

test("buildReferentialPilotData computes usage and statistics in memory", () => {
  const data = buildReferentialPilotData(buildFixture());
  const category = data.tabs.categories[0];

  assert.equal(category.usageCount >= 4, true);
  assert.equal(category.transactionRows.length, 2);
  assert.equal(category.stats.totalAmount, 100);
  assert.equal(category.stats.averageAmount, 50);
  assert.equal(category.stats.minAmount, 40);
  assert.equal(category.stats.maxAmount, 60);
  assert.equal(category.stats.monthsCount, 2);
});

test("buildReferentialPilotData exposes cross relations for categories", () => {
  const data = buildReferentialPilotData(buildFixture());
  const category = data.tabs.categories[0];

  assert.equal(category.relations.some((relation) => relation.label === "Sous-catégories"), true);
  assert.equal(category.relations.some((relation) => relation.label === "Tiers utilisés"), true);
  assert.equal(category.relations.some((relation) => relation.label === "Activités"), true);
  assert.equal(category.relations.some((relation) => relation.label === "Projets"), true);
});

test("filterReferentialDetails searches across names and relations", () => {
  const data = buildReferentialPilotData(buildFixture());
  const result = filterReferentialDetails(data.tabs.categories, "total");
  assert.equal(result.length, 1);
});

test("sortReferentialDetails supports last usage and total amount", () => {
  const data = buildReferentialPilotData(buildFixture());
  const sortedByAmount = sortReferentialDetails(data.tabs.categories, "totalAmount");
  const sortedByUsage = sortReferentialDetails(data.tabs.categories, "lastUsage");
  assert.equal(sortedByAmount.length, 1);
  assert.equal(sortedByUsage.length, 1);
});
