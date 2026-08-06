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

test("validateFixedExpenseForm rejects invalid amountType", () => {
  const errors = validateFixedExpenseForm({
    name: "EDF",
    categoryId: "dep-1",
    accountId: "acc-1",
    initialAmount: "30",
    startDate: "2026-01-01",
    amountType: "unexpected",
  });

  assert.equal(errors.amountType, "Le type de montant est invalide");
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
      amountType: "variable",
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
  assert.equal(payload.amountType, "variable");
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

test("buildFixedExpensePayload persists a compatible optional subcategory", () => {
  const payload = buildFixedExpensePayload({
    name: "EDF",
    categoryId: "dep-1",
    subcategoryId: "electricity",
    accountId: "acc-1",
    initialAmount: "120",
    startDate: "2026-07-01",
  }, categories, null, [
    { id: "electricity", name: "Électricité", categoryId: "dep-1", isActive: true },
  ]);

  assert.equal(payload.subcategoryId, "electricity");
  assert.equal(payload.subcategoryName, "Électricité");
});

test("buildFixedExpensePayload keeps legacy category-only fixed expenses compatible", () => {
  const payload = buildFixedExpensePayload({
    name: "Loyer",
    categoryId: "dep-1",
    accountId: "acc-1",
    initialAmount: "700",
    startDate: "2026-07-01",
  }, categories);

  assert.equal(payload.subcategoryId, null);
  assert.equal(payload.subcategoryName, null);
  assert.equal(payload.amountType, "fixed");
});