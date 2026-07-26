import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDebtReceivableCreatePayload,
  buildDebtReceivablePayload,
  calculateDebtsReceivablesSummary,
  calculateReceivableCashImpact,
  enrichDebtReceivableWithPayments,
  validateDebtReceivable,
} from "./debtsReceivablesModel.js";

const valid = { type: "debt", label: " Prêt ", amount: "500.25", thirdPartyId: "tp-bank", categoryId: "cat-debt", initialCategoryId: null, initialAccountId: null, initialDate: null, dueDate: "2026-09-30", notes: " Note " };
const now = new Date("2026-07-25T10:00:00Z");

test("creates the minimal normalized model", () => {
  const payload = buildDebtReceivableCreatePayload(valid, now);
  assert.deepEqual(payload, {
    type: "debt", label: "Prêt", amount: 500.25, thirdPartyId: "tp-bank", categoryId: "cat-debt", initialCategoryId: null, initialAccountId: null, initialDate: null, dueDate: "2026-09-30",
    notes: "Note", updatedAt: now, createdAt: now, isDeleted: false, paymentsRevision: 0,
  });
});

test("update payload cannot carry ownerUid or deletion fields", () => {
  const payload = buildDebtReceivablePayload({ ...valid, ownerUid: "attacker", status: "closed", isDeleted: true }, now);
  assert.equal("status" in payload, false);
  assert.equal("ownerUid" in payload, false);
  assert.equal("isDeleted" in payload, false);
});

test("validations reject required fields, zero, negative, non-finite and invalid dates", () => {
  for (const amount of [0, -1, "bad", Infinity]) assert.ok(validateDebtReceivable({ ...valid, amount }).amount);
  const errors = validateDebtReceivable({ type: "", label: " ", amount: 1, thirdPartyId: "", categoryId: "", dueDate: "2026-02-31" });
  assert.deepEqual(Object.keys(errors).sort(), ["categoryId", "dueDate", "label", "thirdPartyId", "type"]);
});

test("new documents no longer require counterparty text", () => {
  const errors = validateDebtReceivable({
    type: "receivable",
    label: "Remboursement",
    amount: 120,
    thirdPartyId: "tp-1", categoryId: "cat-1",
    counterparty: "",
    dueDate: null,
  });
  assert.equal(errors.counterparty, undefined);
  assert.equal(errors.thirdPartyId, undefined);
});

test("legacy counterparty-only documents remain readable for compatibility", () => {
  const legacyItem = {
    type: "debt",
    label: "Dette legacy",
    amount: 300,
    counterparty: "Ancienne contrepartie",
    dueDate: null,
    isDeleted: false,
    functionalStatus: "unpaid",
  };

  const summary = calculateDebtsReceivablesSummary([legacyItem]);
  assert.deepEqual(summary, { debts: 300, receivables: 0, net: -300 });
});

test("summary handles decimals, large values, deleted data and returns to zero", () => {
  assert.deepEqual(calculateDebtsReceivablesSummary([
    { type: "debt", amount: 500.25, functionalStatus: "unpaid", isDeleted: false },
    { type: "receivable", amount: 800.75, functionalStatus: "partial", isDeleted: false },
    { type: "debt", amount: 999, functionalStatus: "unpaid", isDeleted: true },
    { type: "receivable", amount: Infinity, functionalStatus: "unpaid", isDeleted: false },
    { type: "receivable", amount: 1_000_000_000, functionalStatus: "paid", isDeleted: false },
  ]), { debts: 500.25, receivables: 800.75, net: 300.5 });
  assert.deepEqual(calculateDebtsReceivablesSummary([]), { debts: 0, receivables: 0, net: 0 });
});

test("recette arithmetic follows 500/800 then 600/800", () => {
  assert.equal(calculateDebtsReceivablesSummary([
    { type: "debt", amount: 500, functionalStatus: "unpaid" }, { type: "receivable", amount: 800, functionalStatus: "unpaid" },
  ]).net, 300);
  assert.equal(calculateDebtsReceivablesSummary([
    { type: "debt", amount: 600, functionalStatus: "partial" }, { type: "receivable", amount: 800, functionalStatus: "unpaid" },
  ]).net, 200);
});

test("computed amounts and functional status are derived from active payments only", () => {
  const enriched = enrichDebtReceivableWithPayments(
    { id: "d1", amount: 100 },
    [
      { amount: 20, isDeleted: false },
      { amount: 30.5, isDeleted: false },
      { amount: 10, isDeleted: true },
    ],
  );

  assert.equal(enriched.paidAmount, 50.5);
  assert.equal(enriched.remainingAmount, 49.5);
  assert.equal(enriched.functionalStatus, "partial");
});
test("receivable initial outflow and repayments produce the expected net cash impact", () => {
  const payload = buildDebtReceivableCreatePayload({
    type: "receivable", label: "Julie", amount: 900, thirdPartyId: "tp-julie",
    categoryId: "cat-refund", initialCategoryId: "cat-loan", initialAccountId: "acc-bank",
    initialDate: "2026-07-26", dueDate: null,
  }, now);
  assert.equal(payload.amount, 900);
  assert.equal(payload.initialCategoryId, "cat-loan");
  assert.equal(payload.initialAccountId, "acc-bank");
  assert.equal(calculateReceivableCashImpact(900, [{ amount: 200, isDeleted: false }]), -700);
  const remaining = enrichDebtReceivableWithPayments({ amount: 900 }, [{ amount: 400, isDeleted: false }]);
  assert.equal(remaining.paidAmount, 400);
  assert.equal(remaining.remainingAmount, 500);
  assert.equal(calculateReceivableCashImpact(900, [{ amount: 200, isDeleted: true }]), -900);
});