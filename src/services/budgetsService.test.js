import test from "node:test";
import assert from "node:assert/strict";
import { areBudgetsSameEnvelope, buildBudgetWritePayload, findDuplicateBudgetEnvelope, resolveBudgetDateRange } from "./budgetModel.js";

function toLocalDateString(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

const baseBudget = {
  id: "global",
  accountId: "main",
  categoryId: "housing",
  subcategoryId: null,
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  periodType: "mensuel",
  typeBudget: "depense",
  isActive: true,
};

test("budget payload persists optional subcategory names using existing conventions", () => {
  const categoryBudget = buildBudgetWritePayload({ ...baseBudget, amount: 1000, categoryName: "Logement" });
  assert.equal(categoryBudget.subcategoryId, null);
  assert.equal(categoryBudget.subcategoryName, null);

  const detailedBudget = buildBudgetWritePayload({
    ...baseBudget, amount: 150, categoryName: "Logement", subcategoryId: "electricity", subcategoryName: "Electricite",
  });
  assert.equal(detailedBudget.subcategoryId, "electricity");
  assert.equal(detailedBudget.subcategoryName, "Electricite");
});

test("identical envelopes are duplicates while category and subcategory budgets may coexist", () => {
  const same = { ...baseBudget, id: "copy" };
  const detailed = { ...baseBudget, id: "electricity", subcategoryId: "electricity" };
  assert.equal(areBudgetsSameEnvelope(baseBudget, same), true);
  assert.equal(areBudgetsSameEnvelope(baseBudget, detailed), false);
  assert.equal(findDuplicateBudgetEnvelope([baseBudget], same)?.id, "global");
  assert.equal(findDuplicateBudgetEnvelope([baseBudget], detailed), null);
});

test("budget uniqueness remains isolated by account and period", () => {
  assert.equal(areBudgetsSameEnvelope(baseBudget, { ...baseBudget, accountId: "savings" }), false);
  assert.equal(areBudgetsSameEnvelope(baseBudget, { ...baseBudget, startDate: "2026-01-20" }), true);
  assert.equal(areBudgetsSameEnvelope(baseBudget, { ...baseBudget, startDate: "2027-01-01" }), false);
  assert.equal(findDuplicateBudgetEnvelope([baseBudget], { ...baseBudget }, "global"), null);
});

test("budget payload persists periodicity and rolling period fields", () => {
  const payload = buildBudgetWritePayload({
    ...baseBudget,
    periodicity: "quarterly",
    rollingPeriod: true,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
  });

  assert.equal(payload.periodicity, "quarterly");
  assert.equal(payload.rollingPeriod, true);
  assert.equal(payload.periodType, "trimestriel");
  assert.equal(payload.endDate, null);
});

test("custom budget payload keeps explicit end date", () => {
  const payload = buildBudgetWritePayload({
    ...baseBudget,
    periodicity: "custom",
    rollingPeriod: false,
    startDate: "2026-03-01",
    endDate: "2026-03-31",
  });

  assert.equal(payload.periodicity, "custom");
  assert.equal(payload.endDate, "2026-03-31");
});

test("resolved budget date range follows configured periodicity", () => {
  const monthly = resolveBudgetDateRange({ periodicity: "monthly" }, new Date("2026-08-15T12:00:00.000Z"));
  const quarterly = resolveBudgetDateRange({ periodicity: "quarterly" }, new Date("2026-08-15T12:00:00.000Z"));
  const semiAnnual = resolveBudgetDateRange({ periodicity: "semiAnnual" }, new Date("2026-08-15T12:00:00.000Z"));
  const annual = resolveBudgetDateRange({ periodicity: "annual" }, new Date("2026-08-15T12:00:00.000Z"));

  assert.equal(toLocalDateString(monthly.startDate), "2026-08-01");
  assert.equal(toLocalDateString(quarterly.startDate), "2026-07-01");
  assert.equal(toLocalDateString(semiAnnual.startDate), "2026-07-01");
  assert.equal(toLocalDateString(annual.startDate), "2026-01-01");
});
