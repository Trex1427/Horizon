import { lazy, Suspense, useCallback, useEffect, useState } from "react";
const Transactions = lazy(() => import("./pages/Transactions"));
const TransactionsV2 = lazy(() => import("./components/transactions-v2/TransactionsV2.jsx"));
const AccountsV2 = lazy(() => import("./components/accounts-v2/AccountsV2.jsx"));
const BudgetsV2 = lazy(() => import("./components/budgets-v2/BudgetsV2.jsx"));
const ForecastV2 = lazy(() => import("./components/forecast-v2/ForecastV2.jsx"));
const AnalyseV2 = lazy(() => import("./components/analyse-v2/AnalyseV2.jsx"));
const ObjectivesV2 = lazy(() => import("./components/objectives-v2/ObjectivesV2.jsx"));
const RecurringIncomeV2 = lazy(() => import("./components/recurring-income-v2/RecurringIncomeV2.jsx"));
const FixedExpensesV2 = lazy(() => import("./components/fixed-expenses-v2/FixedExpensesV2.jsx"));
const DebtsClaimsV2 = lazy(() => import("./components/debts-claims-v2/DebtsClaimsV2.jsx"));
const ReportsV2 = lazy(() => import("./components/reports-v2/ReportsV2.jsx"));
const VehiclesV2 = lazy(() => import("./components/vehicles-v2/VehiclesV2.jsx"));
const WorkV2 = lazy(() => import("./components/work-v2/WorkV2.jsx"));
const QuotesV2 = lazy(() => import("./components/quotes-v2/QuotesV2.jsx"));
const InvoicesV2 = lazy(() => import("./components/invoices-v2/InvoicesV2.jsx"));
const SettingsV2 = lazy(() => import("./components/settings-v2/SettingsV2.jsx"));
const ImportHistoryV2 = lazy(() => import("./components/import-history-v2/ImportHistoryV2.jsx"));
const Objectifs = lazy(() => import("./pages/Objectifs"));
const FraisFixes = lazy(() => import("./pages/FraisFixes"));
const RevenusRecurrents = lazy(() => import("./pages/RevenusRecurrents"));
const Opportunites = lazy(() => import("./pages/Opportunites"));
const DettesCreances = lazy(() => import("./pages/DettesCreances"));
const Budgets = lazy(() => import("./pages/Budgets"));
const Analyse = lazy(() => import("./pages/Analyse"));
const Previsions = lazy(() => import("./pages/Previsions"));
const Categories = lazy(() => import("./pages/Categories"));
const Referentiels = lazy(() => import("./pages/Referentiels"));
const Parametres = lazy(() => import("./pages/Parametres"));
const ImportHistory = lazy(() => import("./pages/ImportHistory"));
const Travail = lazy(() => import("./pages/Travail"));
const Vehicles = lazy(() => import("./pages/Vehicles"));
const FinancialHome = lazy(() => import("./pages/FinancialHome"));
import { TransactionsProvider } from "./context/TransactionsContext";
import { RecurringIncomeProvider } from "./context/RecurringIncomeContext";
import { AuthGate } from "./auth/AuthGate";
import { AuthProvider } from "./auth/AuthProvider";
import { useAuth } from "./auth/useAuth";
import { useAccounts } from "./hooks/useAccounts";
import {
  buildPageUrl,
  getPageFromLocation,
  MOBILE_NAVIGATION_MEDIA_QUERY,
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
  CircularProgress,
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
import DirectionsCar from "@mui/icons-material/DirectionsCar";

function getCurrentUrlSnapshot() {
  if (typeof window === "undefined") {
    return { href: "", pathname: "", search: "", hash: "" };
  }
  return {
    href: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
  };
}

function traceNav(event, details = {}) {
  if (typeof window === "undefined") return;
  console.log("[NAV_TRACE]", new Date().toISOString(), `AppContent:${event}`, {
    ...getCurrentUrlSnapshot(),
    ...details,
  });
}

const MORE_MENU_PAGES = [
  {
    key: PAGES.CATEGORIES,
    label: "Catégories",
    icon: <Category />,
    page: PAGES.CATEGORIES,
  },
  {
    key: PAGES.REFERENTIELS,
    label: "Comptes, activités et tiers",
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
    key: PAGES.VEHICLES,
    label: "Véhicules",
    icon: <DirectionsCar />,
    page: PAGES.VEHICLES,
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

function normalizeHomePage(nextPage) {
  return nextPage === PAGES.HOME ? PAGES.DASHBOARD_V2 : nextPage;
}

function AppContent() {
  const { logout, showLocalDiagnostic, uid, user } = useAuth();
  const [page, setPage] = useState(() => {
    if (typeof window === "undefined") return getPageFromLocation(null);
    traceNav("init:before-getPageFromLocation");
    const initialPage = getPageFromLocation(window.location);
    const normalized = normalizeHomePage(initialPage);
    traceNav("init:resolved-page", { initialPage, normalizedPage: normalized });
    return normalized;
  });
  const [moreDrawerOpen, setMoreDrawerOpen] = useState(false);
  const [mobilePlusDiagnostics, setMobilePlusDiagnostics] = useState({
    plusClick: false,
    openRequested: false,
    stateDrawer: false,
    drawerRender: false,
    drawerMounted: false,
    onCloseCalled: false,
    closeReason: "",
  });
  const [receiptImportRequestId, setReceiptImportRequestId] = useState(0);
  const [bankImportRequestId, setBankImportRequestId] = useState(0);
  const [transactionsNavigationContext, setTransactionsNavigationContext] = useState(null);
  const [analysisNavigationContext, setAnalysisNavigationContext] = useState(null);
  const { accounts, defaultAccount, loading: accountsLoading, error: accountsError, addAccount, updateAccount, deleteAccount } = useAccounts();
  const isMobile = useMediaQuery(MOBILE_NAVIGATION_MEDIA_QUERY);

  useEffect(() => {
    console.log("[DRAWER] state =", moreDrawerOpen);
    setMobilePlusDiagnostics((previous) => ({
      ...previous,
      stateDrawer: moreDrawerOpen,
    }));
  }, [moreDrawerOpen]);

  useEffect(() => {
    setMobilePlusDiagnostics((previous) => ({
      ...previous,
      drawerRender: Boolean(isMobile),
    }));
  }, [isMobile]);

  const navigateToPage = useCallback((nextPage, { replace = false } = {}) => {
    const normalizedPage = normalizeHomePage(nextPage);
    traceNav("navigateToPage:called", {
      nextPage,
      replace,
      normalizedPage,
    });
    if (!PAGE_ORDER.includes(normalizedPage)) return;
    setPage(normalizedPage);
    if (typeof window === "undefined") return;
    const nextUrl = buildPageUrl(normalizedPage, window.location);
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    traceNav("navigateToPage:resolved-url", { currentUrl, nextUrl, normalizedPage, replace });
    if (nextUrl === currentUrl) return;
    traceNav("history:write-request", {
      api: replace ? "replaceState" : "pushState",
      state: { page: normalizedPage },
      title: "",
      nextUrl,
    });
    window.history[replace ? "replaceState" : "pushState"]({ page: normalizedPage }, "", nextUrl);
  }, []);
  const navigateToWork = useCallback((section = "dashboard", status = "all") => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("page", "travail");
    params.set("section", section);
    if (status && status !== "all") params.set("status", status); else params.delete("status");
    const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    traceNav("navigateToWork:called", { section, status, nextUrl });
    traceNav("history:write-request", {
      api: "pushState",
      state: { page: PAGES.TRAVAIL },
      title: "",
      nextUrl,
    });
    window.history.pushState({ page: PAGES.TRAVAIL }, "", nextUrl);
    setPage(PAGES.TRAVAIL);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const originalPushState = window.history.pushState.bind(window.history);
    const originalReplaceState = window.history.replaceState.bind(window.history);

    window.history.pushState = (state, title, url) => {
      traceNav("history.pushState:called", {
        state,
        title,
        url: String(url ?? ""),
      });
      const result = originalPushState(state, title, url);
      traceNav("history.pushState:after", {
        state,
        title,
        url: String(url ?? ""),
      });
      return result;
    };

    window.history.replaceState = (state, title, url) => {
      traceNav("history.replaceState:called", {
        state,
        title,
        url: String(url ?? ""),
      });
      const result = originalReplaceState(state, title, url);
      traceNav("history.replaceState:after", {
        state,
        title,
        url: String(url ?? ""),
      });
      return result;
    };

    traceNav("history:patch-installed");

    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      traceNav("history:patch-removed");
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    traceNav("effect:sync-with-location:start");
    const initialPage = getPageFromLocation(window.location);
    const normalizedInitialPage = normalizeHomePage(initialPage);
    const canonicalUrl = buildPageUrl(normalizedInitialPage, window.location);
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    traceNav("effect:sync-with-location:computed", {
      initialPage,
      normalizedInitialPage,
      canonicalUrl,
      currentUrl,
    });
    if (canonicalUrl !== currentUrl) {
      traceNav("history:write-request", {
        api: "replaceState",
        state: { page: normalizedInitialPage },
        title: "",
        nextUrl: canonicalUrl,
      });
      window.history.replaceState({ page: normalizedInitialPage }, "", canonicalUrl);
    }
    const handlePopState = () => {
      const nextPage = getPageFromLocation(window.location);
      traceNav("popstate", { nextPage });
      setPage(normalizeHomePage(nextPage));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  useEffect(() => {
    traceNav("state", { page, isMobile });
  }, [isMobile, page]);

  if (typeof window !== "undefined") {
    console.log("[DIAG][App]", {
      page,
      isMobile,
      pathname: window.location.pathname,
      search: window.location.search,
    });
  }

  const logAppRender = (componentReturned, props = {}) => {
    console.log("[APP_RENDER]", {
      page,
      componentReturned,
      props,
    });
  };

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
      console.log("[PLUS] ouverture demandée");
      setMobilePlusDiagnostics((previous) => ({
        ...previous,
        openRequested: true,
      }));
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

  const openDashboardV2Destination = useCallback((destination) => {
    const destinations = {
      home: PAGES.DASHBOARD_V2,
      transactions: PAGES.TRANSACTIONS,
      accounts: PAGES.ACCOUNTS_V2,
      budgets: PAGES.BUDGETS,
      "recurring-income": PAGES.RECURRING_INCOME_V2,
      "fixed-expenses": PAGES.FRAIS_FIXES,
      debts: PAGES.DEBTS_CLAIMS_V2,
      forecast: PAGES.FORECAST_V2,
      goals: PAGES.OBJECTIVES_V2,
      analysis: PAGES.ANALYSE_V2,
      reports: PAGES.REPORTS_V2,
      vehicles: PAGES.VEHICLES_V2,
      work: PAGES.WORK_V2,
      quotes: PAGES.QUOTES_V2,
      invoices: PAGES.INVOICES_V2,
      "import-history": PAGES.IMPORT_HISTORY,
      settings: PAGES.SETTINGS_V2,
      more: PAGES.SETTINGS_V2,
    };
    navigateToPage(destinations[destination] || PAGES.DASHBOARD_V2);
  }, [navigateToPage]);

  if (page === PAGES.DASHBOARD_V2) {
    console.log("[RENDER] App route PAGES.DASHBOARD_V2");
    console.log("[DIAG][App] branch => PAGES.DASHBOARD_V2 -> FinancialHome(variant=v2)");
    logAppRender("FinancialHome", { variant: "v2", source: "PAGES.DASHBOARD_V2" });
    return (
      <Suspense fallback={
        <Box role="status" aria-live="polite" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
          <CircularProgress size={32} />
        </Box>
      }>
        <FinancialHome
          variant="v2"
          accounts={accounts}
          accountsLoading={accountsLoading}
          accountsError={accountsError}
          onOpenTransactions={() => openTransactionsWithContext(null)}
          onNavigateV2={openDashboardV2Destination}
        />
      </Suspense>
    );
  }

  if (page === PAGES.TRANSACTIONS) {
    logAppRender("TransactionsV2", { source: "PAGES.TRANSACTIONS" });
    return (
      <Suspense fallback={<Box role="status" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}><CircularProgress size={32} /></Box>}>
        <TransactionsV2
          openReceiptImportRequestId={receiptImportRequestId}
          openBankImportRequestId={bankImportRequestId}
          navigationContext={transactionsNavigationContext}
          onNavigationContextApplied={() => setTransactionsNavigationContext(null)}
          onNavigate={openDashboardV2Destination}
        />
      </Suspense>
    );
  }
  if (page === PAGES.ACCOUNTS_V2) {
    logAppRender("AccountsV2", { source: "PAGES.ACCOUNTS_V2" });
    return <Suspense fallback={<Box role="status" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}><CircularProgress size={32} /></Box>}><AccountsV2 accounts={accounts} defaultAccount={defaultAccount} addAccount={addAccount} updateAccount={updateAccount} deleteAccount={deleteAccount} onNavigate={openDashboardV2Destination} /></Suspense>;
  }
  if (page === PAGES.BUDGETS_V2) {
    logAppRender("BudgetsV2", { source: "PAGES.BUDGETS_V2" });
    return <Suspense fallback={<Box role="status" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}><CircularProgress size={32} /></Box>}><BudgetsV2 onNavigate={openDashboardV2Destination} /></Suspense>;
  }
  if (page === PAGES.FORECAST_V2) {
    logAppRender("ForecastV2", { source: "PAGES.FORECAST_V2" });
    return <Suspense fallback={<Box role="status" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}><CircularProgress size={32} /></Box>}><ForecastV2 onNavigate={openDashboardV2Destination} /></Suspense>;
  }
  if (page === PAGES.ANALYSE_V2) {
    logAppRender("AnalyseV2", { source: "PAGES.ANALYSE_V2" });
    return <Suspense fallback={<Box role="status" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}><CircularProgress size={32} /></Box>}><AnalyseV2 onNavigate={openDashboardV2Destination} /></Suspense>;
  }
  if (page === PAGES.REPORTS_V2) {
    logAppRender("ReportsV2", { source: "PAGES.REPORTS_V2" });
    return <Suspense fallback={<Box role="status" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}><CircularProgress size={32} /></Box>}><ReportsV2 onNavigate={openDashboardV2Destination} /></Suspense>;
  }
  if (page === PAGES.OBJECTIVES_V2) {
    logAppRender("ObjectivesV2", { source: "PAGES.OBJECTIVES_V2" });
    return <Suspense fallback={<Box role="status" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}><CircularProgress size={32} /></Box>}><ObjectivesV2 onNavigate={openDashboardV2Destination} /></Suspense>;
  }
  if (page === PAGES.RECURRING_INCOME_V2) {
    logAppRender("RecurringIncomeV2", { source: "PAGES.RECURRING_INCOME_V2" });
    return <Suspense fallback={<Box role="status" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}><CircularProgress size={32} /></Box>}><RecurringIncomeV2 onNavigate={openDashboardV2Destination} /></Suspense>;
  }
  if (page === PAGES.FIXED_EXPENSES_V2) {
    logAppRender("FixedExpensesV2", { source: "PAGES.FIXED_EXPENSES_V2" });
    return <Suspense fallback={<Box role="status" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}><CircularProgress size={32} /></Box>}><FixedExpensesV2 onNavigate={openDashboardV2Destination} /></Suspense>;
  }
  if (page === PAGES.DEBTS_CLAIMS_V2) {
    logAppRender("DebtsClaimsV2", { source: "PAGES.DEBTS_CLAIMS_V2" });
    return <Suspense fallback={<Box role="status" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}><CircularProgress size={32} /></Box>}><DebtsClaimsV2 accounts={accounts} defaultAccount={defaultAccount} onNavigate={openDashboardV2Destination} /></Suspense>;
  }
  if (page === PAGES.VEHICLES_V2) {
    logAppRender("VehiclesV2", { source: "PAGES.VEHICLES_V2" });
    return <Suspense fallback={<Box role="status" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}><CircularProgress size={32} /></Box>}><VehiclesV2 onNavigate={openDashboardV2Destination} /></Suspense>;
  }
  if (page === PAGES.WORK_V2) {
    logAppRender("WorkV2", { source: "PAGES.WORK_V2" });
    return <Suspense fallback={<Box role="status" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}><CircularProgress size={32} /></Box>}><WorkV2 onNavigate={openDashboardV2Destination} /></Suspense>;
  }
  if (page === PAGES.QUOTES_V2) {
    logAppRender("QuotesV2", { source: "PAGES.QUOTES_V2" });
    return <Suspense fallback={<Box role="status" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}><CircularProgress size={32} /></Box>}><QuotesV2 onNavigate={openDashboardV2Destination} /></Suspense>;
  }
  if (page === PAGES.INVOICES_V2) {
    logAppRender("InvoicesV2", { source: "PAGES.INVOICES_V2" });
    return <Suspense fallback={<Box role="status" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}><CircularProgress size={32} /></Box>}><InvoicesV2 onNavigate={openDashboardV2Destination} /></Suspense>;
  }
  if (page === PAGES.SETTINGS_V2) {
    logAppRender("SettingsV2", { source: "PAGES.SETTINGS_V2" });
    return <Suspense fallback={<Box role="status" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}><CircularProgress size={32} /></Box>}><SettingsV2 onNavigate={openDashboardV2Destination} onLogout={logout} /></Suspense>;
  }
  if (page === PAGES.IMPORT_HISTORY) {
    logAppRender("ImportHistoryV2", { source: "PAGES.IMPORT_HISTORY" });
    return <Suspense fallback={<Box role="status" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}><CircularProgress size={32} /></Box>}><ImportHistoryV2 onNavigate={openDashboardV2Destination} /></Suspense>;
  }
  logAppRender("LegacyShell", { source: "fallback-layout" });
  return (
    <Box sx={{ minHeight: "100dvh", overflowX: "hidden", pb: isMobile ? "calc(72px + env(safe-area-inset-bottom, 0px))" : 10 }}>
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

          {!isMobile && (
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
        <Suspense fallback={
          <Box role="status" aria-live="polite" sx={{ minHeight: 240, display: "grid", placeItems: "center" }}>
            <Box sx={{ textAlign: "center" }}>
              <CircularProgress size={32} />
              <Typography sx={{ mt: 1 }} color="text.secondary">Chargement de la page...</Typography>
            </Box>
          </Box>
        }>
        {page === PAGES.HOME && (
          (() => {
            console.log("[RENDER] App route PAGES.HOME");
            logAppRender("FinancialHome", { variant: "v2", source: "PAGES.HOME" });
            return (
              <FinancialHome
                variant="v2"
                accounts={accounts}
                accountsLoading={accountsLoading}
                accountsError={accountsError}
                onOpenTransactions={() => openTransactionsWithContext(null)}
                onNavigateV2={openDashboardV2Destination}
                onOpenAnalysisMonth={openAnalysisMonth}
                onOpenForecast={() => navigateToPage(PAGES.PREVISIONS)}
                onOpenAnalysis={() => navigateToPage(PAGES.ANALYSE)}
                onOpenAccounts={() => navigateToPage(PAGES.REFERENTIELS)}
                onOpenQuotes={() => navigateToWork("quotes", "pending")}
                onOpenInvoices={() => navigateToWork("invoices")}
              />
            );
          })()
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

        {page === PAGES.FRAIS_FIXES && <FraisFixes onOpenTransactionsFiltered={openTransactionsWithContext} />}

        {page === PAGES.REVENUS_RECURRENTS && <RevenusRecurrents />}

        {page === PAGES.TRAVAIL && <Travail onOpenTransaction={(transactionId) => openTransactionsWithContext({ source: "analysis", transactionIds: [transactionId] })} />}

        {page === PAGES.VEHICLES && <Vehicles />}

        {page === PAGES.OPPORTUNITES && <Opportunites />}

        {page === PAGES.DETTES_CREANCES && (
          <DettesCreances
            accounts={accounts}
            defaultAccount={defaultAccount}
            accountsLoading={accountsLoading}
            accountsError={accountsError}
          />
        )}

        {page === PAGES.BUDGETS && <Budgets accounts={accounts} onOpenTransactionsFiltered={openTransactionsWithContext} />}

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
          <Referentiels accounts={accounts} addAccount={addAccount} updateAccount={updateAccount} deleteAccount={deleteAccount} onOpenTransactionsFiltered={openTransactionsWithContext} />
        )}

        {page === PAGES.PARAMETRES && <Parametres onOpenDashboardV2={() => navigateToPage(PAGES.DASHBOARD_V2)} />}

        {page === PAGES.IMPORT_HISTORY && <ImportHistory />}

        </Suspense>
        </Box>
      </Container>

      {!isMobile && (
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

      {isMobile ? (
        <>
          {console.log("[DRAWER] render", { open: moreDrawerOpen })}
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
                minHeight: 56,
              },
              "& .Mui-selected": {
                color: "#0f5257",
                fontWeight: 700,
                borderTop: "3px solid currentColor",
              },
            }}
          >
            <BottomNavigationAction value={PAGES.HOME} label="Accueil" icon={<Home />} aria-label="Ouvrir l’accueil" />
            <BottomNavigationAction value={PAGES.TRANSACTIONS} label="Transactions" icon={<ReceiptLong />} aria-label="Ouvrir les transactions" />
            <BottomNavigationAction value={PAGES.TRAVAIL} label="Travail" icon={<Work />} aria-label="Ouvrir Travail" />
            <BottomNavigationAction value={PAGES.ANALYSE} label="Analyse" icon={<ShowChart />} aria-label="Ouvrir l’analyse" />
            <BottomNavigationAction
              value="MORE"
              label="Plus"
              icon={<MoreHoriz />}
              aria-label="Ouvrir les autres pages"
              onClick={() => {
                console.log("[PLUS] click");
                console.log("[PLUS] ouverture demandée");
                setMobilePlusDiagnostics((previous) => ({
                  ...previous,
                  plusClick: true,
                  openRequested: true,
                }));
                setMoreDrawerOpen(true);
              }}
            />
          </BottomNavigation>

          <Drawer
            anchor="bottom"
            open={moreDrawerOpen}
            onClose={(event, reason) => {
              console.log("[DRAWER] onClose", { reason });
              setMobilePlusDiagnostics((previous) => ({
                ...previous,
                onCloseCalled: true,
                closeReason: String(reason || ""),
              }));
              if (reason === "backdropClick") {
                console.log("[DRAWER] backdropClick");
              }
              if (reason === "escapeKeyDown") {
                console.log("[DRAWER] escapeKeyDown");
              }
              setMoreDrawerOpen(false);
            }}
            PaperProps={{
              ref: (node) => {
                if (node) {
                  console.log("[DRAWER] mounted");
                  setMobilePlusDiagnostics((previous) => ({
                    ...previous,
                    drawerMounted: true,
                  }));
                } else {
                  setMobilePlusDiagnostics((previous) => ({
                    ...previous,
                    drawerMounted: false,
                  }));
                }
              },
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

          <Box
            sx={{
              position: "fixed",
              left: 8,
              right: 8,
              bottom: "calc(72px + env(safe-area-inset-bottom, 0px))",
              zIndex: 2500,
              bgcolor: "rgba(16, 24, 28, 0.94)",
              color: "#f5f7ef",
              border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 1.5,
              px: 1,
              py: 0.75,
              boxShadow: "0 12px 28px rgba(0,0,0,0.35)",
              fontFamily: "Consolas, monospace",
            }}
          >
            <Typography variant="caption" sx={{ display: "block", fontWeight: 800, mb: 0.25, color: "#d9f99d" }}>
              DIAG PLUS / DRAWER
            </Typography>
            <Typography variant="caption" sx={{ display: "block" }}>PLUS CLICK ............... {mobilePlusDiagnostics.plusClick ? "oui" : "non"}</Typography>
            <Typography variant="caption" sx={{ display: "block" }}>OUVERTURE DEMANDEE ....... {mobilePlusDiagnostics.openRequested ? "oui" : "non"}</Typography>
            <Typography variant="caption" sx={{ display: "block" }}>STATE DRAWER ............. {String(mobilePlusDiagnostics.stateDrawer)}</Typography>
            <Typography variant="caption" sx={{ display: "block" }}>DRAWER RENDER ............ {String(mobilePlusDiagnostics.drawerRender)}</Typography>
            <Typography variant="caption" sx={{ display: "block" }}>DRAWER MOUNTED ........... {String(mobilePlusDiagnostics.drawerMounted)}</Typography>
            <Typography variant="caption" sx={{ display: "block" }}>ONCLOSE APPELE ........... {mobilePlusDiagnostics.onCloseCalled ? "oui" : "non"}</Typography>
            <Typography variant="caption" sx={{ display: "block" }}>RAISON FERMETURE ......... {mobilePlusDiagnostics.closeReason || ""}</Typography>
            <Typography variant="caption" sx={{ display: "block" }}>mobileBottomNavValue ..... {String(mobileBottomNavValue)}</Typography>
            <Typography variant="caption" sx={{ display: "block" }}>moreDrawerOpen ........... {String(moreDrawerOpen)}</Typography>
          </Box>
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
          <BottomNavigationAction label="Véhicules" icon={<DirectionsCar />} />
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
