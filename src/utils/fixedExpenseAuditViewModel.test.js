import test from "node:test";
import assert from "node:assert/strict";
import {
  buildFixedExpenseAuditCsv,
  buildFixedExpenseAuditTimeline,
  buildFixedExpenseGuaranteeLines,
  buildFixedExpensesHealthMetrics,
  buildFixedExpenseSynchronizationMetrics,
  countOccurrenceTransactionDuplicates,
} from "./fixedExpenseAuditViewModel.js";

function buildSummary(overrides = {}) {
  return {
    occurrenceCount: 4,
    transactionCount: 4,
    forecastCount: 1,
    anomalyCount: 1,
    occurrences: [
      {
        id: "jan",
        expectedDate: new Date("2026-01-15T12:00:00.000Z"),
        state: "transaction",
        expectedAmount: 29,
        accountingValue: 29,
        amountDelta: 0,
        auditLabel: "Aucun doublon détecté",
        transactions: [{ transaction: { id: "tx-jan", description: "ASSURANCE JAN" } }],
        primaryTransaction: { id: "tx-jan", description: "ASSURANCE JAN" },
        anomalyTransactions: [],
      },
      {
        id: "feb",
        expectedDate: new Date("2026-02-15T12:00:00.000Z"),
        state: "forecast",
        expectedAmount: 29,
        accountingValue: 29,
        amountDelta: 0,
        auditLabel: "Transaction manquante",
        transactions: [],
        primaryTransaction: null,
        anomalyTransactions: [],
      },
      {
        id: "mar",
        expectedDate: new Date("2026-03-15T12:00:00.000Z"),
        state: "transaction",
        expectedAmount: 29,
        accountingValue: 31,
        amountDelta: 2,
        auditLabel: "Aucun doublon détecté",
        transactions: [{ transaction: { id: "tx-mar", description: "ASSURANCE MAR" } }],
        primaryTransaction: { id: "tx-mar", description: "ASSURANCE MAR" },
        anomalyTransactions: [],
      },
      {
        id: "apr",
        expectedDate: new Date("2026-04-15T12:00:00.000Z"),
        state: "anomaly",
        expectedAmount: 29,
        accountingValue: 29,
        amountDelta: 0,
        auditLabel: "Une anomalie détectée",
        transactions: [
          { transaction: { id: "tx-apr-1", description: "ASSURANCE AVR 1" } },
          { transaction: { id: "tx-apr-2", description: "ASSURANCE AVR 2" } },
        ],
        primaryTransaction: { id: "tx-apr-1", description: "ASSURANCE AVR 1" },
        anomalyTransactions: [{ id: "tx-apr-2", description: "ASSURANCE AVR 2" }],
      },
    ],
    ...overrides,
  };
}

test("health metrics aggregate KPI and reliability from the ledger", () => {
  const summary = buildSummary();
  const metrics = buildFixedExpensesHealthMetrics({
    fixedExpenses: [{ id: "fx-1" }, { id: "fx-2" }],
    ledger: { occurrences: summary.occurrences },
  });

  assert.equal(metrics.fixedExpenseCount, 2);
  assert.equal(metrics.occurrenceCount, 4);
  assert.equal(metrics.reconciledCount, 2);
  assert.equal(metrics.forecastCount, 1);
  assert.equal(metrics.anomalyCount, 1);
  assert.equal(metrics.duplicateAccountingCount, 0);
  assert.equal(metrics.reliabilityIndex, 50);
});

test("synchronization metrics expose counts and cumulative delta", () => {
  const metrics = buildFixedExpenseSynchronizationMetrics(buildSummary());

  assert.equal(metrics.occurrenceCount, 4);
  assert.equal(metrics.transactionCount, 4);
  assert.equal(metrics.forecastCount, 1);
  assert.equal(metrics.anomalyCount, 1);
  assert.equal(metrics.cumulativeDelta, 2);
});

test("timeline explains forecast, replacement, delta, and anomaly states", () => {
  const timeline = buildFixedExpenseAuditTimeline(buildSummary());

  assert.equal(timeline.length, 4);
  assert.equal(timeline[0].steps.some((step) => step.label === "Prévision supprimée"), true);
  assert.equal(timeline[1].steps.some((step) => step.label === "Aucune transaction"), true);
  assert.equal(timeline[2].steps.some((step) => step.label === "Écart" && step.value === 2), true);
  assert.equal(timeline[3].steps.some((step) => step.label === "Deuxième transaction ignorée"), true);
});

test("guarantee lines surface the no-double-accounting message", () => {
  const lines = buildFixedExpenseGuaranteeLines(buildSummary());

  assert.equal(lines.includes("Aucun doublon détecté"), true);
});

test("CSV export includes every occurrence and the engine decision", () => {
  const csv = buildFixedExpenseAuditCsv(buildSummary());

  assert.equal(csv.includes("echeance;date_prevue;etat;prevision;transaction;decision;valeur_comptable;ecart;audit"), true);
  assert.equal(csv.includes("Prévision conservée"), true);
  assert.equal(csv.includes("Prévision supprimée"), true);
  assert.equal(csv.includes("Anomalie"), true);
});

test("duplicate counter reports reused transaction ids when they exist", () => {
  const duplicates = countOccurrenceTransactionDuplicates([
    { transactions: [{ transaction: { id: "tx-1" } }] },
    { transactions: [{ transaction: { id: "tx-1" } }] },
  ]);

  assert.equal(duplicates, 1);
});