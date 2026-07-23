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
  assert.equal(payload.initialAmount, 59.9);
  assert.equal(payload.frequency, "monthly");
  assert.equal(payload.startDate, "2026-07-13");
  assert.equal(payload.endDate, null);
  assert.equal(payload.variations.length, 0);
});
