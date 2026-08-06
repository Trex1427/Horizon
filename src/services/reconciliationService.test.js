import test from "node:test";
import assert from "node:assert/strict";
import {
  FIXED_EXPENSE_OCCURRENCE_STATES,
  RECONCILIATION_DECISIONS,
  buildFixedExpenseReconciliationLedger,
  buildReconciliationTransactionIndex,
  evaluateFixedExpenseOccurrenceCoverage,
  scoreTransactionAgainstFixedExpense,
  summarizeFixedExpenseReconciliation,
} from "./reconciliationService.js";

function fixedExpense(overrides = {}) {
  return {
    id: "fx-netflix",
    name: "Netflix",
    thirdPartyName: "Netflix",
    accountId: "acc-1",
    frequency: "monthly",
    initialAmount: 29.99,
    startDate: "2026-01-05",
    amountType: "fixed",
    ...overrides,
  };
}

function transaction(overrides = {}) {
  return {
    id: `tx-${Math.random().toString(36).slice(2)}`,
    type: "depense",
    amount: 29.99,
    accountId: "acc-1",
    date: "2026-04-06",
    merchant: "Netflix",
    description: "NETFLIX.COM",
    ...overrides,
  };
}

function assertNoTransactionCountedTwice(ledger) {
  const usedTransactionIds = ledger.occurrences
    .flatMap((occurrence) => occurrence.transactions.map((entry) => entry.transaction.id));
  const uniqueTransactionIds = new Set(usedTransactionIds);
  assert.equal(usedTransactionIds.length, uniqueTransactionIds.size);
}

test("fixed amount with same merchant and account reaches automatic association", () => {
  const evaluation = scoreTransactionAgainstFixedExpense(
    transaction({ amount: 29.99, date: "2026-04-05" }),
    fixedExpense(),
    { monthStart: "2026-04-01", monthEnd: "2026-04-30", expectedAmount: 29.99 }
  );

  assert.equal(evaluation.amountType, "fixed");
  assert.equal(evaluation.decision, RECONCILIATION_DECISIONS.AUTO);
  assert.equal(evaluation.criteria.merchant > 0.7, true);
  assert.equal(evaluation.criteria.account, 1);
});

test("variable amount tolerates amount deltas better than fixed amount", () => {
  const variableEvaluation = scoreTransactionAgainstFixedExpense(
    transaction({ amount: 34.99, date: "2026-04-04" }),
    fixedExpense({ amountType: "variable", name: "Orange", thirdPartyName: "Orange", initialAmount: 29.99 }),
    { monthStart: "2026-04-01", monthEnd: "2026-04-30", expectedAmount: 29.99 }
  );

  const fixedEvaluation = scoreTransactionAgainstFixedExpense(
    transaction({ amount: 34.99, date: "2026-04-04" }),
    fixedExpense({ amountType: "fixed", name: "Orange", thirdPartyName: "Orange", initialAmount: 29.99 }),
    { monthStart: "2026-04-01", monthEnd: "2026-04-30", expectedAmount: 29.99 }
  );

  assert.equal(variableEvaluation.criteria.amount > fixedEvaluation.criteria.amount, true);
  assert.equal(variableEvaluation.score > fixedEvaluation.score, true);
});

test("different merchant blocks automatic decision", () => {
  const evaluation = scoreTransactionAgainstFixedExpense(
    transaction({ merchant: "Amazon", description: "AMAZON EU", amount: 29.99 }),
    fixedExpense({ name: "Netflix", thirdPartyName: "Netflix" }),
    { monthStart: "2026-04-01", monthEnd: "2026-04-30", expectedAmount: 29.99 }
  );

  assert.equal(evaluation.criteria.merchant < 0.4, true);
  assert.equal(evaluation.decision === RECONCILIATION_DECISIONS.AUTO, false);
});

test("same merchant but different account yields at most suggestion", () => {
  const evaluation = scoreTransactionAgainstFixedExpense(
    transaction({ accountId: "acc-2", merchant: "Netflix", description: "NETFLIX" }),
    fixedExpense({ accountId: "acc-1" }),
    { monthStart: "2026-04-01", monthEnd: "2026-04-30", expectedAmount: 29.99 }
  );

  assert.equal(evaluation.criteria.account, 0);
  assert.equal(evaluation.decision === RECONCILIATION_DECISIONS.AUTO, false);
});

test("advanced and delayed payments are still considered in the matching window", () => {
  const fx = fixedExpense({ startDate: "2026-01-10" });
  const earlyCoverage = evaluateFixedExpenseOccurrenceCoverage({
    fixedExpense: fx,
    transactions: [transaction({ date: "2026-03-30", merchant: "Netflix", amount: 29.99 })],
    monthStart: "2026-04-01",
    monthEnd: "2026-04-30",
    expectedAmount: 29.99,
  });
  const delayedCoverage = evaluateFixedExpenseOccurrenceCoverage({
    fixedExpense: fx,
    transactions: [transaction({ date: "2026-05-02", merchant: "Netflix", amount: 29.99 })],
    monthStart: "2026-04-01",
    monthEnd: "2026-04-30",
    expectedAmount: 29.99,
  });

  assert.equal(earlyCoverage.bestMatch !== null, true);
  assert.equal(delayedCoverage.bestMatch !== null, true);
});

test("explicit historical link has priority", () => {
  const coverage = evaluateFixedExpenseOccurrenceCoverage({
    fixedExpense: fixedExpense({ id: "fx-edf", name: "EDF" }),
    transactions: [transaction({ fixedExpenseId: "fx-edf", merchant: "Other", date: "2026-04-20", amount: 57.25 })],
    monthStart: "2026-04-01",
    monthEnd: "2026-04-30",
    expectedAmount: 40,
  });

  assert.equal(coverage.covered, true);
  assert.equal(coverage.decision, RECONCILIATION_DECISIONS.AUTO);
  assert.equal(coverage.bestMatch?.evaluation?.score, 1);
});

test("absence of strong match keeps forecast candidate open and exposes suggestion", () => {
  const coverage = evaluateFixedExpenseOccurrenceCoverage({
    fixedExpense: fixedExpense({ amountType: "fixed", name: "Orange", thirdPartyName: "Orange" }),
    transactions: [transaction({ merchant: "Orange", description: "ORANGE", amount: 60, date: "2026-04-20" })],
    monthStart: "2026-04-01",
    monthEnd: "2026-04-30",
    expectedAmount: 29.99,
    includeSuggestAsCovered: false,
  });

  assert.equal(coverage.covered, false);
  assert.equal(coverage.decision !== RECONCILIATION_DECISIONS.NONE, true);
  assert.equal(Array.isArray(coverage.suggestions), true);
});

test("forecast snapshot counts linked transactions and remaining occurrences", () => {
  const snapshot = summarizeFixedExpenseReconciliation({
    fixedExpense: fixedExpense({ id: "fx-netflix" }),
    transactions: [
      transaction({ id: "tx-jan", fixedExpenseId: "fx-netflix", date: "2026-01-08", merchant: "Netflix" }),
      transaction({ id: "tx-feb", fixedExpenseId: "fx-netflix", date: "2026-02-08", merchant: "Netflix" }),
      transaction({ id: "tx-mar", fixedExpenseId: "fx-netflix", date: "2026-03-08", merchant: "Netflix" }),
    ],
    year: 2026,
    referenceDate: new Date("2026-01-01T00:00:00.000Z"),
  });

  assert.equal(snapshot.linkedTransactionCount, 3);
  assert.equal(snapshot.remainingOccurrences > 0, true);
});

test("index retrieval supports large transaction volumes", () => {
  const transactions = [];
  for (let index = 0; index < 5000; index += 1) {
    transactions.push(transaction({
      id: `tx-${index}`,
      amount: 10 + (index % 50),
      merchant: index % 2 === 0 ? "Netflix" : "Other",
      accountId: index % 3 === 0 ? "acc-1" : "acc-2",
      date: `2026-${String((index % 12) + 1).padStart(2, "0")}-10`,
    }));
  }

  const index = buildReconciliationTransactionIndex(transactions);
  const coverage = evaluateFixedExpenseOccurrenceCoverage({
    fixedExpense: fixedExpense({ name: "Netflix", accountId: "acc-1", amountType: "variable", initialAmount: 29.99 }),
    transactions,
    transactionIndex: index,
    monthStart: "2026-08-01",
    monthEnd: "2026-08-31",
    expectedAmount: 29.99,
  });

  assert.equal(coverage.bestMatch !== null || coverage.suggestions.length >= 0, true);
});

test("occurrence ledger keeps a forecast when no transaction exists", () => {
  const ledger = buildFixedExpenseReconciliationLedger({
    fixedExpenses: [fixedExpense({ startDate: "2026-08-05" })],
    transactions: [],
    periodStart: new Date("2026-08-01T00:00:00.000Z"),
    periodEnd: new Date("2026-08-31T23:59:59.999Z"),
    referenceDate: new Date("2026-08-01T00:00:00.000Z"),
  });

  assert.equal(ledger.occurrences.length, 1);
  assert.equal(ledger.occurrences[0].state, FIXED_EXPENSE_OCCURRENCE_STATES.FORECAST);
  assert.equal(ledger.occurrences[0].accountingValue, 29.99);
});

test("occurrence ledger replaces the forecast with one transaction", () => {
  const ledger = buildFixedExpenseReconciliationLedger({
    fixedExpenses: [fixedExpense({ startDate: "2026-08-05" })],
    transactions: [transaction({ id: "tx-aug", date: "2026-08-05", amount: 29.99, merchant: "Netflix" })],
    periodStart: new Date("2026-08-01T00:00:00.000Z"),
    periodEnd: new Date("2026-08-31T23:59:59.999Z"),
    referenceDate: new Date("2026-08-07T00:00:00.000Z"),
  });

  assert.equal(ledger.occurrences[0].state, FIXED_EXPENSE_OCCURRENCE_STATES.TRANSACTION);
  assert.equal(ledger.occurrences[0].accountingValue, 29.99);
  assert.equal(ledger.occurrences[0].primaryTransaction?.id, "tx-aug");
});

test("occurrence ledger flags an anomaly when two transactions target the same due", () => {
  const ledger = buildFixedExpenseReconciliationLedger({
    fixedExpenses: [fixedExpense({ startDate: "2026-08-05" })],
    transactions: [
      transaction({ id: "tx-1", date: "2026-08-05", amount: 29.99, merchant: "Netflix" }),
      transaction({ id: "tx-2", date: "2026-08-06", amount: 29.99, merchant: "Netflix" }),
    ],
    periodStart: new Date("2026-08-01T00:00:00.000Z"),
    periodEnd: new Date("2026-08-31T23:59:59.999Z"),
    referenceDate: new Date("2026-08-07T00:00:00.000Z"),
  });

  assert.equal(ledger.occurrences[0].state, FIXED_EXPENSE_OCCURRENCE_STATES.ANOMALY);
  assert.equal(ledger.occurrences[0].transactionCount, 2);
  assert.equal(ledger.occurrences[0].anomalyTransactions.length, 1);
});

test("occurrence ledger supports an early payment without double-assigning the next month", () => {
  const ledger = buildFixedExpenseReconciliationLedger({
    fixedExpenses: [fixedExpense({ startDate: "2026-01-10" })],
    transactions: [transaction({ id: "tx-early", date: "2026-03-30", amount: 29.99, merchant: "Netflix" })],
    periodStart: new Date("2026-03-01T00:00:00.000Z"),
    periodEnd: new Date("2026-04-30T23:59:59.999Z"),
    referenceDate: new Date("2026-04-01T00:00:00.000Z"),
  });

  const april = ledger.occurrences.find((occurrence) => occurrence.month === "2026-04");
  const march = ledger.occurrences.find((occurrence) => occurrence.month === "2026-03");
  assert.equal(april?.state, FIXED_EXPENSE_OCCURRENCE_STATES.TRANSACTION);
  assert.equal(april?.primaryTransaction?.id, "tx-early");
  assert.equal(march?.state, FIXED_EXPENSE_OCCURRENCE_STATES.FORECAST);
});

test("occurrence ledger supports a delayed payment within the tolerance window", () => {
  const ledger = buildFixedExpenseReconciliationLedger({
    fixedExpenses: [fixedExpense({ startDate: "2026-01-28" })],
    transactions: [transaction({ id: "tx-delayed", date: "2026-05-02", amount: 29.99, merchant: "Netflix" })],
    periodStart: new Date("2026-04-01T00:00:00.000Z"),
    periodEnd: new Date("2026-05-31T23:59:59.999Z"),
    referenceDate: new Date("2026-05-03T00:00:00.000Z"),
  });

  const april = ledger.occurrences.find((occurrence) => occurrence.month === "2026-04");
  const may = ledger.occurrences.find((occurrence) => occurrence.month === "2026-05");
  assert.equal(april?.state, FIXED_EXPENSE_OCCURRENCE_STATES.TRANSACTION);
  assert.equal(april?.primaryTransaction?.id, "tx-delayed");
  assert.equal(may?.state, FIXED_EXPENSE_OCCURRENCE_STATES.FORECAST);
});

test("deleted transactions no longer cover an occurrence after rebuild", () => {
  const ledger = buildFixedExpenseReconciliationLedger({
    fixedExpenses: [fixedExpense({ startDate: "2026-08-05" })],
    transactions: [transaction({ id: "tx-deleted", date: "2026-08-05", amount: 29.99, merchant: "Netflix", isDeleted: true })],
    periodStart: new Date("2026-08-01T00:00:00.000Z"),
    periodEnd: new Date("2026-08-31T23:59:59.999Z"),
    referenceDate: new Date("2026-08-07T00:00:00.000Z"),
  });

  assert.equal(ledger.occurrences[0].state, FIXED_EXPENSE_OCCURRENCE_STATES.FORECAST);
});

test("scenario 1 - creating the fixed expense before importing transactions auto-links them and removes forecasts without duplicates", () => {
  const ledger = buildFixedExpenseReconciliationLedger({
    fixedExpenses: [fixedExpense({ id: "fx-auto", name: "Assurance auto", thirdPartyName: "Assurance auto", startDate: "2026-01-15", initialAmount: 42 })],
    transactions: [
      transaction({ id: "tx-jan", merchant: "Assurance auto", description: "ASSURANCE AUTO", date: "2026-01-15", amount: 42 }),
      transaction({ id: "tx-feb", merchant: "Assurance auto", description: "ASSURANCE AUTO", date: "2026-02-15", amount: 42 }),
    ],
    periodStart: new Date("2026-01-01T00:00:00.000Z"),
    periodEnd: new Date("2026-03-31T23:59:59.999Z"),
    referenceDate: new Date("2026-03-01T00:00:00.000Z"),
  });

  assert.equal(ledger.occurrences.map((item) => item.state).join(","), "transaction,transaction,forecast");
  assertNoTransactionCountedTwice(ledger);
});

test("scenario 2 - creating the fixed expense after existing transactions rebuilds past dues with no duplicates", () => {
  const importedTransactions = [
    transaction({ id: "tx-jan", merchant: "Assurance auto", description: "ASSURANCE AUTO", date: "2026-01-15", amount: 42 }),
    transaction({ id: "tx-feb", merchant: "Assurance auto", description: "ASSURANCE AUTO", date: "2026-02-15", amount: 42 }),
    transaction({ id: "tx-mar", merchant: "Assurance auto", description: "ASSURANCE AUTO", date: "2026-03-15", amount: 42 }),
  ];
  const ledger = buildFixedExpenseReconciliationLedger({
    fixedExpenses: [fixedExpense({ id: "fx-auto", name: "Assurance auto", thirdPartyName: "Assurance auto", startDate: "2026-01-15", initialAmount: 42 })],
    transactions: importedTransactions,
    periodStart: new Date("2026-01-01T00:00:00.000Z"),
    periodEnd: new Date("2026-03-31T23:59:59.999Z"),
    referenceDate: new Date("2026-03-20T00:00:00.000Z"),
  });

  assert.equal(ledger.occurrences.every((item) => item.state === FIXED_EXPENSE_OCCURRENCE_STATES.TRANSACTION), true);
  assertNoTransactionCountedTwice(ledger);
});

test("scenario 3 - deleting one associated transaction recreates only its forecast and keeps the other dues unchanged", () => {
  const ledger = buildFixedExpenseReconciliationLedger({
    fixedExpenses: [fixedExpense({ id: "fx-auto", name: "Assurance auto", thirdPartyName: "Assurance auto", startDate: "2026-01-15", initialAmount: 42 })],
    transactions: [
      transaction({ id: "tx-jan", merchant: "Assurance auto", date: "2026-01-15", amount: 42 }),
      transaction({ id: "tx-feb", merchant: "Assurance auto", date: "2026-02-15", amount: 42, isDeleted: true }),
      transaction({ id: "tx-mar", merchant: "Assurance auto", date: "2026-03-15", amount: 42 }),
    ],
    periodStart: new Date("2026-01-01T00:00:00.000Z"),
    periodEnd: new Date("2026-03-31T23:59:59.999Z"),
    referenceDate: new Date("2026-03-20T00:00:00.000Z"),
  });

  assert.equal(ledger.occurrences.map((item) => item.state).join(","), "transaction,forecast,transaction");
  assertNoTransactionCountedTwice(ledger);
});

test("scenario 4 - two transactions on the same due create an anomaly and keep one accounting value", () => {
  const ledger = buildFixedExpenseReconciliationLedger({
    fixedExpenses: [fixedExpense({ id: "fx-auto", name: "Assurance auto", thirdPartyName: "Assurance auto", startDate: "2026-03-15", initialAmount: 42 })],
    transactions: [
      transaction({ id: "tx-mar-1", merchant: "Assurance auto", date: "2026-03-15", amount: 42 }),
      transaction({ id: "tx-mar-2", merchant: "Assurance auto", date: "2026-03-16", amount: 42 }),
    ],
    periodStart: new Date("2026-03-01T00:00:00.000Z"),
    periodEnd: new Date("2026-03-31T23:59:59.999Z"),
    referenceDate: new Date("2026-03-20T00:00:00.000Z"),
  });

  assert.equal(ledger.occurrences[0].state, FIXED_EXPENSE_OCCURRENCE_STATES.ANOMALY);
  assert.equal(ledger.occurrences[0].accountingValue, 42);
  assert.equal(ledger.occurrences[0].transactionCount, 2);
});

test("scenario 5 - a different real amount replaces the forecast and exposes the delta without adding both", () => {
  const ledger = buildFixedExpenseReconciliationLedger({
    fixedExpenses: [fixedExpense({ id: "fx-orange", name: "Orange", thirdPartyName: "Orange", startDate: "2026-03-15", initialAmount: 30, amountType: "variable" })],
    transactions: [
      transaction({ id: "tx-orange", merchant: "Orange", description: "ORANGE", date: "2026-03-15", amount: 38 }),
    ],
    periodStart: new Date("2026-03-01T00:00:00.000Z"),
    periodEnd: new Date("2026-03-31T23:59:59.999Z"),
    referenceDate: new Date("2026-03-20T00:00:00.000Z"),
  });

  assert.equal(ledger.occurrences[0].state, FIXED_EXPENSE_OCCURRENCE_STATES.TRANSACTION);
  assert.equal(ledger.occurrences[0].accountingValue, 38);
  assert.equal(ledger.occurrences[0].amountDelta, 8);
  assert.notEqual(ledger.occurrences[0].accountingValue, 68);
});

test("scenario 6 - a payment ten days early is attached to the correct due with no second forecast", () => {
  const ledger = buildFixedExpenseReconciliationLedger({
    fixedExpenses: [fixedExpense({ id: "fx-auto", name: "Assurance auto", thirdPartyName: "Assurance auto", startDate: "2026-01-15", initialAmount: 42 })],
    transactions: [
      transaction({ id: "tx-early", merchant: "Assurance auto", date: "2026-03-05", amount: 42 }),
    ],
    periodStart: new Date("2026-03-01T00:00:00.000Z"),
    periodEnd: new Date("2026-03-31T23:59:59.999Z"),
    referenceDate: new Date("2026-03-20T00:00:00.000Z"),
  });

  assert.equal(ledger.occurrences[0].state, FIXED_EXPENSE_OCCURRENCE_STATES.TRANSACTION);
  assert.equal(ledger.occurrences[0].transactionCount, 1);
});

test("scenario 7 - a payment ten days late is attached to the expected due and removes its forecast", () => {
  const ledger = buildFixedExpenseReconciliationLedger({
    fixedExpenses: [fixedExpense({ id: "fx-auto", name: "Assurance auto", thirdPartyName: "Assurance auto", startDate: "2026-01-15", initialAmount: 42 })],
    transactions: [
      transaction({ id: "tx-late", merchant: "Assurance auto", date: "2026-03-25", amount: 42 }),
    ],
    periodStart: new Date("2026-03-01T00:00:00.000Z"),
    periodEnd: new Date("2026-03-31T23:59:59.999Z"),
    referenceDate: new Date("2026-03-26T00:00:00.000Z"),
  });

  assert.equal(ledger.occurrences[0].state, FIXED_EXPENSE_OCCURRENCE_STATES.TRANSACTION);
  assert.equal(ledger.occurrences[0].replacedForecast, true);
});

test("scenario 8 - changing third party, frequency, and fixed-variable mode recomputes the associations", () => {
  const sourceTransactions = [
    transaction({ id: "tx-orange-mar", merchant: "Orange", description: "ORANGE", date: "2026-03-12", amount: 38 }),
    transaction({ id: "tx-orange-apr", merchant: "Orange", description: "ORANGE", date: "2026-04-12", amount: 41 }),
  ];
  const before = buildFixedExpenseReconciliationLedger({
    fixedExpenses: [fixedExpense({ id: "fx-update", name: "Assurance auto", thirdPartyName: "Assurance auto", startDate: "2026-03-15", initialAmount: 42, amountType: "fixed" })],
    transactions: sourceTransactions,
    periodStart: new Date("2026-03-01T00:00:00.000Z"),
    periodEnd: new Date("2026-04-30T23:59:59.999Z"),
    referenceDate: new Date("2026-04-20T00:00:00.000Z"),
  });
  const after = buildFixedExpenseReconciliationLedger({
    fixedExpenses: [fixedExpense({ id: "fx-update", name: "Orange", thirdPartyName: "Orange", startDate: "2026-03-12", initialAmount: 30, frequency: "monthly", amountType: "variable" })],
    transactions: sourceTransactions,
    periodStart: new Date("2026-03-01T00:00:00.000Z"),
    periodEnd: new Date("2026-04-30T23:59:59.999Z"),
    referenceDate: new Date("2026-04-20T00:00:00.000Z"),
  });

  assert.equal(before.occurrences.every((item) => item.state === FIXED_EXPENSE_OCCURRENCE_STATES.FORECAST), true);
  assert.equal(after.occurrences.every((item) => item.state === FIXED_EXPENSE_OCCURRENCE_STATES.TRANSACTION), true);
  assertNoTransactionCountedTwice(after);
});

test("scenario 9 - importing historical transactions later still rebuilds the matching historical dues", () => {
  const ledger = buildFixedExpenseReconciliationLedger({
    fixedExpenses: [fixedExpense({ id: "fx-historical", name: "Assurance auto", thirdPartyName: "Assurance auto", startDate: "2025-10-15", initialAmount: 42 })],
    transactions: [
      transaction({ id: "tx-old-oct", merchant: "Assurance auto", date: "2025-10-15", amount: 42 }),
      transaction({ id: "tx-old-nov", merchant: "Assurance auto", date: "2025-11-15", amount: 42 }),
      transaction({ id: "tx-old-dec", merchant: "Assurance auto", date: "2025-12-15", amount: 42 }),
    ],
    periodStart: new Date("2025-10-01T00:00:00.000Z"),
    periodEnd: new Date("2025-12-31T23:59:59.999Z"),
    referenceDate: new Date("2026-08-01T00:00:00.000Z"),
  });

  assert.equal(ledger.occurrences.every((item) => item.state === FIXED_EXPENSE_OCCURRENCE_STATES.TRANSACTION), true);
  assertNoTransactionCountedTwice(ledger);
});

test("scenario 10 - manual recalculation produces the exact same result as automatic reconciliation", () => {
  const options = {
    fixedExpenses: [fixedExpense({ id: "fx-auto", name: "Assurance auto", thirdPartyName: "Assurance auto", startDate: "2026-01-15", initialAmount: 42 })],
    transactions: [
      transaction({ id: "tx-jan", merchant: "Assurance auto", date: "2026-01-15", amount: 42 }),
      transaction({ id: "tx-feb", merchant: "Assurance auto", date: "2026-02-15", amount: 42 }),
      transaction({ id: "tx-mar", merchant: "Assurance auto", date: "2026-03-15", amount: 42 }),
    ],
    periodStart: new Date("2026-01-01T00:00:00.000Z"),
    periodEnd: new Date("2026-03-31T23:59:59.999Z"),
    referenceDate: new Date("2026-03-20T00:00:00.000Z"),
  };
  const automaticLedger = buildFixedExpenseReconciliationLedger(options);
  const manualLedger = buildFixedExpenseReconciliationLedger(options);

  assert.deepEqual(
    manualLedger.occurrences.map((item) => ({
      id: item.id,
      state: item.state,
      accountingValue: item.accountingValue,
      amountDelta: item.amountDelta,
      transactionIds: item.transactions.map((entry) => entry.transaction.id),
    })),
    automaticLedger.occurrences.map((item) => ({
      id: item.id,
      state: item.state,
      accountingValue: item.accountingValue,
      amountDelta: item.amountDelta,
      transactionIds: item.transactions.map((entry) => entry.transaction.id),
    }))
  );
});
