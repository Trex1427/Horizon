import test from "node:test";
import assert from "node:assert/strict";
import { buildFixedExpenseScheduleSnapshot } from "./fixedExpenseScheduleSnapshot.js";

function toIsoDate(date) {
  return date ? date.toISOString().slice(0, 10) : null;
}

function buildFixedExpense(overrides = {}) {
  return {
    id: "fx-1",
    name: "Netflix",
    accountId: "acc-1",
    frequency: "monthly",
    amountType: "fixed",
    initialAmount: 29.99,
    startDate: "2026-01-05",
    ...overrides,
  };
}

function buildTransaction(overrides = {}) {
  return {
    id: `tx-${Math.random().toString(36).slice(2)}`,
    type: "depense",
    accountId: "acc-1",
    date: "2026-08-05T12:00:00.000Z",
    merchant: "Netflix",
    description: "NETFLIX",
    montant: 29.99,
    ...overrides,
  };
}

test("aucun paiement détecté garde une estimation calculée", () => {
  const snapshot = buildFixedExpenseScheduleSnapshot({
    fixedExpense: buildFixedExpense({ startDate: "2026-07-05" }),
    transactions: [],
    referenceDate: new Date("2026-08-01T12:00:00.000Z"),
  });

  assert.equal(snapshot.lastPayment, null);
  assert.equal(snapshot.paymentCount, 0);
  assert.equal(toIsoDate(snapshot.nextEstimatedDate), "2026-08-05");
});

test("un paiement lié alimente dernier paiement et prochaine échéance", () => {
  const snapshot = buildFixedExpenseScheduleSnapshot({
    fixedExpense: buildFixedExpense(),
    transactions: [buildTransaction({ id: "tx-1", fixedExpenseId: "fx-1", date: "2026-08-05T12:00:00.000Z", montant: 29.99 })],
    referenceDate: new Date("2026-08-07T12:00:00.000Z"),
  });

  assert.equal(toIsoDate(snapshot.lastPayment?.date), "2026-08-05");
  assert.equal(snapshot.lastPayment?.amount, 29.99);
  assert.equal(snapshot.paymentCount, 1);
  assert.equal(toIsoDate(snapshot.nextEstimatedDate), "2026-09-05");
});

test("plusieurs paiements détectés conservent le plus récent", () => {
  const snapshot = buildFixedExpenseScheduleSnapshot({
    fixedExpense: buildFixedExpense(),
    transactions: [
      buildTransaction({ id: "tx-1", fixedExpenseId: "fx-1", date: "2026-07-05", montant: 29.99 }),
      buildTransaction({ id: "tx-2", fixedExpenseId: "fx-1", date: "2026-08-05T12:00:00.000Z", montant: 31.99 }),
    ],
    referenceDate: new Date("2026-08-10T12:00:00.000Z"),
  });

  assert.equal(snapshot.paymentCount, 2);
  assert.equal(toIsoDate(snapshot.lastPayment?.date), "2026-08-05");
});

test("montant fixe calcule une échéance sans dépendre d'un champ stocké", () => {
  const snapshot = buildFixedExpenseScheduleSnapshot({
    fixedExpense: buildFixedExpense({ nextDebitDate: "2099-01-01" }),
    transactions: [buildTransaction({ id: "tx-1", fixedExpenseId: "fx-1", date: "2026-08-05T12:00:00.000Z", montant: 29.99 })],
    referenceDate: new Date("2026-08-10T12:00:00.000Z"),
  });

  assert.equal(toIsoDate(snapshot.nextEstimatedDate), "2026-09-05");
});

test("montant variable garde la date prioritaire pour la prochaine échéance", () => {
  const snapshot = buildFixedExpenseScheduleSnapshot({
    fixedExpense: buildFixedExpense({
      id: "fx-orange",
      name: "Orange",
      amountType: "variable",
      initialAmount: 29.99,
    }),
    transactions: [buildTransaction({
      id: "tx-orange",
      fixedExpenseId: "fx-orange",
      merchant: "Orange",
      description: "ORANGE FACTURE",
      date: "2026-08-05T12:00:00.000Z",
      montant: 37.45,
    })],
    referenceDate: new Date("2026-08-10T12:00:00.000Z"),
  });

  assert.equal(toIsoDate(snapshot.nextEstimatedDate), "2026-09-05");
});

test("échéance mensuelle applique +1 mois", () => {
  const snapshot = buildFixedExpenseScheduleSnapshot({
    fixedExpense: buildFixedExpense(),
    transactions: [buildTransaction({ id: "tx-1", fixedExpenseId: "fx-1", date: "2026-08-05T12:00:00.000Z" })],
    referenceDate: new Date("2026-08-06T12:00:00.000Z"),
  });

  assert.equal(toIsoDate(snapshot.nextEstimatedDate), "2026-09-05");
});

test("échéance annuelle applique +1 an", () => {
  const snapshot = buildFixedExpenseScheduleSnapshot({
    fixedExpense: buildFixedExpense({ frequency: "annual", startDate: "2024-04-18" }),
    transactions: [buildTransaction({ id: "tx-1", fixedExpenseId: "fx-1", date: "2026-04-18T12:00:00.000Z" })],
    referenceDate: new Date("2026-05-01T12:00:00.000Z"),
  });

  assert.equal(toIsoDate(snapshot.nextEstimatedDate), "2027-04-18");
});

test("échéance hebdomadaire applique +7 jours", () => {
  const snapshot = buildFixedExpenseScheduleSnapshot({
    fixedExpense: buildFixedExpense({ frequency: "weekly", startDate: "2026-08-05T12:00:00.000Z" }),
    transactions: [buildTransaction({ id: "tx-1", fixedExpenseId: "fx-1", date: "2026-08-05T12:00:00.000Z" })],
    referenceDate: new Date("2026-08-06T12:00:00.000Z"),
  });

  assert.equal(toIsoDate(snapshot.nextEstimatedDate), "2026-08-12");
});

test("état à jour quand l'échéance est dans le futur", () => {
  const snapshot = buildFixedExpenseScheduleSnapshot({
    fixedExpense: buildFixedExpense(),
    transactions: [buildTransaction({ id: "tx-1", fixedExpenseId: "fx-1", date: "2026-08-05T12:00:00.000Z" })],
    referenceDate: new Date("2026-08-20T12:00:00.000Z"),
  });

  assert.equal(snapshot.status.key, "upToDate");
});

test("état échéance proche sous 3 jours", () => {
  const snapshot = buildFixedExpenseScheduleSnapshot({
    fixedExpense: buildFixedExpense(),
    transactions: [buildTransaction({ id: "tx-1", fixedExpenseId: "fx-1", date: "2026-08-05T12:00:00.000Z" })],
    referenceDate: new Date("2026-09-03T12:00:00.000Z"),
  });

  assert.equal(snapshot.status.key, "dueSoon");
});

test("état en retard si date dépassée sans nouveau paiement", () => {
  const snapshot = buildFixedExpenseScheduleSnapshot({
    fixedExpense: buildFixedExpense(),
    transactions: [buildTransaction({ id: "tx-1", fixedExpenseId: "fx-1", date: "2026-08-05T12:00:00.000Z" })],
    referenceDate: new Date("2026-09-10T12:00:00.000Z"),
  });

  assert.equal(snapshot.status.key, "late");
});

test("détection par réconciliation sans lien explicite fonctionne pour montant variable", () => {
  const snapshot = buildFixedExpenseScheduleSnapshot({
    fixedExpense: buildFixedExpense({
      id: "fx-edf",
      name: "EDF",
      thirdPartyName: "EDF",
      amountType: "variable",
      initialAmount: 40,
      startDate: "2026-01-10",
    }),
    transactions: [buildTransaction({
      id: "tx-edf",
      fixedExpenseId: null,
      merchant: "EDF",
      description: "EDF FACTURE",
      date: "2026-08-11T12:00:00.000Z",
      montant: 57.25,
    })],
    referenceDate: new Date("2026-08-15T12:00:00.000Z"),
  });

  assert.equal(snapshot.paymentCount, 1);
  assert.equal(toIsoDate(snapshot.lastPayment?.date), "2026-08-11");
});
