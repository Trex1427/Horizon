import test from "node:test";
import assert from "node:assert/strict";
import {
  applyFixedExpenseToTransactionForm,
  buildQuickFixedExpensePayload,
  findMatchingFixedExpenseForTransaction,
  getFixedExpenseApplicableAmount,
} from "./transactionFixedExpenseLinking.js";

test("getFixedExpenseApplicableAmount uses latest variation before target date", () => {
  const amount = getFixedExpenseApplicableAmount(
    {
      initialAmount: 45,
      variations: [
        { effectiveDate: "2026-07-01", amount: 60 },
        { effectiveDate: "2026-05-01", amount: 50 },
      ],
    },
    "2026-07-13"
  );

  assert.equal(amount, 60);
});

test("findMatchingFixedExpenseForTransaction matches expense by account/category/amount and month", () => {
  const match = findMatchingFixedExpenseForTransaction(
    {
      id: "tx-1",
      date: "2026-07-13",
      type: "depense",
      montant: 60,
      accountId: "acc-1",
      categoryId: "cat-sub",
      categoryName: "Abonnements",
    },
    [
      {
        id: "fx-1",
        accountId: "acc-1",
        categoryId: "cat-sub",
        categoryName: "Abonnements",
        initialAmount: 60,
        isActive: true,
        startDate: "2026-01-01",
        frequency: "monthly",
      },
    ]
  );

  assert.equal(match?.id, "fx-1");
});

test("applyFixedExpenseToTransactionForm enables fixed-expense flag and preserves unrelated fields", () => {
  const sourceDraft = {
    date: "2026-07-13",
    montant: "25",
    type: "depense",
    categorie: "Transport",
    categoryId: "cat-tr",
    categoryName: "Transport",
    accountId: "acc-legacy",
    description: "Paiement facture",
    thirdPartyId: "tp-1",
    isFixedExpense: false,
    fixedExpenseId: "",
  };

  const nextDraft = applyFixedExpenseToTransactionForm(
    sourceDraft,
    {
      id: "fx-telecom",
      accountId: "acc-1",
      categoryId: "cat-sub",
      categoryName: "Abonnements",
      initialAmount: 42,
    },
    "2026-07-13"
  );

  assert.equal(nextDraft.isFixedExpense, true);
  assert.equal(nextDraft.fixedExpenseId, "fx-telecom");
  assert.equal(nextDraft.categoryId, "cat-sub");
  assert.equal(nextDraft.categoryName, "Abonnements");
  assert.equal(nextDraft.categorie, "Abonnements");
  assert.equal(nextDraft.accountId, "acc-1");
  assert.equal(nextDraft.montant, "42");
  assert.equal(nextDraft.description, "Paiement facture");
  assert.equal(nextDraft.thirdPartyId, "tp-1");
  assert.equal(sourceDraft.fixedExpenseId, "");
  assert.equal(sourceDraft.categoryId, "cat-tr");
});

test("buildQuickFixedExpensePayload derives fixed-expense model from transaction draft", () => {
  const payload = buildQuickFixedExpensePayload(
    {
      date: "2026-07-13",
      montant: "59.9",
      categoryId: "cat-sub",
      categoryName: "Abonnements",
      accountId: "acc-1",
    },
    {
      name: "Abonnement internet",
      frequency: "monthly",
      startDate: "2026-07-13",
      endDate: "",
      description: "Box",
    }
  );

  assert.equal(payload.name, "Abonnement internet");
  assert.equal(payload.categoryId, "cat-sub");
  assert.equal(payload.categoryName, "Abonnements");
  assert.equal(payload.accountId, "acc-1");
  assert.equal(payload.amountType, "fixed");
  assert.equal(payload.initialAmount, 59.9);
  assert.equal(payload.frequency, "monthly");
  assert.equal(payload.startDate, "2026-07-13");
  assert.equal(payload.endDate, null);
  assert.equal(payload.variations.length, 0);
});

test("legacy matching requires the same subcategory when the fixed expense defines one", () => {
  const fixedExpenses = [
    { id: "fx-electricity", accountId: "acc-1", categoryId: "housing", subcategoryId: "electricity", initialAmount: 120, isActive: true },
    { id: "fx-water", accountId: "acc-1", categoryId: "housing", subcategoryId: "water", initialAmount: 120, isActive: true },
  ];
  const transaction = { date: "2026-07-13", type: "depense", montant: 120, accountId: "acc-1", categoryId: "housing", subcategoryId: "electricity" };

  assert.equal(findMatchingFixedExpenseForTransaction(transaction, fixedExpenses)?.id, "fx-electricity");
  assert.equal(findMatchingFixedExpenseForTransaction({ ...transaction, subcategoryId: "insurance" }, fixedExpenses), null);
  assert.equal(findMatchingFixedExpenseForTransaction({ ...transaction, subcategoryId: "" }, fixedExpenses), null);
});

test("explicit fixedExpenseId remains prioritary and form synchronization copies subcategory", () => {
  const fixedExpenses = [
    { id: "fx-electricity", accountId: "acc-1", categoryId: "housing", categoryName: "Logement", subcategoryId: "electricity", subcategoryName: "Électricité", initialAmount: 120, isActive: true },
  ];
  const transaction = { fixedExpenseId: "fx-electricity", date: "2026-07-13", type: "depense", montant: 999, accountId: "other", categoryId: "other" };
  assert.equal(findMatchingFixedExpenseForTransaction(transaction, fixedExpenses)?.id, "fx-electricity");

  const draft = applyFixedExpenseToTransactionForm({ date: "2026-07-13" }, fixedExpenses[0]);
  assert.equal(draft.subcategoryId, "electricity");
  assert.equal(draft.subcategoryName, "Électricité");
});

test("variable fixed expenses can match a nearby date with a different amount", () => {
  const fixedExpenses = [
    {
      id: "fx-orange",
      accountId: "acc-1",
      name: "Orange",
      thirdPartyName: "Orange",
      amountType: "variable",
      initialAmount: 29.99,
      startDate: "2026-01-05",
      isActive: true,
    },
  ];

  const transaction = {
    date: "2026-07-06",
    type: "depense",
    montant: 34.99,
    accountId: "acc-1",
    merchant: "Orange",
    description: "ORANGE FACTURE",
  };

  assert.equal(findMatchingFixedExpenseForTransaction(transaction, fixedExpenses)?.id, "fx-orange");
});