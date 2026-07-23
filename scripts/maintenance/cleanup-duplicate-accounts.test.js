import test from "node:test";
import assert from "node:assert/strict";
import {
  APPLY_FLAG,
  CANONICAL_ACCOUNTS,
  CLEANUP_CANDIDATES,
  CURRENT_ACCOUNT_ID,
  buildDuplicateAccountsDryRunReport,
  validateAfterCleanup,
  validateBeforeCleanup,
} from "./cleanup-duplicate-accounts.mjs";

const GROUPS = [
  {
    name: "Compte courant",
    type: "standard",
    icon: "card",
    color: "#1976d2",
    displayOrder: 1,
    canonicalId: CANONICAL_ACCOUNTS["Compte courant"],
    candidates: ["NkXb45Fc6xg6J9lk9VRK", "FXJIDQejNMS8wwqvFuGh", "1axzCNIWfv0hCOUJlkIf"],
  },
  {
    name: "Compte professionnel",
    type: "business",
    icon: "briefcase",
    color: "#7b1fa2",
    displayOrder: 3,
    canonicalId: CANONICAL_ACCOUNTS["Compte professionnel"],
    candidates: ["qpnKgI6CmcUzdeoyxCkG", "Nng3U5DMBAL4YiyOA05m", "FtnqQ0b2uZi2WvXxTXEq"],
  },
  {
    name: "Espèces",
    type: "cash",
    icon: "cash",
    color: "#ef6c00",
    displayOrder: 4,
    canonicalId: CANONICAL_ACCOUNTS["Espèces"],
    candidates: ["1WFggMcWy2Ew7qBt7eZH", "kXi7qITstdXWo938XUfN", "V4AJ0DXmQymoBfQB8jTO"],
  },
  {
    name: "Livret A",
    type: "savings",
    icon: "bank",
    color: "#2e7d32",
    displayOrder: 2,
    canonicalId: CANONICAL_ACCOUNTS["Livret A"],
    candidates: ["fLS1C64hUHJ0few9WB6j", "dZoRK7jMlRZtSfZOa4D3", "Rmh7sHaxl3u0bMlQjKe0"],
  },
  {
    name: "PayPal",
    type: "digital",
    icon: "paypal",
    color: "#6a1b9a",
    displayOrder: 5,
    canonicalId: CANONICAL_ACCOUNTS.PayPal,
    candidates: ["DZwutxIuhRFtmgQ3fXnL", "of5ikhyMqhgO4sYkOxFf", "Gwz0QBEkpiNRMhbA5MbY"],
  },
];

function makeAccount(group, id, offset) {
  return {
    id,
    name: group.name,
    type: group.type,
    icon: group.icon,
    color: group.color,
    initialBalance: 0,
    isActive: true,
    displayOrder: group.displayOrder,
    createdAt: `2026-07-13T13:20:34.${String(offset).padStart(3, "0")}Z`,
  };
}

function makeNominalFixture() {
  const accounts = [];
  let offset = 1;

  for (const group of GROUPS) {
    accounts.push(makeAccount(group, group.canonicalId, offset));
    offset += 1;
    for (const id of group.candidates) {
      accounts.push(makeAccount(group, id, offset));
      offset += 1;
    }
  }

  const transactions = Array.from({ length: 96 }, (_, index) => ({
    id: `tx-${index}`,
    accountId: CURRENT_ACCOUNT_ID,
  }));

  return { accounts, transactions };
}

test("nominal dry-run finds exactly 15 safe whitelist candidates", () => {
  const fixture = makeNominalFixture();
  const report = buildDuplicateAccountsDryRunReport({ ...fixture, source: "test" });

  assert.equal(report.verdict, "DRY-RUN VALIDE");
  assert.equal(report.accountsTotal, 20);
  assert.equal(report.uniqueAccountIds, 20);
  assert.equal(report.transactionsTotal, 96);
  assert.equal(report.groups.length, 5);
  assert.equal(report.safeCandidatesCount, 15);
  assert.equal(report.unsafeCandidatesCount, 0);
  assert.equal(report.writesPerformed, 0);
});

test("candidate referenced by a transaction is refused", () => {
  const fixture = makeNominalFixture();
  fixture.transactions[0] = { id: "tx-reassigned", accountId: CLEANUP_CANDIDATES[0].id };

  const result = validateBeforeCleanup(fixture);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("referenced")));
  assert.equal(result.unsafeCandidatesCount, 1);
});

test("business property difference is refused", () => {
  const fixture = makeNominalFixture();
  fixture.accounts.find((account) => account.id === CLEANUP_CANDIDATES.find((candidate) => candidate.group === "PayPal").id).color = "#000000";

  const result = validateBeforeCleanup(fixture);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("business property differences")));
});

test("unexpected number of groups is refused", () => {
  const fixture = makeNominalFixture();
  fixture.accounts = fixture.accounts.filter((account) => account.name !== "Livret A");

  const result = validateBeforeCleanup(fixture);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("accounts total")));
  assert.ok(result.errors.some((error) => error.includes("account groups total")));
});

test("incorrect current account canonical is refused", () => {
  const fixture = makeNominalFixture();
  const current = fixture.accounts.find((account) => account.id === CURRENT_ACCOUNT_ID);
  current.id = "wrong-current-id";
  fixture.transactions = fixture.transactions.map((transaction) => ({ ...transaction, accountId: "wrong-current-id" }));

  const result = validateBeforeCleanup(fixture);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("canonical account missing")));
});

test("unknown transaction accountId is refused", () => {
  const fixture = makeNominalFixture();
  fixture.transactions[0] = { id: "tx-unknown", accountId: "missing-account" };

  const report = buildDuplicateAccountsDryRunReport({ ...fixture, source: "test" });

  assert.equal(report.verdict, "DRY-RUN REFUSE");
  assert.deepEqual(report.unknownReferences, [{ accountId: "missing-account", references: 1 }]);
});

test("ID outside whitelist is refused when it appears as the destructive candidate list", () => {
  const fixture = makeNominalFixture();
  const result = validateBeforeCleanup({
    ...fixture,
    deletionCandidates: [
      ...CLEANUP_CANDIDATES.slice(0, 14),
      { group: "PayPal", canonicalId: CANONICAL_ACCOUNTS.PayPal, id: "not-whitelisted" },
    ],
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("candidate account missing")));
  assert.ok(result.errors.some((error) => error.includes("safe candidate count")));
});

test("canonical account in destructive candidate list is refused", () => {
  const fixture = makeNominalFixture();
  const result = validateBeforeCleanup({
    ...fixture,
    deletionCandidates: [
      ...CLEANUP_CANDIDATES.slice(0, 14),
      { group: "Compte courant", canonicalId: CURRENT_ACCOUNT_ID, id: CURRENT_ACCOUNT_ID },
    ],
  });

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("canonical account")));
});

test("post-cleanup accepts only five canonical accounts and unchanged transactions", () => {
  const fixture = makeNominalFixture();
  const beforeCanonicalAccounts = new Map(fixture.accounts.filter((account) => Object.values(CANONICAL_ACCOUNTS).includes(account.id)).map((account) => [account.id, account]));
  const beforeTransactions = new Map(fixture.transactions.map((transaction) => [transaction.id, transaction]));
  const afterAccounts = fixture.accounts.filter((account) => Object.values(CANONICAL_ACCOUNTS).includes(account.id));

  const result = validateAfterCleanup({
    accounts: afterAccounts,
    transactions: fixture.transactions,
    beforeCanonicalAccounts,
    beforeTransactions,
  });

  assert.equal(result.ok, true);
  assert.equal(result.accountIds.length, 5);
  assert.deepEqual(result.referenceCountsByAccountId, { [CURRENT_ACCOUNT_ID]: 96 });
});

test("apply flag name is intentionally hard to trigger accidentally", () => {
  assert.equal(APPLY_FLAG, "--apply-confirmed-cleanup-15-accounts");
});
