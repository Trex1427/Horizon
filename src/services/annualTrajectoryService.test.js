import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateAnnualTrajectory,
  findFirstProjectedNegativeMonth,
  findFixedExpenseDuplicateGroups,
} from "./annualTrajectoryService.js";

const currentAccount = {
  id: "account-current",
  name: "Compte courant",
  initialBalance: 1000,
  isActive: true,
};

const savingsAccount = {
  id: "account-savings",
  name: "Epargne",
  initialBalance: 500,
  isActive: true,
};

function month(result, monthKey) {
  return result.find((entry) => entry.month === monthKey);
}

function trajectoryRows(values, { year = 2026, currentMonth = 7 } = {}) {
  return values.map((closingBalance, index) => {
    const monthNumber = index + 1;
    const status = monthNumber < currentMonth ? "actual" : monthNumber === currentMonth ? "current" : "forecast";
    return {
      month: `${year}-${String(monthNumber).padStart(2, "0")}`,
      closingBalance,
      status,
    };
  });
}

test("year without transactions keeps the initial balance cumulatively", () => {
  const result = calculateAnnualTrajectory({
    accounts: [currentAccount],
    year: 2026,
    referenceDate: new Date(2026, 7, 15),
  });

  assert.equal(result.length, 12);
  assert.equal(month(result, "2026-01").closingBalance, 1000);
  assert.equal(month(result, "2026-12").closingBalance, 1000);
});

test("documented cumulative scenario: July closes at 1800 and August at 2300", () => {
  const result = calculateAnnualTrajectory({
    accounts: [currentAccount],
    transactions: [
      { id: "salary-july", accountId: "account-current", date: "2026-07-05", type: "revenu", montant: 2000 },
      { id: "rent-july", accountId: "account-current", date: "2026-07-06", type: "depense", montant: 1200 },
    ],
    recurringIncome: [
      { id: "salary", accountId: "account-current", startDate: "2026-08-01", frequency: "mensuel", initialAmount: 2000, isActive: true },
    ],
    fixedExpenses: [
      { id: "rent", accountId: "account-current", startDate: "2026-08-01", frequency: "monthly", initialAmount: 1500, isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(month(result, "2026-07").closingBalance, 1800);
  assert.equal(month(result, "2026-08").closingBalance, 2300);
  assert.equal(month(result, "2026-07").monthlyIncome, 2000);
  assert.equal(month(result, "2026-07").monthlyExpenses, 1200);
  assert.equal(month(result, "2026-07").monthlyNet, 800);
  assert.equal(month(result, "2026-08").monthlyIncome, 2000);
  assert.equal(month(result, "2026-08").monthlyExpenses, 1500);
  assert.equal(month(result, "2026-08").monthlyNet, 500);
});

test("monthly totals handle revenue only, expense only, and combined actual months", () => {
  const revenueOnly = calculateAnnualTrajectory({
    accounts: [currentAccount],
    transactions: [
      { id: "income", accountId: "account-current", date: "2026-07-05", type: "revenu", montant: 300 },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });
  const expenseOnly = calculateAnnualTrajectory({
    accounts: [currentAccount],
    transactions: [
      { id: "expense", accountId: "account-current", date: "2026-07-05", type: "depense", montant: 125 },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });
  const combined = calculateAnnualTrajectory({
    accounts: [currentAccount],
    transactions: [
      { id: "income", accountId: "account-current", date: "2026-07-05", type: "revenu", montant: 300 },
      { id: "expense", accountId: "account-current", date: "2026-07-06", type: "depense", montant: 125 },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(month(revenueOnly, "2026-07").monthlyIncome, 300);
  assert.equal(month(revenueOnly, "2026-07").monthlyExpenses, 0);
  assert.equal(month(revenueOnly, "2026-07").monthlyNet, 300);
  assert.equal(month(revenueOnly, "2026-07").closingBalance, 1300);

  assert.equal(month(expenseOnly, "2026-07").monthlyIncome, 0);
  assert.equal(month(expenseOnly, "2026-07").monthlyExpenses, 125);
  assert.equal(month(expenseOnly, "2026-07").monthlyNet, -125);
  assert.equal(month(expenseOnly, "2026-07").closingBalance, 875);

  assert.equal(month(combined, "2026-07").monthlyIncome, 300);
  assert.equal(month(combined, "2026-07").monthlyExpenses, 125);
  assert.equal(month(combined, "2026-07").monthlyNet, 175);
  assert.equal(month(combined, "2026-07").closingBalance, 1175);
});

test("past, current and future months expose the expected status", () => {
  const result = calculateAnnualTrajectory({
    accounts: [currentAccount],
    transactions: [
      { id: "june-income", accountId: "account-current", date: "2026-06-05", type: "revenu", montant: 600 },
      { id: "june-expense", accountId: "account-current", date: "2026-06-06", type: "depense", montant: 180 },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(month(result, "2026-06").status, "actual");
  assert.equal(month(result, "2026-06").monthlyIncome, 600);
  assert.equal(month(result, "2026-06").monthlyExpenses, 180);
  assert.equal(month(result, "2026-06").monthlyNet, 420);
  assert.equal(month(result, "2026-07").status, "current");
  assert.equal(month(result, "2026-08").status, "forecast");
});

test("current month uses actual transactions and only future remaining recurring items", () => {
  const result = calculateAnnualTrajectory({
    accounts: [currentAccount],
    transactions: [
      { id: "july-income", accountId: "account-current", date: "2026-07-05", type: "revenu", montant: 100 },
      { id: "july-expense", accountId: "account-current", date: "2026-07-06", type: "depense", montant: 25 },
    ],
    recurringIncome: [
      { id: "future-income", accountId: "account-current", startDate: "2026-01-20", frequency: "mensuel", initialAmount: 200, isActive: true },
      { id: "past-income", accountId: "account-current", startDate: "2026-01-01", frequency: "mensuel", initialAmount: 300, isActive: true },
    ],
    fixedExpenses: [
      { id: "future-fixed", accountId: "account-current", startDate: "2026-01-21", frequency: "monthly", initialAmount: 50, isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(month(result, "2026-07").actualRevenue, 100);
  assert.equal(month(result, "2026-07").actualExpense, 25);
  assert.equal(month(result, "2026-07").expectedRecurringIncome, 200);
  assert.equal(month(result, "2026-07").expectedFixedExpenses, 50);
  assert.equal(month(result, "2026-07").monthlyIncome, 300);
  assert.equal(month(result, "2026-07").monthlyExpenses, 75);
  assert.equal(month(result, "2026-07").monthlyNet, 225);
  assert.equal(month(result, "2026-07").closingBalance, 1225);
});

test("future months include active recurring income from its start date", () => {
  const result = calculateAnnualTrajectory({
    accounts: [currentAccount],
    recurringIncome: [
      { id: "august-income", accountId: "account-current", startDate: "2026-08-01", frequency: "mensuel", initialAmount: 1100, isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(month(result, "2026-07").expectedRecurringIncome, 0);
  assert.equal(month(result, "2026-08").expectedRecurringIncome, 1100);
  assert.equal(month(result, "2026-08").monthlyIncome, 1100);
  assert.equal(month(result, "2026-08").monthlyExpenses, 0);
  assert.equal(month(result, "2026-08").monthlyNet, 1100);
});

test("future month exposes planned fixed expenses in monthly expenses and net", () => {
  const result = calculateAnnualTrajectory({
    accounts: [currentAccount],
    fixedExpenses: [
      { id: "rent", accountId: "account-current", startDate: "2026-08-01", frequency: "monthly", initialAmount: 450, isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(month(result, "2026-08").status, "forecast");
  assert.equal(month(result, "2026-08").monthlyIncome, 0);
  assert.equal(month(result, "2026-08").monthlyExpenses, 450);
  assert.equal(month(result, "2026-08").monthlyNet, -450);
  assert.equal(month(result, "2026-08").closingBalance, 550);
});

test("fixed expense linked to an actual transaction is not counted twice and keeps the real amount", () => {
  const result = calculateAnnualTrajectory({
    accounts: [currentAccount],
    transactions: [
      { id: "edf-august", accountId: "account-current", date: "2026-08-10", type: "depense", montant: 57.25, fixedExpenseId: "fixed-edf" },
    ],
    fixedExpenses: [
      { id: "fixed-edf", accountId: "account-current", startDate: "2026-01-20", frequency: "monthly", initialAmount: 40, isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 7, 15),
  });

  assert.equal(month(result, "2026-08").actualExpense, 57.25);
  assert.equal(month(result, "2026-08").expectedFixedExpenses, 0);
  assert.equal(month(result, "2026-08").monthlyIncome, 0);
  assert.equal(month(result, "2026-08").monthlyExpenses, 57.25);
  assert.equal(month(result, "2026-08").monthlyNet, -57.25);
  assert.equal(month(result, "2026-08").closingBalance, 942.75);
});

test("unlinked historical fallback matching prevents recurring income double counting", () => {
  const result = calculateAnnualTrajectory({
    accounts: [currentAccount],
    transactions: [
      { id: "salary", accountId: "account-current", categoryName: "Salaire", date: "2026-07-10", type: "revenu", montant: 2000 },
    ],
    recurringIncome: [
      { id: "salary-forecast", accountId: "account-current", categoryName: "Salaire", startDate: "2026-01-20", frequency: "mensuel", initialAmount: 2000, isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 5),
  });

  assert.equal(month(result, "2026-07").actualRevenue, 0);
  assert.equal(month(result, "2026-07").expectedRecurringIncome, 0);
});

test("transfer between two included accounts has no consolidated impact", () => {
  const result = calculateAnnualTrajectory({
    accounts: [currentAccount, savingsAccount],
    transfers: [
      { id: "transfer-1", sourceAccountId: "account-current", destinationAccountId: "account-savings", amount: 300, date: "2026-07-10", isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(month(result, "2026-07").transferImpact, 0);
  assert.equal(month(result, "2026-07").monthlyIncome, 0);
  assert.equal(month(result, "2026-07").monthlyExpenses, 0);
  assert.equal(month(result, "2026-07").monthlyNet, 0);
  assert.equal(month(result, "2026-07").closingBalance, 1500);
});

test("cash adjustment affects the month once and future months start from the corrected balance", () => {
  const result = calculateAnnualTrajectory({
    accounts: [currentAccount],
    transactions: [
      { id: "cash-adjustment", accountId: "account-current", date: "2026-07-10", type: "adjustment", montant: 15 },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(month(result, "2026-07").actualAdjustment, 15);
  assert.equal(month(result, "2026-07").closingBalance, 1015);
  assert.equal(month(result, "2026-08").actualAdjustment, 0);
  assert.equal(month(result, "2026-08").closingBalance, 1015);
});

test("excluded accounts, deleted transactions and archived transactions do not affect the trajectory", () => {
  const result = calculateAnnualTrajectory({
    accounts: [currentAccount, { id: "closed", name: "Clos", initialBalance: 999, isActive: false }],
    transactions: [
      { id: "closed-tx", accountId: "closed", date: "2026-07-05", type: "revenu", montant: 999 },
      { id: "deleted", accountId: "account-current", date: "2026-07-05", type: "revenu", montant: 999, isDeleted: true },
      { id: "archived", accountId: "account-current", date: "2026-07-05", type: "revenu", montant: 999, isArchived: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(month(result, "2026-07").closingBalance, 1000);
});

test("inactive items, ended items and out-of-period occurrences are ignored", () => {
  const result = calculateAnnualTrajectory({
    accounts: [currentAccount],
    recurringIncome: [
      { id: "inactive-income", accountId: "account-current", startDate: "2026-01-01", initialAmount: 100, isActive: false },
      { id: "ended-income", accountId: "account-current", startDate: "2026-01-01", endDate: "2026-06-30", initialAmount: 100, isActive: true },
    ],
    fixedExpenses: [
      { id: "inactive-fixed", accountId: "account-current", startDate: "2026-01-01", initialAmount: 100, isActive: false },
      { id: "future-fixed", accountId: "account-current", startDate: "2027-01-01", initialAmount: 100, isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(month(result, "2026-08").expectedRecurringIncome, 0);
  assert.equal(month(result, "2026-08").expectedFixedExpenses, 0);
});

test("amount variations are applied in future months", () => {
  const result = calculateAnnualTrajectory({
    accounts: [currentAccount],
    recurringIncome: [
      {
        id: "income",
        accountId: "account-current",
        startDate: "2026-01-01",
        initialAmount: 100,
        variations: [{ effectiveDate: "2026-09-01", amount: 150 }],
        isActive: true,
      },
    ],
    fixedExpenses: [
      {
        id: "fixed",
        accountId: "account-current",
        startDate: "2026-01-01",
        initialAmount: 40,
        variations: [{ effectiveDate: "2026-09-01", amount: 60 }],
        isActive: true,
      },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(month(result, "2026-08").expectedRecurringIncome, 100);
  assert.equal(month(result, "2026-09").expectedRecurringIncome, 150);
  assert.equal(month(result, "2026-08").expectedFixedExpenses, 40);
  assert.equal(month(result, "2026-09").expectedFixedExpenses, 60);
});

test("negative balance is explicit in data and December equals the annual result", () => {
  const result = calculateAnnualTrajectory({
    accounts: [{ ...currentAccount, initialBalance: 100 }],
    fixedExpenses: [
      { id: "rent", accountId: "account-current", startDate: "2026-08-01", frequency: "monthly", initialAmount: 200, isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(month(result, "2026-08").closingBalance, -100);
  assert.equal(result.at(-1).month, "2026-12");
  assert.equal(result.at(-1).closingBalance, month(result, "2026-12").closingBalance);
});

test("invalid numeric values never produce NaN or Infinity", () => {
  const result = calculateAnnualTrajectory({
    accounts: [{ ...currentAccount, initialBalance: "bad" }],
    transactions: [
      { id: "invalid", accountId: "account-current", date: "2026-07-05", type: "revenu", montant: "bad" },
    ],
    fixedExpenses: [
      { id: "fixed", accountId: "account-current", startDate: "2026-08-01", initialAmount: "bad", isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(result.every((entry) => Number.isFinite(entry.closingBalance)), true);
});

test("active duplicate fixed expense groups are reported without cleanup", () => {
  const groups = findFixedExpenseDuplicateGroups([
    { id: "a", name: "Internet", accountId: "account-current", startDate: "2026-01-01", initialAmount: 30, isActive: true },
    { id: "b", name: "Internet", accountId: "account-current", startDate: "2026-01-01", initialAmount: 30, isActive: true },
    { id: "c", name: "Internet", accountId: "account-current", startDate: "2026-01-01", initialAmount: 30, isActive: false },
  ]);

  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].ids, ["a", "b"]);
});

test("active future opportunity is included at 100 percent", () => {
  const result = calculateAnnualTrajectory({
    accounts: [currentAccount],
    opportunities: [
      { id: "kangoo", accountId: "account-current", estimatedAmount: 4500, estimatedDate: "2026-09-15", probability: 20, status: "A etudier", isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(month(result, "2026-09").expectedOpportunities, 4500);
  assert.equal(month(result, "2026-09").expectedOpportunitiesCount, 1);
  assert.equal(month(result, "2026-09").monthlyIncome, 4500);
  assert.equal(month(result, "2026-09").monthlyExpenses, 0);
  assert.equal(month(result, "2026-09").monthlyNet, 4500);
  assert.equal(month(result, "2026-12").closingBalance, 5500);
});

test("documented visible opportunities are future income and never expenses", () => {
  const result = calculateAnnualTrajectory({
    accounts: [
      currentAccount,
      { id: "account-pro", name: "Compte pro", initialBalance: 0, isActive: true },
    ],
    opportunities: [
      { id: "denis-monod", name: "Denis Monod", accountId: "account-current", estimatedAmount: 1500, estimatedDate: "2026-09-30", status: "Confirme", isActive: true, type: "depense" },
      { id: "denis-monod-fin", name: "Denis Monod fin de chantier", accountId: "account-pro", estimatedAmount: 3120, estimatedDate: "2026-09-30", status: "Confirme", isActive: true },
      { id: "celine-machet", name: "Celine Machet", accountId: "account-current", estimatedAmount: 4000, estimatedDate: "2026-10-31", status: "Confirme", isActive: true },
      { id: "indemnites-corpo", name: "Indemnites Corpo", accountId: "account-current", estimatedAmount: 5000, estimatedDate: "2026-12-31", status: "Confirme", isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 16),
  });

  assert.equal(month(result, "2026-09").expectedOpportunities, 4620);
  assert.equal(month(result, "2026-10").expectedOpportunities, 4000);
  assert.equal(month(result, "2026-12").expectedOpportunities, 5000);
  assert.equal(month(result, "2026-09").monthlyIncome, 4620);
  assert.equal(month(result, "2026-10").monthlyIncome, 4000);
  assert.equal(month(result, "2026-12").monthlyIncome, 5000);
  assert.equal(month(result, "2026-09").monthlyExpenses, 0);
  assert.equal(month(result, "2026-10").monthlyExpenses, 0);
  assert.equal(month(result, "2026-12").monthlyExpenses, 0);
  assert.equal(month(result, "2026-12").closingBalance, 14620);
});

test("legacy probability values do not change inclusion or amount", () => {
  const result = calculateAnnualTrajectory({
    accounts: [currentAccount],
    opportunities: [
      { id: "legacy-low", accountId: "account-current", estimatedAmount: 2000, estimatedDate: "2026-10-15", probability: 20, status: "Possible", isActive: true },
      { id: "legacy-high", accountId: "account-current", estimatedAmount: 2000, estimatedDate: "2026-10-20", probability: 100, status: "Probable", isActive: true },
    ],
    forecastMode: "realistic",
    opportunityProbabilityThreshold: 80,
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(month(result, "2026-10").expectedOpportunities, 4000);
  assert.equal(month(result, "2026-10").expectedOpportunitiesCount, 2);
  assert.equal(month(result, "2026-12").closingBalance, 5000);
});

test("legacy forecast modes no longer change opportunity inclusion", () => {
  const base = {
    accounts: [currentAccount],
    opportunities: [
      { id: "kangoo", accountId: "account-current", estimatedAmount: 4500, estimatedDate: "2026-09-15", probability: 70, status: "Probable", isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  };

  const certain = calculateAnnualTrajectory({ ...base, forecastMode: "certain" });
  const realistic = calculateAnnualTrajectory({ ...base, forecastMode: "realistic", opportunityProbabilityThreshold: 80 });
  const optimistic = calculateAnnualTrajectory({ ...base, forecastMode: "optimistic" });

  assert.equal(month(certain, "2026-09").expectedOpportunities, 4500);
  assert.equal(month(realistic, "2026-09").expectedOpportunities, 4500);
  assert.equal(month(optimistic, "2026-09").expectedOpportunities, 4500);
});

test("inactive, abandoned, realized, deleted and past opportunities are excluded", () => {
  const result = calculateAnnualTrajectory({
    accounts: [currentAccount],
    opportunities: [
      { id: "inactive", accountId: "account-current", estimatedAmount: 500, estimatedDate: "2026-09-15", probability: 100, status: "Confirme", isActive: false },
      { id: "abandoned", accountId: "account-current", estimatedAmount: 500, estimatedDate: "2026-09-15", probability: 100, status: "Abandonne", isActive: true },
      { id: "realized", accountId: "account-current", estimatedAmount: 500, estimatedDate: "2026-09-15", probability: 100, status: "Realise", isActive: true },
      { id: "deleted", accountId: "account-current", estimatedAmount: 500, estimatedDate: "2026-09-15", probability: 100, status: "Confirme", isActive: true, isDeleted: true },
      { id: "past", accountId: "account-current", estimatedAmount: 500, estimatedDate: "2026-06-15", probability: 100, status: "Confirme", isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(month(result, "2026-09").expectedOpportunities, 0);
  assert.equal(month(result, "2026-12").closingBalance, 1000);
});

test("realized opportunity hands off to linked transaction without double counting", () => {
  const beforeRealization = calculateAnnualTrajectory({
    accounts: [currentAccount],
    opportunities: [
      { id: "opp-1", accountId: "account-current", estimatedAmount: 800, estimatedDate: "2026-12-10", probability: 95, status: "Confirme", isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  const afterRealizationBeforeTransaction = calculateAnnualTrajectory({
    accounts: [currentAccount],
    opportunities: [
      { id: "opp-1", accountId: "account-current", estimatedAmount: 800, estimatedDate: "2026-12-10", probability: 95, status: "Realise", isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  const afterTransaction = calculateAnnualTrajectory({
    accounts: [currentAccount],
    transactions: [
      { id: "tx-opp-1", accountId: "account-current", montant: 780, date: "2026-07-12", type: "revenu", opportunityId: "opp-1" },
    ],
    opportunities: [
      { id: "opp-1", accountId: "account-current", estimatedAmount: 800, estimatedDate: "2026-12-10", probability: 95, status: "Realise", isActive: true, realizedTransactionId: "tx-opp-1" },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(month(beforeRealization, "2026-12").expectedOpportunities, 800);
  assert.equal(month(beforeRealization, "2026-12").closingBalance, 1800);
  assert.equal(month(afterRealizationBeforeTransaction, "2026-12").expectedOpportunities, 0);
  assert.equal(month(afterRealizationBeforeTransaction, "2026-12").closingBalance, 1000);
  assert.equal(month(afterTransaction, "2026-12").expectedOpportunities, 0);
  assert.equal(month(afterTransaction, "2026-07").actualRevenue, 780);
  assert.equal(month(afterTransaction, "2026-12").closingBalance, 1780);
});

test("negative alert helper returns null when no projected month is negative", () => {
  const result = findFirstProjectedNegativeMonth(trajectoryRows([10, 10, 10, 10, 10, 10, 300, 120, 15, 80, 40, 60]));

  assert.equal(result, null);
});

test("negative alert helper ignores past negative months when projected months are positive", () => {
  const result = findFirstProjectedNegativeMonth(trajectoryRows([-100, -50, -10, 20, 30, 40, 300, 120, 15, 80, 40, 60]));

  assert.equal(result, null);
});

test("negative alert helper detects the current month when it is negative", () => {
  const result = findFirstProjectedNegativeMonth(trajectoryRows([10, 10, 10, 10, 10, 10, -25, -80, 60, 70, 80, 90]));

  assert.deepEqual(result, { month: "2026-07", closingBalance: -25, status: "current" });
});

test("negative alert helper detects the first future negative month in the reference scenario", () => {
  const result = findFirstProjectedNegativeMonth(trajectoryRows([10, 10, 10, 10, 10, 10, 300, 120, 15, -80, -40, 60]));

  assert.deepEqual(result, { month: "2026-10", closingBalance: -80, status: "forecast" });
});

test("negative alert helper keeps the first month when several projected months are negative", () => {
  const result = findFirstProjectedNegativeMonth(trajectoryRows([10, 10, 10, 10, 10, 10, 300, -20, -80, -40, 60, 70]));

  assert.deepEqual(result, { month: "2026-08", closingBalance: -20, status: "forecast" });
});

test("negative alert helper does not trigger on an exact zero balance", () => {
  const result = findFirstProjectedNegativeMonth(trajectoryRows([10, 10, 10, 10, 10, 10, 0, 0, 15, 80, 40, 60]));

  assert.equal(result, null);
});

test("negative alert helper keeps a negative month even when later months return positive", () => {
  const result = findFirstProjectedNegativeMonth(trajectoryRows([10, 10, 10, 10, 10, 10, 300, 120, 15, -80, 40, 60]));

  assert.deepEqual(result, { month: "2026-10", closingBalance: -80, status: "forecast" });
});

test("negative alert helper updates from certain to realistic trajectory data", () => {
  const certain = trajectoryRows([10, 10, 10, 10, 10, 10, 300, 120, 15, -80, -40, 60]);
  const realistic = trajectoryRows([10, 10, 10, 10, 10, 10, 300, 120, 15, 220, 260, 360]);

  assert.equal(findFirstProjectedNegativeMonth(certain)?.month, "2026-10");
  assert.equal(findFirstProjectedNegativeMonth(realistic), null);
});

test("negative alert helper updates from realistic to optimistic trajectory data", () => {
  const realistic = trajectoryRows([10, 10, 10, 10, 10, 10, 300, 120, 15, -80, -40, 60]);
  const optimistic = trajectoryRows([10, 10, 10, 10, 10, 10, 300, 120, 15, 420, 460, 560]);

  assert.equal(findFirstProjectedNegativeMonth(realistic)?.month, "2026-10");
  assert.equal(findFirstProjectedNegativeMonth(optimistic), null);
});

test("negative alert helper reflects an active opportunity removing the projected risk", () => {
  const withoutOpportunity = calculateAnnualTrajectory({
    accounts: [{ ...currentAccount, initialBalance: 300 }],
    fixedExpenses: [
      { id: "rent", accountId: "account-current", startDate: "2026-10-01", frequency: "monthly", initialAmount: 400, isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });
  const withOpportunity = calculateAnnualTrajectory({
    accounts: [{ ...currentAccount, initialBalance: 300 }],
    fixedExpenses: [
      { id: "rent", accountId: "account-current", startDate: "2026-10-01", frequency: "monthly", initialAmount: 400, isActive: true },
    ],
    opportunities: [
      { id: "opp", accountId: "account-current", estimatedAmount: 1300, estimatedDate: "2026-10-15", probability: 20, status: "Probable", isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(findFirstProjectedNegativeMonth(withoutOpportunity)?.month, "2026-10");
  assert.equal(findFirstProjectedNegativeMonth(withOpportunity), null);
});

test("negative alert helper ignores invalid rows cleanly", () => {
  const result = findFirstProjectedNegativeMonth([
    { month: "bad", closingBalance: -100, status: "forecast" },
    { month: "2026-08", closingBalance: "Infinity", status: "forecast" },
    { month: "2026-09", closingBalance: undefined, status: "forecast" },
    { month: "2026-10", closingBalance: -80, status: "forecast" },
  ]);

  assert.deepEqual(result, { month: "2026-10", closingBalance: -80, status: "forecast" });
});

test("negative alert helper handles loading or error-like missing trajectory data", () => {
  assert.equal(findFirstProjectedNegativeMonth(undefined), null);
  assert.equal(findFirstProjectedNegativeMonth(null), null);
  assert.equal(findFirstProjectedNegativeMonth([]), null);
});

test("future fixed expenses reserve matching budgets across months without double counting", () => {
  const result = calculateAnnualTrajectory({
    accounts: [currentAccount, savingsAccount],
    fixedExpenses: [{
      id: "fixed-energy",
      accountId: "account-current",
      categoryId: "energy",
      categoryName: "Energie",
      startDate: "2026-08-01",
      frequency: "monthly",
      initialAmount: 40,
      isActive: true,
    }],
    budgets: [{
      id: "budget-energy",
      accountId: "account-current",
      categoryId: "energy",
      categoryName: "Energie",
      amount: 100,
      typeBudget: "depense",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      isActive: true,
    }],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(month(result, "2026-08").expectedFixedExpenses, 40);
  assert.equal(month(result, "2026-08").remainingBudgets, 60);
  assert.equal(month(result, "2026-08").monthlyExpenses, 100);
  assert.equal(month(result, "2026-09").monthlyExpenses, 100);
});
test("annual trajectory keeps subcategory reservations isolated by account for every month", () => {
  const result = calculateAnnualTrajectory({
    accounts: [currentAccount, savingsAccount],
    fixedExpenses: [
      { id: "main-electricity", categoryId: "housing", subcategoryId: "electricity", accountId: "account-current", startDate: "2026-08-01", frequency: "monthly", initialAmount: 120, isActive: true },
      { id: "savings-electricity", categoryId: "housing", subcategoryId: "electricity", accountId: "account-savings", startDate: "2026-08-01", frequency: "monthly", initialAmount: 30, isActive: true },
    ],
    budgets: [
      { id: "main-electricity-budget", categoryId: "housing", subcategoryId: "electricity", accountId: "account-current", amount: 150, typeBudget: "depense", startDate: "2026-01-01", isActive: true },
      { id: "savings-electricity-budget", categoryId: "housing", subcategoryId: "electricity", accountId: "account-savings", amount: 50, typeBudget: "depense", startDate: "2026-01-01", isActive: true },
    ],
    year: 2026,
    referenceDate: new Date(2026, 6, 15),
  });

  assert.equal(month(result, "2026-08").expectedFixedExpenses, 150);
  assert.equal(month(result, "2026-08").remainingBudgets, 50);
  assert.equal(month(result, "2026-08").monthlyExpenses, 200);
  assert.equal(month(result, "2026-09").monthlyExpenses, 200);
});
