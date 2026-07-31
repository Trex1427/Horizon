import { useMemo } from "react";
import { useAccounts } from "./useAccounts";
import { useTransactions } from "./useTransactions";
import { useFixedExpenses } from "./useFixedExpenses";
import { useRecurringIncome } from "./useRecurringIncome";
import { useBudgets } from "./useBudgets";
import { useTransfers } from "./useTransfers";
import { useOpportunities } from "./useOpportunities";
import { calculateAnnualTrajectory, selectCurrentMonthForecast } from "../services/annualTrajectoryService";

export function useForecast() {
  const { accounts, loading: accountsLoading, error: accountsError } = useAccounts();
  const { transactions, loading: transactionsLoading, error: transactionsError } = useTransactions();
  const { fixedExpenses, loading: fixedExpensesLoading, error: fixedExpensesError } = useFixedExpenses();
  const { recurringIncome, loading: recurringIncomeLoading, error: recurringIncomeError } = useRecurringIncome();
  const { budgets, loading: budgetsLoading, error: budgetsError } = useBudgets();
  const { transfers, loading: transfersLoading, error: transfersError } = useTransfers();
  const { opportunities, loading: opportunitiesLoading, error: opportunitiesError } = useOpportunities();

  const loading =
    accountsLoading ||
    transactionsLoading ||
    fixedExpensesLoading ||
    recurringIncomeLoading ||
    budgetsLoading ||
    transfersLoading ||
    opportunitiesLoading;

  const error =
    accountsError ||
    transactionsError ||
    fixedExpensesError ||
    recurringIncomeError ||
    budgetsError ||
    transfersError ||
    opportunitiesError ||
    null;

  const forecast = useMemo(() => {
    const trajectory = calculateAnnualTrajectory({
      accounts, transactions, transfers, fixedExpenses, recurringIncome, budgets, opportunities,
    });
    return selectCurrentMonthForecast(trajectory) || {
      currentBalance: 0, expectedRecurringIncome: 0, expectedFixedExpenses: 0,
      remainingBudgets: 0, forecastEndOfMonth: 0, monthStart: null, monthEnd: null,
    };
  }, [
    accounts, transactions, transfers, fixedExpenses, recurringIncome, budgets, opportunities,
  ]);

  return {
    loading,
    error,
    forecast,
  };
}
