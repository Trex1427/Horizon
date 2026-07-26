import test from "node:test";
import assert from "node:assert/strict";
import {
  areFixedExpensesCompatible,
  buildFixedExpenseDocumentId,
  findCompatibleFixedExpenses,
  normalizeFixedExpenseName,
} from "./fixedExpenseIdentity.js";

const telephone = {
  name: "Téléphone",
  frequency: "monthly",
  accountId: "account-1",
  categoryId: "category-1",
  thirdPartyId: "supplier-1",
  isActive: true,
};

test("normalizes NFC, casing and whitespace while preserving accents", () => {
  assert.equal(normalizeFixedExpenseName("  TE\u0301LÉPHONE  "), "téléphone");
  assert.notEqual(normalizeFixedExpenseName("Téléphone"), normalizeFixedExpenseName("Telephone"));
});

test("matches identical business properties despite monthly frequency aliases", () => {
  assert.equal(areFixedExpensesCompatible(telephone, { ...telephone, name: "  téléphone ", frequency: "mensuel" }), true);
});

test("allows same name with a genuinely different account or category", () => {
  assert.equal(areFixedExpensesCompatible(telephone, { ...telephone, accountId: "account-2" }), false);
  assert.equal(areFixedExpensesCompatible(telephone, { ...telephone, categoryId: "category-2" }), false);
});

test("ignores inactive suggestions and keeps monthly amount differences compatible", () => {
  const matches = findCompatibleFixedExpenses({ ...telephone, initialAmount: 30 }, [
    { ...telephone, id: "active", initialAmount: 15 },
    { ...telephone, id: "inactive", initialAmount: 15, isActive: false },
  ]);
  assert.deepEqual(matches.map(({ id }) => id), ["active"]);
});

test("builds a stable id for concurrent identical creation attempts", () => {
  assert.equal(buildFixedExpenseDocumentId(telephone), buildFixedExpenseDocumentId({ ...telephone }));
  assert.notEqual(buildFixedExpenseDocumentId(telephone), buildFixedExpenseDocumentId({ ...telephone, accountId: "account-2" }));
  assert.notEqual(
    buildFixedExpenseDocumentId({ ...telephone, ownerUid: "owner-a" }),
    buildFixedExpenseDocumentId({ ...telephone, ownerUid: "owner-b" })
  );
});
