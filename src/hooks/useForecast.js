import { useMemo } from "react";
import { useAccounts } from "./useAccounts";
import { useTransactions } from "./useTransactions";
import { useFixedExpenses } from "./useFixedExpenses";
import { useRecurringIncome } from "./useRecurringIncome";
import { useBudgets } from "./useBudgets";
import { useTransfers } from "./useTransfers";
import { calculateMonthlyForecast } from "../services/forecastService";

export function useForecast() {
  const { accounts, loading: accountsLoading, error: accountsError } = useAccounts();
  const { transactions, loading: transactionsLoading, error: transactionsError } = useTransactions();
  const { fixedExpenses, loading: fixedExpensesLoading, error: fixedExpensesError } = useFixedExpenses();
  const { recurringIncome, loading: recurringIncomeLoading, error: recurringIncomeError } = useRecurringIncome();
  const { budgets, loading: budgetsLoading, error: budgetsError } = useBudgets();
  const { transfers, loading: transfersLoading, error: transfersError } = useTransfers();

  const loading =
    accountsLoading ||
    transactionsLoading ||
    fixedExpensesLoading ||
    recurringIncomeLoading ||
    budgetsLoading ||
    transfersLoading;

  const error =
    accountsError ||
    transactionsError ||
    fixedExpensesError ||
    recurringIncomeError ||
    budgetsError ||
    transfersError ||
    null;

  const forecast = useMemo(
    () =>
      calculateMonthlyForecast({
        accounts,
        transactions,
        transfers,
        fixedExpenses,
        recurringIncome,
        budgets,
      }),
    [accounts, transactions, transfers, fixedExpenses, recurringIncome, budgets]
  );

  return {
    loading,
    error,
    forecast,
  };
}
