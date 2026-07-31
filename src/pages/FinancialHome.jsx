import { Alert, CircularProgress, Stack, Typography } from "@mui/material";
import { useMemo } from "react";
import HorizonCockpit from "../components/HorizonCockpit.jsx";
import { CASH_ACCOUNT_NAME, CASH_ACCOUNT_TYPE } from "../constants/cashBalanceConstants.js";
import { useTransactionsContext } from "../context/TransactionsContext.jsx";
import { useBudgets } from "../hooks/useBudgets.js";
import { useDashboard } from "../hooks/useDashboard.js";
import { useFixedExpenses } from "../hooks/useFixedExpenses.js";
import { useOpportunities } from "../hooks/useOpportunities.js";
import { useRecurringIncome } from "../hooks/useRecurringIncome.js";
import { useTransfers } from "../hooks/useTransfers.js";
import { calculateAnnualTrajectory } from "../services/annualTrajectoryService.js";
import { createCashBalanceAdjustment } from "../services/cashBalanceAdjustmentService.js";
import { hasCashAccountHistory } from "../utils/cashBalanceAdjustment.js";
import { selectAccountsForBalanceDisplay } from "../utils/accountBalanceDisplay.js";

export default function FinancialHome({
  accounts = [], accountsLoading = false, accountsError = null,
  onOpenTransactions, onOpenAnalysisMonth, onOpenOpportunities,
}) {
  const { transactions, loading: transactionsLoading, error: transactionsError } = useTransactionsContext();
  const fixedExpensesApi = useFixedExpenses();
  const recurringIncomeApi = useRecurringIncome();
  const opportunitiesApi = useOpportunities();
  const budgetsApi = useBudgets();
  const transfersApi = useTransfers();
  const balanceDisplayAccounts = useMemo(() => selectAccountsForBalanceDisplay(accounts), [accounts]);
  const dashboardMetrics = useDashboard(transactions, balanceDisplayAccounts);
  const annualTrajectory = useMemo(() => calculateAnnualTrajectory({
    accounts,
    transactions,
    transfers: transfersApi.transfers,
    fixedExpenses: fixedExpensesApi.fixedExpenses,
    recurringIncome: recurringIncomeApi.recurringIncome,
    budgets: budgetsApi.budgets,
    opportunities: opportunitiesApi.opportunities,
  }), [
    accounts, transactions, transfersApi.transfers, fixedExpensesApi.fixedExpenses,
    recurringIncomeApi.recurringIncome, budgetsApi.budgets, opportunitiesApi.opportunities,
  ]);

  const loading = accountsLoading || transactionsLoading || fixedExpensesApi.loading
    || recurringIncomeApi.loading || opportunitiesApi.loading || budgetsApi.loading || transfersApi.loading;
  const currentForecast = annualTrajectory.find((row) => row.status === "current") || null;
  const forecastEndOfMonth = currentForecast?.closingBalance ?? dashboardMetrics.balance;
  const error = accountsError || transactionsError || fixedExpensesApi.error || recurringIncomeApi.error
    || opportunitiesApi.error || budgetsApi.error || transfersApi.error || null;
  const cashAccount = dashboardMetrics.accountBalances.find((account) => (
    account?.type === CASH_ACCOUNT_TYPE || account?.name === CASH_ACCOUNT_NAME
  ));
  const cashHasHistory = hasCashAccountHistory(cashAccount?.id, transactions, transfersApi.transfers);
  const adjustCashBalance = async (payload) => {
    try {
      await createCashBalanceAdjustment(payload);
      return { success: true };
    } catch (caughtError) {
      return { success: false, error: caughtError?.message || "Erreur d'ajustement du solde Espèces" };
    }
  };

  if (loading) {
    return <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }}><CircularProgress /><Typography>Chargement de votre trajectoire financière...</Typography></Stack>;
  }

  if (!accounts.length) {
    return <Alert severity="info">Ajoutez un compte pour calculer votre solde actuel et votre trajectoire prévisionnelle.</Alert>;
  }

  if (error) {
    return <Alert severity="error">Impossible de calculer la trajectoire financière. {String(error)}</Alert>;
  }

  return <HorizonCockpit
    metrics={{ ...dashboardMetrics, remaining: forecastEndOfMonth, annualTrajectory, annualTrajectoryError: null,
      cashBalance: { hasHistory: cashHasHistory, onSubmit: adjustCashBalance } }}
    onOpenTransactions={onOpenTransactions}
    onOpenAnalysisMonth={onOpenAnalysisMonth}
    onOpenOpportunities={onOpenOpportunities}
  />;
}
