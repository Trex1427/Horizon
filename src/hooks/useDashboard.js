import { useMemo } from "react";
import { calculateAccountsBalances, toDateValue } from "../services/financeCalculations";
import { buildMonthlyExpenseCategoryData, buildMonthlyIncomeCategoryData } from "../utils/chartDataUtils";
import { normalizeTransactionType } from "../utils/transactionTypeUtils";
import { useTransfers } from "./useTransfers";

function toNumber(value) {
  return Number(value) || 0;
}

export function useDashboard(transactions = [], accounts = []) {
  const { transfers = [] } = useTransfers();

  return useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const currentMonthTransactions = (transactions || []).filter((transaction) => {
      const rawDate = transaction?.date;
      const date = typeof rawDate?.toDate === "function"
        ? rawDate.toDate()
        : new Date(rawDate);

      if (Number.isNaN(date.getTime())) {
        return false;
      }

      return date.getFullYear() === currentYear && date.getMonth() === currentMonth;
    });

    const revenues = currentMonthTransactions.filter((transaction) => normalizeTransactionType(transaction.type) === "revenu");
    const expenses = currentMonthTransactions.filter((transaction) => normalizeTransactionType(transaction.type) === "depense");

    const totalRevenue = revenues.reduce((sum, transaction) => sum + toNumber(transaction.montant), 0);
    const totalExpense = expenses.reduce((sum, transaction) => sum + toNumber(transaction.montant), 0);

    const monthlySavings = totalRevenue - totalExpense;
    const remaining = monthlySavings;

    const monthNames = [
      "Jan",
      "Fév",
      "Mar",
      "Avr",
      "Mai",
      "Juin",
      "Juil",
      "Aoû",
      "Sep",
      "Oct",
      "Nov",
      "Déc",
    ];

    const yearTrend = Array.from({ length: 12 }, (_, index) => {
      const monthKey = `${currentYear}-${String(index + 1).padStart(2, "0")}`;
      const monthTransactions = (transactions || []).filter((transaction) => {
        const date = toDateValue(transaction?.date);
        if (!date) {
          return false;
        }

        const transactionMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        return transactionMonthKey === monthKey;
      });
      const monthRevenue = monthTransactions
        .filter((transaction) => normalizeTransactionType(transaction.type) === "revenu")
        .reduce((sum, transaction) => sum + toNumber(transaction.montant), 0);
      const monthExpense = monthTransactions
        .filter((transaction) => normalizeTransactionType(transaction.type) === "depense")
        .reduce((sum, transaction) => sum + toNumber(transaction.montant), 0);

      return {
        label: monthNames[index],
        net: monthRevenue - monthExpense,
      };
    });

    const accountBalances = calculateAccountsBalances(accounts, transactions, transfers);

    const totalBalance = accountBalances.reduce((sum, account) => sum + toNumber(account.balance), 0);

    const sortedTransactions = [...(transactions || [])]
      .sort((left, right) => {
        const leftDate = left?.date || "";
        const rightDate = right?.date || "";
        return rightDate.localeCompare(leftDate);
      })
      .slice(0, 5);

    const categoryTotals = expenses.reduce((groups, transaction) => {
      const category = transaction?.categoryName || transaction?.categorie || "Autre";
      groups[category] = (groups[category] || 0) + toNumber(transaction.montant);
      return groups;
    }, {});

    const categorySummary = Object.entries(categoryTotals)
      .map(([name, amount]) => ({ name, amount }))
      .sort((left, right) => right.amount - left.amount);

    const monthlyExpenseCategoryData = buildMonthlyExpenseCategoryData(currentMonthTransactions, {
      maxCategories: 6,
    });
    const monthlyIncomeCategoryData = buildMonthlyIncomeCategoryData(currentMonthTransactions, {
      maxCategories: 6,
    });

    const largestExpense = [...expenses].sort((left, right) => toNumber(right.montant) - toNumber(left.montant))[0] || null;
    const largestRevenue = [...revenues].sort((left, right) => toNumber(right.montant) - toNumber(left.montant))[0] || null;
    const mostExpensiveCategory = categorySummary[0] || null;

    return {
      balance: totalBalance,
      remaining,
      totalRevenue,
      totalExpense,
      monthlySavings,
      yearTrend,
      transactionCount: currentMonthTransactions.length,
      recentTransactions: sortedTransactions,
      categorySummary,
      monthlyExpenseCategoryData,
      monthlyIncomeCategoryData,
      largestExpense,
      largestRevenue,
      mostExpensiveCategory,
      accountBalances,
    };
  }, [transactions, accounts, transfers]);
}
