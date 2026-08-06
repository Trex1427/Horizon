import { Alert, CircularProgress, Stack, Typography } from "../components/ui/foundations/MuiPrimitives";
import { useMemo } from "react";
import HorizonCockpit from "../components/HorizonCockpit.jsx";
import DashboardV2 from "../components/dashboard-v2/DashboardV2.jsx";
import { CASH_ACCOUNT_NAME, CASH_ACCOUNT_TYPE } from "../constants/cashBalanceConstants.js";
import { useTransactionsContext } from "../context/TransactionsContext.jsx";
import { useBudgets } from "../hooks/useBudgets.js";
import { useDashboard } from "../hooks/useDashboard.js";
import { useFixedExpenses } from "../hooks/useFixedExpenses.js";
import { useWorkQuotes } from "../hooks/useWorkQuotes.js";
import { useWorkInvoices } from "../hooks/useWorkInvoices.js";
import { calculateProfessionalDashboard } from "../services/professionalDashboardService.js";
import { useRecurringIncome } from "../hooks/useRecurringIncome.js";
import { useTransfers } from "../hooks/useTransfers.js";
import { calculateAnnualTrajectory } from "../services/annualTrajectoryService.js";
import { createCashBalanceAdjustment } from "../services/cashBalanceAdjustmentService.js";
import { hasCashAccountHistory } from "../utils/cashBalanceAdjustment.js";
import { selectAccountsForBalanceDisplay } from "../utils/accountBalanceDisplay.js";

export default function FinancialHome({
  accounts = [], accountsLoading = false, accountsError = null,
  onOpenTransactions, onOpenAnalysisMonth, onOpenForecast, onOpenAccounts, onOpenQuotes, onOpenInvoices, onOpenAnalysis,
  variant = "current", onNavigateV2,
}) {
  const { transactions, loading: transactionsLoading, error: transactionsError } = useTransactionsContext();
  const fixedExpensesApi = useFixedExpenses();
  const recurringIncomeApi = useRecurringIncome();
  const quotesApi = useWorkQuotes({ includeDocuments: false });
  const invoicesApi = useWorkInvoices();
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
  }), [
    accounts, transactions, transfersApi.transfers, fixedExpensesApi.fixedExpenses,
    recurringIncomeApi.recurringIncome, budgetsApi.budgets,
  ]);

  const loading = accountsLoading || transactionsLoading || fixedExpensesApi.loading
    || recurringIncomeApi.loading || quotesApi.loading || invoicesApi.loading || budgetsApi.loading || transfersApi.loading;
  const currentForecast = annualTrajectory.find((row) => row.status === "current") || null;
  const forecastEndOfMonth = currentForecast?.closingBalance ?? dashboardMetrics.balance;
  const error = accountsError || transactionsError || fixedExpensesApi.error || recurringIncomeApi.error
    || quotesApi.error || invoicesApi.error || budgetsApi.error || transfersApi.error || null;
  const professionalSummary = useMemo(() => calculateProfessionalDashboard({
    quotes: quotesApi.quotes, invoices: invoicesApi.invoices, projects: [], transactions: [], activities: [], thirdParties: [],
  }), [quotesApi.quotes, invoicesApi.invoices]);
  const uncategorizedCount = useMemo(() => transactions.filter((transaction) => transaction?.isDeleted !== true
    && !transaction?.categoryId && !String(transaction?.categoryName || transaction?.categorie || "").trim()).length, [transactions]);
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

  const logReturn = (branch, returnedComponent) => {
    if (typeof window === "undefined") return;
    console.log("[FINANCIAL_HOME]", {
      branch,
      variant,
      returnedComponent,
    });
  };

  if (typeof window !== "undefined") {
    console.log("[DIAG][FinancialHome]", {
      variant,
      accountsCount: accounts.length,
      pathname: window.location.pathname,
      search: window.location.search,
    });
  }

  if (loading) {
    console.log("[RENDER] FinancialHome loading");
    console.log("[DIAG][FinancialHome] => branche loading");
    logReturn(1, "Stack(CircularProgress)");
    return <Stack alignItems="center" spacing={1.5} sx={{ py: 6 }}><CircularProgress /><Typography>Chargement de votre trajectoire financière...</Typography></Stack>;
  }

  if (variant === "v2") {
    console.log("[RENDER] FinancialHome v2");
    console.log("[RENDER] DashboardV2");
    console.log("[DIAG][FinancialHome] => branche V2");
    logReturn(2, "DashboardV2");
    return <DashboardV2
      metrics={{ ...dashboardMetrics, remaining: forecastEndOfMonth, annualTrajectory }}
      budgets={budgetsApi.budgets}
      notificationsCount={uncategorizedCount}
      onNavigate={onNavigateV2}
      onCreateTransaction={onOpenTransactions}
    />;
  }

  if (!accounts.length) {
    console.log("[RENDER] FinancialHome legacy");
    console.log("[RENDER] EmptyState Ajoutez un compte");
    console.log("[DIAG][FinancialHome] => branche legacy HOME no-account");
    logReturn(3, "Alert(info)");
    return <Alert severity="info">Ajoutez un compte pour calculer votre solde actuel et votre trajectoire prévisionnelle.</Alert>;
  }

  if (error) {
    console.log("[RENDER] FinancialHome legacy error");
    console.log("[DIAG][FinancialHome] => branche legacy HOME error");
    logReturn(4, "Alert(error)");
    return <Alert severity="error">Impossible de calculer la trajectoire financière. {String(error)}</Alert>;
  }

  console.log("[RENDER] HorizonCockpit");
  console.log("[DIAG][FinancialHome] => branche legacy HOME cockpit");
  logReturn(5, "HorizonCockpit");

  return <HorizonCockpit
    metrics={{ ...dashboardMetrics, remaining: forecastEndOfMonth, annualTrajectory, annualTrajectoryError: null,
      pendingQuotes: professionalSummary.alerts.quotesToFollowUp, overdueInvoices: professionalSummary.alerts.overdueInvoices, uncategorizedCount,
      cashBalance: { hasHistory: cashHasHistory, onSubmit: adjustCashBalance } }}
    onOpenTransactions={onOpenTransactions}
    onOpenAnalysisMonth={onOpenAnalysisMonth}
    onOpenForecast={onOpenForecast}
    onOpenAccounts={onOpenAccounts}
    onOpenQuotes={onOpenQuotes}
    onOpenInvoices={onOpenInvoices}
    onOpenAnalysis={onOpenAnalysis}
  />;
}
