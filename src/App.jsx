import { useCallback, useEffect, useMemo, useState } from "react";
import Transactions from "./pages/Transactions";
import Objectifs from "./pages/Objectifs";
import FraisFixes from "./pages/FraisFixes";
import RevenusRecurrents from "./pages/RevenusRecurrents";
import Opportunites from "./pages/Opportunites";
import DettesCreances from "./pages/DettesCreances";
import Budgets from "./pages/Budgets";
import Analyse from "./pages/Analyse";
import Previsions from "./pages/Previsions";
import Categories from "./pages/Categories";
import Referentiels from "./pages/Referentiels";
import Parametres from "./pages/Parametres";
import ImportHistory from "./pages/ImportHistory";
import Travail from "./pages/Travail";
import { TransactionsProvider, useTransactionsContext } from "./context/TransactionsContext";
import { RecurringIncomeProvider } from "./context/RecurringIncomeContext";
import { AuthGate } from "./auth/AuthGate";
import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./auth/useAuth";
import { useAccounts } from "./hooks/useAccounts";
import { useDashboard } from "./hooks/useDashboard";
import { useBudgets } from "./hooks/useBudgets";
import { useFixedExpenses } from "./hooks/useFixedExpenses";
import { useOpportunities } from "./hooks/useOpportunities";
import { useRecurringIncome } from "./hooks/useRecurringIncome";
import { useTransfers } from "./hooks/useTransfers";
import HorizonCockpit from "./components/HorizonCockpit";
import { calculateAnnualTrajectory } from "./services/annualTrajectoryService";
import { createCashBalanceAdjustment } from "./services/cashBalanceAdjustmentService";
import { CASH_ACCOUNT_NAME, CASH_ACCOUNT_TYPE } from "./constants/cashBalanceConstants";
import { hasCashAccountHistory } from "./utils/cashBalanceAdjustment";
import { selectAccountsForBalanceDisplay } from "./utils/accountBalanceDisplay";
import {
  buildPageUrl,
  getPageFromLocation,
  MOBILE_PRIMARY_PAGES,
  MOBILE_SECONDARY_PAGES,
  PAGE_ORDER,
  PAGES,
} from "./navigation/appNavigation";

import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Container,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  BottomNavigation,
  BottomNavigationAction,
  Fab,
  IconButton,
  Tooltip,
  useMediaQuery,
} from "@mui/material";

import Home from "@mui/icons-material/Home";
import ReceiptLong from "@mui/icons-material/ReceiptLong";
import AccountBalance from "@mui/icons-material/AccountBalance";
import PieChart from "@mui/icons-material/PieChart";
import ShowChart from "@mui/icons-material/ShowChart";
import EmojiEvents from "@mui/icons-material/EmojiEvents";
import MoreHoriz from "@mui/icons-material/MoreHoriz";
import Settings from "@mui/icons-material/Settings";
import Add from "@mui/icons-material/Add";
import Category from "@mui/icons-material/Category";
import UploadFile from "@mui/icons-material/UploadFile";
import Logout from "@mui/icons-material/Logout";
import Work from "@mui/icons-material/Work";

const MORE_MENU_PAGES = [
  {
    key: PAGES.CATEGORIES,
    label: "Catégories",
    icon: <Category />,
    page: PAGES.CATEGORIES,
  },
  {
    key: PAGES.REFERENTIELS,
    label: "Référentiels",
    icon: <Category />,
    page: PAGES.REFERENTIELS,
  },
  {
    key: PAGES.FRAIS_FIXES,
    label: "Frais fixes",
    icon: <PieChart />,
    page: PAGES.FRAIS_FIXES,
  },
  {
    key: PAGES.REVENUS_RECURRENTS,
    label: "Revenus récurrents",
    icon: <ReceiptLong />,
    page: PAGES.REVENUS_RECURRENTS,
  },
  {
    key: PAGES.TRAVAIL,
    label: "Travail",
    icon: <Work />,
    page: PAGES.TRAVAIL,
  },
  {
    key: PAGES.OPPORTUNITES,
    label: "Opportunités",
    icon: <ShowChart />,
    page: PAGES.OPPORTUNITES,
  },
  {
    key: PAGES.DETTES_CREANCES,
    label: "Dettes et créances",
    icon: <AccountBalance />,
    page: PAGES.DETTES_CREANCES,
  },
  {
    key: PAGES.OBJECTIFS,
    label: "Objectifs",
    icon: <EmojiEvents />,
    page: PAGES.OBJECTIFS,
  },
  {
    key: PAGES.PREVISIONS,
    label: "Prévisions",
    icon: <ShowChart />,
    page: PAGES.PREVISIONS,
  },
  {
    key: PAGES.ANALYSE,
    label: "Analyse",
    icon: <ShowChart />,
    page: PAGES.ANALYSE,
  },
  {
    key: "SCANNER",
    label: "Scanner ticket",
    icon: <ReceiptLong />,
    page: PAGES.TRANSACTIONS,
  },
  {
    key: "BANK_IMPORT",
    label: "Import bancaire",
    icon: <UploadFile />,
    page: PAGES.TRANSACTIONS,
  },
  {
    key: PAGES.IMPORT_HISTORY,
    label: "Historique des imports",
    icon: <ReceiptLong />,
    page: PAGES.IMPORT_HISTORY,
  },
  {
    key: PAGES.PARAMETRES,
    label: "Paramètres",
    icon: <Settings />,
    page: PAGES.PARAMETRES,
  },
];

function AppContent() {
  const { logout, showLocalDiagnostic, uid, user } = useAuth();
  const [page, setPage] = useState(() => getPageFromLocation(typeof window === "undefined" ? null : window.location));
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const [receiptImportRequestId, setReceiptImportRequestId] = useState(0);
  const [bankImportRequestId, setBankImportRequestId] = useState(0);
  const [transactionsNavigationContext, setTransactionsNavigationContext] = useState(null);
  const [analysisNavigationContext, setAnalysisNavigationContext] = useState(null);
  const navigateToPage = useCallback((nextPage, { replace = false } = {}) => {
    if (!PAGE_ORDER.includes(nextPage)) return;
    setPage(nextPage);
    if (typeof window === "undefined") return;
    const nextUrl = buildPageUrl(nextPage, window.location);
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl === currentUrl) return;
    window.history[replace ? "replaceState" : "pushState"]({ page: nextPage }, "", nextUrl);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const initialPage = getPageFromLocation(window.location);
    const canonicalUrl = buildPageUrl(initialPage, window.location);
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (canonicalUrl !== currentUrl) {
      window.history.replaceState({ page: initialPage }, "", canonicalUrl);
    }
    const handlePopState = () => setPage(getPageFromLocation(window.location));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  const { transactions, loading, error: transactionsError } = useTransactionsContext();
  const { accounts, defaultAccount, loading: accountsLoading, error: accountsError, addAccount, updateAccount, deleteAccount } = useAccounts();
  const { fixedExpenses, loading: fixedExpensesLoading, error: fixedExpensesError } = useFixedExpenses();
  const { recurringIncome, loading: recurringIncomeLoading, error: recurringIncomeError } = useRecurringIncome();
  const { opportunities, loading: opportunitiesLoading, error: opportunitiesError } = useOpportunities();
  const { budgets, loading: budgetsLoading, error: budgetsError } = useBudgets();
  const { transfers, loading: transfersLoading, error: transfersError } = useTransfers();
  const balanceDisplayAccounts = useMemo(() => selectAccountsForBalanceDisplay(accounts), [accounts]);
  const dashboardMetrics = useDashboard(transactions, balanceDisplayAccounts);
  const annualTrajectory = calculateAnnualTrajectory({
    accounts,
    transactions,
    transfers,
    fixedExpenses,
    recurringIncome,
    budgets,
    opportunities,
  });
  const cashAccount = dashboardMetrics.accountBalances.find((account) => (
    account?.type === CASH_ACCOUNT_TYPE || account?.name === CASH_ACCOUNT_NAME
  ));
  const cashHasHistory = hasCashAccountHistory(cashAccount?.id, transactions, transfers);
  const dashboardLoading = loading || accountsLoading || fixedExpensesLoading || recurringIncomeLoading || opportunitiesLoading || budgetsLoading || transfersLoading;
  const dashboardError = transactionsError || accountsError || fixedExpensesError || recurringIncomeError || opportunitiesError || budgetsError || transfersError || null;
  const isMobilePortrait = useMediaQuery("(max-width:600px) and (orientation: portrait)");

  const mobileBottomNavValue = MOBILE_PRIMARY_PAGES.includes(page)
    ? page
    : MOBILE_SECONDARY_PAGES.includes(page) ? "MORE" : false;
  const navSurfaceSx = {
    background: "linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(249,250,245,0.98) 100%)",
    borderTop: "1px solid",
    borderColor: "rgba(20, 41, 43, 0.14)",
    backdropFilter: "blur(10px)",
    boxShadow: "0 -8px 24px rgba(20, 41, 43, 0.08)",
  };

  function handleMobileNavigationChange(event, value) {
    if (value === "ADD") {
      openTransactionsWithContext(null);
      return;
    }

    if (value === "MORE") {
      setMoreDrawerOpen(true);
      return;
    }

    navigateToPage(value);
  }

  function openTransactionsWithContext(context = null) {
    setTransactionsNavigationContext(context ? {
      ...context,
      requestId: Date.now(),
      source: context?.source || "analysis",
    } : null);
    navigateToPage(PAGES.TRANSACTIONS);
  }

  function openAnalysisWithContext(context = null) {
    setAnalysisNavigationContext(context ? {
      ...context,
      requestId: Date.now(),
      source: "cockpit",
    } : null);
    navigateToPage(PAGES.ANALYSE);
  }

  function openAnalysisMonth(monthKey, referenceDate) {
    openAnalysisWithContext({
      monthKey,
      period: "currentMonth",
      referenceDate: referenceDate instanceof Date ? referenceDate.toISOString() : null,
    });
  }

  return (
    <Box sx={{ minHeight: "100dvh", overflowX: "hidden", pb: isMobilePortrait ? "calc(72px + env(safe-area-inset-bottom, 0px))" : 10 }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          top: 0,
          background: "linear-gradient(135deg, #0f5257 0%, #1b7f8a 100%)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.25)",
          boxShadow: "0 8px 24px rgba(15, 82, 87, 0.26)",
          backdropFilter: "blur(8px)",
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 62, sm: 68 } }}>
          <Typography
            variant="h6"
            sx={{
              fontFamily: '"Fraunces", "Times New Roman", serif',
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: "#f3f5e9",
              flexGrow: 1,
            }}
          >
            Horizon
          </Typography>

          {showLocalDiagnostic && (
            <Box
              sx={{
                display: "block",
                maxWidth: { xs: 190, sm: 360 },
                mr: 1.5,
                px: 1.25,
                py: 0.5,
                border: "1px solid rgba(243, 245, 233, 0.35)",
                borderRadius: 1.5,
                color: "#f3f5e9",
              }}
            >
              <Typography variant="caption" sx={{ display: "block", lineHeight: 1.2 }}>
                Diagnostic local: {user?.displayName || user?.email || "utilisateur Firebase"}
              </Typography>
              <Typography variant="caption" sx={{ display: "block", lineHeight: 1.2, wordBreak: "break-all" }}>
                UID: {uid}
              </Typography>
            </Box>
          )}

          {!isMobilePortrait && (
            <Box sx={{ display: "flex", gap: 1 }}>
              <Tooltip title="Paramètres">
                <IconButton
                  onClick={() => navigateToPage(PAGES.PARAMETRES)}
                  sx={{
                    color: "#f3f5e9",
                    border: "1px solid rgba(243, 245, 233, 0.4)",
                    background: page === PAGES.PARAMETRES ? "rgba(243, 245, 233, 0.2)" : "transparent",
                    "&:hover": {
                      background: "rgba(243, 245, 233, 0.28)",
                    },
                  }}
                  aria-label="Ouvrir les paramètres"
                >
                  <Settings />
                </IconButton>
              </Tooltip>
              <Tooltip title="Se déconnecter">
                <IconButton
                  onClick={logout}
                  sx={{
                    color: "#f3f5e9",
                    border: "1px solid rgba(243, 245, 233, 0.4)",
                    "&:hover": {
                      background: "rgba(243, 245, 233, 0.28)",
                    },
                  }}
                  aria-label="Se déconnecter"
                >
                  <Logout />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Container
        sx={{
          mt: { xs: 2, sm: 3 },
          mb: { xs: 2, sm: 4 },
          px: { xs: 1.25, sm: 2 },
        }}
      >
        <Box
          sx={{
            borderRadius: { xs: 3, sm: 4 },
            border: "1px solid rgba(20, 41, 43, 0.12)",
            background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,251,247,0.96) 100%)",
            boxShadow: "0 22px 44px rgba(20, 41, 43, 0.1)",
            p: { xs: 1.25, sm: 2.5 },
          }}
        >
        {page === PAGES.HOME && (
          <>
            {dashboardLoading ? (
              <Typography color="text.secondary">Chargement du tableau de bord...</Typography>
            ) : (
              <HorizonCockpit
                metrics={{
                  ...dashboardMetrics,
                  annualTrajectory,
                  annualTrajectoryError: dashboardError,
                  cashBalance: {
                    hasHistory: cashHasHistory,
                    onSubmit: async (payload) => {
                      try {
                        await createCashBalanceAdjustment(payload);
                        return { success: true };
                      } catch (err) {
                        return { success: false, error: err?.message || "Erreur lors de l'ajustement du solde Espèces" };
                      }
                    },
                  },
                }}
                onOpenTransactions={() => openTransactionsWithContext(null)}
                onOpenAnalysisMonth={openAnalysisMonth}
                onOpenOpportunities={() => navigateToPage(PAGES.OPPORTUNITES)}
              />
            )}
          </>
        )}

        {page === PAGES.TRANSACTIONS && (
          <Transactions
            openReceiptImportRequestId={receiptImportRequestId}
            openBankImportRequestId={bankImportRequestId}
            navigationContext={transactionsNavigationContext}
            onNavigationContextApplied={() => setTransactionsNavigationContext(null)}
          />
        )}

        {page === PAGES.OBJECTIFS && <Objectifs />}

        {page === PAGES.FRAIS_FIXES && <FraisFixes />}

        {page === PAGES.REVENUS_RECURRENTS && <RevenusRecurrents />}

        {page === PAGES.TRAVAIL && <Travail onOpenTransaction={(transactionId) => openTransactionsWithContext({ source: "analysis", transactionIds: [transactionId] })} />}

        {page === PAGES.OPPORTUNITES && <Opportunites />}

        {page === PAGES.DETTES_CREANCES && (
          <DettesCreances
            accounts={accounts}
            defaultAccount={defaultAccount}
            accountsLoading={accountsLoading}
            accountsError={accountsError}
          />
        )}

        {page === PAGES.BUDGETS && <Budgets />}

        {page === PAGES.PREVISIONS && <Previsions />}

        {page === PAGES.ANALYSE && (
          <Analyse
            onOpenTransactionsFiltered={openTransactionsWithContext}
            navigationContext={analysisNavigationContext}
            onNavigationContextApplied={() => setAnalysisNavigationContext(null)}
          />
        )}

        {page === PAGES.CATEGORIES && <Categories />}

        {page === PAGES.REFERENTIELS && (
          <Referentiels accounts={accounts} addAccount={addAccount} updateAccount={updateAccount} deleteAccount={deleteAccount} />
        )}

        {page === PAGES.PARAMETRES && <Parametres />}

        {page === PAGES.IMPORT_HISTORY && <ImportHistory />}
        </Box>
      </Container>

      {!isMobilePortrait && (
        <Fab
          aria-label="Ajouter une transaction"
          onClick={() => openTransactionsWithContext(null)}
          sx={{
            position: "fixed",
            bottom: 80,
            right: 20,
            background: "linear-gradient(135deg, #eb5e28 0%, #f0903c 100%)",
            color: "#fff",
            boxShadow: "0 14px 24px rgba(235, 94, 40, 0.36)",
            "&:hover": {
              background: "linear-gradient(135deg, #d9531f 0%, #df8538 100%)",
            },
          }}
        >
          <Add />
        </Fab>
      )}

      {isMobilePortrait ? (
        <>
          <BottomNavigation
            value={mobileBottomNavValue}
            onChange={handleMobileNavigationChange}
            showLabels
            sx={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              width: "100%",
              display: "grid !important",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              minHeight: "calc(56px + env(safe-area-inset-bottom, 0px))",
              pb: "env(safe-area-inset-bottom, 0px)",
              zIndex: 1200,
              ...navSurfaceSx,
              "& .MuiBottomNavigationAction-root": {
                color: "#476b6e",
                minWidth: "0 !important",
                width: "100%",
                px: 0.25,
              },
              "& .Mui-selected": {
                color: "#0f5257",
                fontWeight: 700,
              },
            }}
          >
            <BottomNavigationAction value={PAGES.HOME} label="Résumé" icon={<Home />} aria-label="Ouvrir le résumé mensuel" />
            <BottomNavigationAction value={PAGES.TRANSACTIONS} label="Transactions" icon={<ReceiptLong />} aria-label="Ouvrir les transactions" />
            <BottomNavigationAction value={PAGES.BUDGETS} label="Budgets" icon={<PieChart />} aria-label="Ouvrir les budgets" />
            <BottomNavigationAction value="MORE" label="Plus" icon={<MoreHoriz />} aria-label="Ouvrir les autres sections" />
            <BottomNavigationAction value="ADD" label="Ajouter" icon={<Add />} aria-label="Ajouter une transaction" />
          </BottomNavigation>

          <Drawer
            anchor="bottom"
            open={moreDrawerOpen}
            onClose={() => setMoreDrawerOpen(false)}
            PaperProps={{
              sx: {
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                border: "1px solid rgba(20, 41, 43, 0.14)",
                background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(247,249,242,0.98) 100%)",
                maxHeight: "min(82dvh, 720px)",
              },
            }}
          >
            <Box sx={{ px: 1, pb: "calc(16px + env(safe-area-inset-bottom, 0px))", pt: 1 }} role="navigation" aria-label="Autres sections">
              <Typography variant="subtitle2" color="text.secondary" sx={{ px: 1, py: 1 }}>
                Autres sections
              </Typography>
              <List>
                {MORE_MENU_PAGES.map((item) => (
                  <ListItemButton
                    key={item.key}
                    selected={item.page === page && !["SCANNER", "BANK_IMPORT"].includes(item.key)}
                    onClick={() => {
                      if (item.key === "SCANNER") {
                        openTransactionsWithContext(null);
                        setReceiptImportRequestId((value) => value + 1);
                        setMoreDrawerOpen(false);
                        return;
                      }

                      if (item.key === "BANK_IMPORT") {
                        openTransactionsWithContext(null);
                        setBankImportRequestId((value) => value + 1);
                        setMoreDrawerOpen(false);
                        return;
                      }

                      navigateToPage(item.page);
                      setMoreDrawerOpen(false);
                    }}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                ))}
                <ListItemButton
                  onClick={() => {
                    setMoreDrawerOpen(false);
                    logout();
                  }}
                >
                  <ListItemIcon><Logout /></ListItemIcon>
                  <ListItemText primary="Se déconnecter" />
                </ListItemButton>
              </List>
            </Box>
          </Drawer>
        </>
      ) : (
        <BottomNavigation
          value={PAGE_ORDER.indexOf(page)}
          onChange={(event, value) => navigateToPage(PAGE_ORDER[value])}
          showLabels
          sx={{
            position: "fixed",
            bottom: 0,
            width: "100%",
            ...navSurfaceSx,
            "& .MuiBottomNavigationAction-root": {
              color: "#476b6e",
            },
            "& .Mui-selected": {
              color: "#0f5257",
              fontWeight: 700,
            },
          }}
        >
          <BottomNavigationAction label="Accueil" icon={<Home />} />
          <BottomNavigationAction label="Transactions" icon={<ReceiptLong />} />
          <BottomNavigationAction label="Objectifs" icon={<EmojiEvents />} />
          <BottomNavigationAction label="Frais fixes" icon={<PieChart />} />
          <BottomNavigationAction label="Revenus récurrents" icon={<ReceiptLong />} />
          <BottomNavigationAction label="Travail" icon={<Work />} />
          <BottomNavigationAction label="Opportunités" icon={<ShowChart />} />
          <BottomNavigationAction label="Dettes et créances" icon={<AccountBalance />} />
          <BottomNavigationAction label="Budgets" icon={<PieChart />} />
          <BottomNavigationAction label="Prévisions" icon={<ShowChart />} />
          <BottomNavigationAction label="Analyse" icon={<ShowChart />} />
          <BottomNavigationAction label="Catégories" icon={<Category />} />
          <BottomNavigationAction label="Référentiels" icon={<Category />} />
          <BottomNavigationAction label="Historique" icon={<ReceiptLong />} />
          <BottomNavigationAction label="Paramètres" icon={<Settings />} />
        </BottomNavigation>
      )}
    </Box>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate>
        <TransactionsProvider>
          <RecurringIncomeProvider>
            <AppContent />
          </RecurringIncomeProvider>
        </TransactionsProvider>
      </AuthGate>
    </AuthProvider>
  );
}
