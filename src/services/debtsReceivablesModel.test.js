import test from "node:test";
import assert from "node:assert/strict";
import { buildDebtReceivableCreatePayload, buildDebtReceivablePayload, calculateDebtsReceivablesSummary, validateDebtReceivable } from "./debtsReceivablesModel.js";

const valid = { type: "debt", label: " Prêt ", amount: "500.25", counterparty: " Banque ", dueDate: "2026-09-30", notes: " Note " };
const now = new Date("2026-07-25T10:00:00Z");

test("creates the minimal normalized model", () => {
  const payload = buildDebtReceivableCreatePayload(valid, now);
  assert.deepEqual(payload, {
    type: "debt", label: "Prêt", amount: 500.25, counterparty: "Banque", dueDate: "2026-09-30",
    notes: "Note", status: "open", updatedAt: now, createdAt: now, isDeleted: false,
  });
});

test("update payload cannot carry ownerUid, status or deletion fields", () => {
  const payload = buildDebtReceivablePayload({ ...valid, ownerUid: "attacker", status: "closed", isDeleted: true }, now);
  assert.equal(payload.status, "open");
  assert.equal("ownerUid" in payload, false);
  assert.equal("isDeleted" in payload, false);
});

test("validations reject required fields, zero, negative, non-finite and invalid dates", () => {
  for (const amount of [0, -1, "bad", Infinity]) assert.ok(validateDebtReceivable({ ...valid, amount }).amount);
  const errors = validateDebtReceivable({ type: "", label: " ", amount: 1, counterparty: "", dueDate: "2026-02-31" });
  assert.deepEqual(Object.keys(errors).sort(), ["counterparty", "dueDate", "label", "type"]);
});

test("summary handles decimals, large values, deleted data and returns to zero", () => {
  assert.deepEqual(calculateDebtsReceivablesSummary([
    { type: "debt", amount: 500.25, status: "open", isDeleted: false },
    { type: "receivable", amount: 800.75, status: "open", isDeleted: false },
    { type: "debt", amount: 999, status: "open", isDeleted: true },
    { type: "receivable", amount: Infinity, status: "open", isDeleted: false },
    { type: "receivable", amount: 1_000_000_000, status: "closed", isDeleted: false },
  ]), { debts: 500.25, receivables: 800.75, net: 300.5 });
  assert.deepEqual(calculateDebtsReceivablesSummary([]), { debts: 0, receivables: 0, net: 0 });
});

test("recette arithmetic follows 500/800 then 600/800", () => {
  assert.equal(calculateDebtsReceivablesSummary([
    { type: "debt", amount: 500, status: "open" }, { type: "receivable", amount: 800, status: "open" },
  ]).net, 300);
  assert.equal(calculateDebtsReceivablesSummary([
    { type: "debt", amount: 600, status: "open" }, { type: "receivable", amount: 800, status: "open" },
  ]).net, 200);
});
