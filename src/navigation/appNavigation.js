export const PAGES = Object.freeze({
  HOME: "HOME",
  DASHBOARD_V2: "DASHBOARD_V2",
  ACCOUNTS_V2: "ACCOUNTS_V2",
  BUDGETS_V2: "BUDGETS_V2",
  TRANSACTIONS: "TRANSACTIONS",
  OBJECTIFS: "OBJECTIFS",
  OBJECTIVES_V2: "OBJECTIVES_V2",
  FRAIS_FIXES: "FRAIS_FIXES",
  FIXED_EXPENSES_V2: "FIXED_EXPENSES_V2",
  REVENUS_RECURRENTS: "REVENUS_RECURRENTS",
  RECURRING_INCOME_V2: "RECURRING_INCOME_V2",
  TRAVAIL: "TRAVAIL",
  WORK_V2: "WORK_V2",
  VEHICLES: "VEHICLES",
  VEHICLES_V2: "VEHICLES_V2",
  OPPORTUNITES: "OPPORTUNITES",
  DETTES_CREANCES: "DETTES_CREANCES",
  DEBTS_CLAIMS_V2: "DEBTS_CLAIMS_V2",
  BUDGETS: "BUDGETS",
  PREVISIONS: "PREVISIONS",
  FORECAST_V2: "FORECAST_V2",
  CATEGORIES: "CATEGORIES",
  REFERENTIELS: "REFERENTIELS",
  ANALYSE: "ANALYSE",
  ANALYSE_V2: "ANALYSE_V2",
  REPORTS: "REPORTS",
  REPORTS_V2: "REPORTS_V2",
  QUOTES: "QUOTES",
  QUOTES_V2: "QUOTES_V2",
  INVOICES: "INVOICES",
  INVOICES_V2: "INVOICES_V2",
  PARAMETRES: "PARAMETRES",
  SETTINGS_V2: "SETTINGS_V2",
  IMPORT_HISTORY: "IMPORT_HISTORY",
});

export const PAGE_ORDER = Object.freeze([
  PAGES.HOME,
  PAGES.TRANSACTIONS,
  PAGES.OBJECTIFS,
  PAGES.FRAIS_FIXES,
  PAGES.REVENUS_RECURRENTS,
  PAGES.TRAVAIL,
  PAGES.VEHICLES,
  PAGES.DETTES_CREANCES,
  PAGES.BUDGETS,
  PAGES.PREVISIONS,
  PAGES.ANALYSE,
  PAGES.REPORTS,
  PAGES.QUOTES,
  PAGES.INVOICES,
  PAGES.CATEGORIES,
  PAGES.REFERENTIELS,
  PAGES.IMPORT_HISTORY,
  PAGES.PARAMETRES,
  PAGES.DASHBOARD_V2,
  PAGES.ACCOUNTS_V2,
  PAGES.BUDGETS_V2,
  PAGES.FORECAST_V2,
  PAGES.ANALYSE_V2,
  PAGES.REPORTS_V2,
  PAGES.OBJECTIVES_V2,
  PAGES.RECURRING_INCOME_V2,
  PAGES.FIXED_EXPENSES_V2,
  PAGES.DEBTS_CLAIMS_V2,
  PAGES.VEHICLES_V2,
  PAGES.WORK_V2,
  PAGES.QUOTES_V2,
  PAGES.INVOICES_V2,
  PAGES.SETTINGS_V2,
]);

export const MOBILE_PRIMARY_PAGES = Object.freeze([
  PAGES.HOME,
  PAGES.TRANSACTIONS,
  PAGES.TRAVAIL,
  PAGES.ANALYSE,
]);
export const MOBILE_SECONDARY_PAGES = Object.freeze(PAGE_ORDER.filter((page) => !MOBILE_PRIMARY_PAGES.includes(page)));

export const RESPONSIVE_BREAKPOINTS = Object.freeze({
  mobileMax: 599.95,
  tabletMin: 600,
  desktopMin: 900,
});

export const MOBILE_NAVIGATION_MEDIA_QUERY = `(max-width:${RESPONSIVE_BREAKPOINTS.mobileMax}px), (max-width:${RESPONSIVE_BREAKPOINTS.desktopMin - 0.05}px) and (max-height:600px) and (orientation: landscape)`;

function traceNav(event, details = {}) {
  if (typeof window === "undefined") return;
  console.log("[NAV_TRACE]", new Date().toISOString(), `navigation:${event}`, {
    href: window.location.href,
    pathname: window.location.pathname,
    search: window.location.search,
    hash: window.location.hash,
    ...details,
  });
}

const PAGE_SLUGS = Object.freeze({
  [PAGES.HOME]: "resume",
  [PAGES.DASHBOARD_V2]: "dashboard-v2",
  [PAGES.ACCOUNTS_V2]: "comptes-v2",
  [PAGES.BUDGETS_V2]: "budgets-v2",
  [PAGES.TRANSACTIONS]: "transactions",
  [PAGES.OBJECTIFS]: "objectifs",
  [PAGES.OBJECTIVES_V2]: "objectives-v2",
  [PAGES.FRAIS_FIXES]: "frais-fixes",
  [PAGES.FIXED_EXPENSES_V2]: "fixed-expenses-v2",
  [PAGES.REVENUS_RECURRENTS]: "revenus-recurrents",
  [PAGES.RECURRING_INCOME_V2]: "recurring-income-v2",
  [PAGES.TRAVAIL]: "travail",
  [PAGES.WORK_V2]: "work-v2",
  [PAGES.VEHICLES]: "vehicules",
  [PAGES.VEHICLES_V2]: "vehicles-v2",
  [PAGES.OPPORTUNITES]: "opportunites",
  [PAGES.DETTES_CREANCES]: "dettes-creances",
  [PAGES.DEBTS_CLAIMS_V2]: "debts-claims-v2",
  [PAGES.BUDGETS]: "budgets",
  [PAGES.PREVISIONS]: "previsions",
  [PAGES.FORECAST_V2]: "forecast-v2",
  [PAGES.ANALYSE]: "analyse",
  [PAGES.ANALYSE_V2]: "analyse-v2",
  [PAGES.REPORTS]: "rapports",
  [PAGES.REPORTS_V2]: "reports-v2",
  [PAGES.QUOTES]: "devis",
  [PAGES.QUOTES_V2]: "quotes-v2",
  [PAGES.INVOICES]: "factures",
  [PAGES.INVOICES_V2]: "invoices-v2",
  [PAGES.CATEGORIES]: "categories",
  [PAGES.REFERENTIELS]: "referentiels",
  [PAGES.IMPORT_HISTORY]: "historique-imports",
  [PAGES.PARAMETRES]: "parametres",
  [PAGES.SETTINGS_V2]: "settings-v2",
});

const SLUG_PAGES = new Map(Object.entries(PAGE_SLUGS).map(([page, slug]) => [slug, page]));

const SLUG_ALIASES = new Map([
  ["home", PAGES.DASHBOARD_V2],
  ["resume", PAGES.DASHBOARD_V2],
  ["accounts-v2", PAGES.ACCOUNTS_V2],
  ["objectives-v2", PAGES.OBJECTIVES_V2],
  ["fixed-expenses-v2", PAGES.FIXED_EXPENSES_V2],
  ["vehicles-v2", PAGES.VEHICLES_V2],
  ["reports-v2", PAGES.REPORTS_V2],
]);

export function getPageSlug(page) {
  return PAGE_SLUGS[page] || PAGE_SLUGS[PAGES.HOME];
}

export function getPageFromLocation(locationLike) {
  const search = String(locationLike?.search || "");
  const slug = new URLSearchParams(search).get("page") || "";
  const resolved = SLUG_PAGES.get(slug) || SLUG_ALIASES.get(slug) || PAGES.DASHBOARD_V2;
  const normalizedResolved = resolved === PAGES.HOME ? PAGES.DASHBOARD_V2 : resolved;
  traceNav("getPageFromLocation", { inputSearch: search, slug, resolvedPage: resolved });
  return normalizedResolved;
}

export function buildPageUrl(page, locationLike) {
  const pathname = String(locationLike?.pathname || "/");
  const hash = String(locationLike?.hash || "");
  const params = new URLSearchParams(String(locationLike?.search || ""));
  params.set("page", getPageSlug(page));
  const nextUrl = `${pathname}?${params.toString()}${hash}`;
  traceNav("buildPageUrl", {
    page,
    pageSlug: getPageSlug(page),
    inputPathname: pathname,
    inputSearch: String(locationLike?.search || ""),
    inputHash: hash,
    nextUrl,
  });
  return nextUrl;
}
