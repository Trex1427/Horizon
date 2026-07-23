import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFixedExpensePayload,
  buildRecurringIncomePayload,
  getExpenseCategoryOptions,
  getIncomeCategoryOptions,
  validateFixedExpenseForm,
  validateRecurringIncomeForm,
} from "./recurringAndFixedFormPayloads.js";

const categories = [
  { id: "dep-1", name: "Logement", type: "depense" },
  { id: "rev-1", name: "Salaire", type: "revenu" },
  { id: "tech-1", name: "Technique", type: "technical" },
];

test("getExpenseCategoryOptions keeps only depense categories", () => {
  const options = getExpenseCategoryOptions(categories);
  assert.deepEqual(options.map((entry) => entry.id), ["dep-1"]);
});

test("getIncomeCategoryOptions keeps only revenu categories", () => {
  const options = getIncomeCategoryOptions(categories);
  assert.deepEqual(options.map((entry) => entry.id), ["rev-1"]);
});

test("validateFixedExpenseForm reports required fields", () => {
  const errors = validateFixedExpenseForm({});
  assert.equal(errors.name, "Le nom est requis");
  assert.equal(errors.category, "La catégorie est requise");
  assert.equal(errors.accountId, "Le compte est requis");
  assert.equal(errors.initialAmount, "Un montant initial valide est requis");
  assert.equal(errors.startDate, "La date de début est requise");
});

test("validateRecurringIncomeForm reports required fields", () => {
  const errors = validateRecurringIncomeForm({});
  assert.equal(errors.name, "Le nom est requis");
  assert.equal(errors.category, "La catégorie est requise");
  assert.equal(errors.accountId, "Le compte est requis");
  assert.equal(errors.initialAmount, "Un montant initial valide est requis");
  assert.equal(errors.startDate, "La date de début est requise");
});

test("buildFixedExpensePayload normalizes values and preserves variations", () => {
  const payload = buildFixedExpensePayload(
    {
      name: "  EDF  ",
      categoryId: "dep-1",
      accountId: "acc-1",
      frequency: "annual",
      initialAmount: "120.5",
      startDate: "2026-07-01",
      endDate: "2026-12-31",
      description: "  facture  ",
      variations: [{ effectiveDate: "2026-08-01", amount: "30", note: "  ajustement  " }],
    },
    categories,
    null
  );

  assert.equal(payload.name, "EDF");
  assert.equal(payload.categoryId, "dep-1");
  assert.equal(payload.categoryName, "Logement");
  assert.equal(payload.category, "Logement");
  assert.equal(payload.description, "facture");
  assert.equal(payload.variations[0].note, "ajustement");
});

test("buildRecurringIncomePayload normalizes values and preserves variations", () => {
  const payload = buildRecurringIncomePayload(
    {
      name: "  Salaire  ",
      categoryId: "rev-1",
      accountId: "acc-1",
      frequency: "mensuel",
      initialAmount: "2000",
      startDate: "2026-07-01",
      endDate: "2026-12-31",
      variations: [{ effectiveDate: "2026-08-01", amount: "2100", note: "  prime  " }],
    },
    categories,
    null
  );

  assert.equal(payload.name, "Salaire");
  assert.equal(payload.categoryId, "rev-1");
  assert.equal(payload.categoryName, "Salaire");
  assert.equal(payload.category, "Salaire");
  assert.equal(payload.initialAmount, 2000);
  assert.equal(payload.variations[0].note, "prime");
});

test("France Travail creation keeps 1100 as a numeric amount after serialization", () => {
  const payload = buildRecurringIncomePayload({
    name: "France Travail",
    categoryId: "rev-1",
    accountId: "acc-1",
    frequency: "mensuel",
    initialAmount: "1100",
    startDate: "2026-08-01",
    variations: [],
  }, categories);

  const reloaded = JSON.parse(JSON.stringify(payload));
  assert.equal(payload.initialAmount, 1100);
  assert.equal(reloaded.initialAmount, 1100);
});
