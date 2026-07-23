import { calculateAccountsBalances } from "../../../services/financeCalculations.js";

export function computeImportReconciliation({ account = null, existingTransactions = [], importRows = [], statementBalance = null } = {}) {
  if (statementBalance === null || statementBalance === undefined || !account) {
    return null;
  }

  const simulatedTransactions = importRows
    .filter((row) => row.userDecision === "import")
    .map((row) => ({
      accountId: row.accountId,
      destinationAccountId: null,
      type: row.type,
      montant: Math.abs(Number(row.amount || 0)),
    }));

  const balances = calculateAccountsBalances([account], [...existingTransactions, ...simulatedTransactions]);
  const horizonBalance = Number(balances[0]?.balance || 0);
  const importedStatementBalance = Number(statementBalance);

  if (!Number.isFinite(importedStatementBalance)) {
    return null;
  }

  return {
    horizonBalance,
    statementBalance: importedStatementBalance,
    delta: horizonBalance - importedStatementBalance,
  };
}

export function detectRecurringCandidates(rows = []) {
  const groups = (rows || [])
    .filter((row) => row.userDecision === "import")
    .reduce((accumulator, row) => {
      const key = `${row.type}|${row.normalizedLabel}|${Math.abs(Number(row.amount || 0)).toFixed(2)}`;
      accumulator[key] = accumulator[key] || [];
      accumulator[key].push(row);
      return accumulator;
    }, {});

  return Object.values(groups)
    .filter((items) => items.length >= 3)
    .map((items) => ({
      label: items[0].rawLabel,
      type: items[0].type,
      count: items.length,
      amount: Math.abs(Number(items[0].amount || 0)),
      suggestedAction: items[0].type === "revenu" ? "create_recurring_income" : "create_fixed_expense",
      autoCreated: false,
    }));
}