export const PAGES = Object.freeze({
  HOME: "HOME",
  TRANSACTIONS: "TRANSACTIONS",
  OBJECTIFS: "OBJECTIFS",
  FRAIS_FIXES: "FRAIS_FIXES",
  REVENUS_RECURRENTS: "REVENUS_RECURRENTS",
  TRAVAIL: "TRAVAIL",
  VEHICLES: "VEHICLES",
  OPPORTUNITES: "OPPORTUNITES",
  DETTES_CREANCES: "DETTES_CREANCES",
  BUDGETS: "BUDGETS",
  PREVISIONS: "PREVISIONS",
  CATEGORIES: "CATEGORIES",
  REFERENTIELS: "REFERENTIELS",
  ANALYSE: "ANALYSE",
  PARAMETRES: "PARAMETRES",
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
  PAGES.CATEGORIES,
  PAGES.REFERENTIELS,
  PAGES.IMPORT_HISTORY,
  PAGES.PARAMETRES,
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

const PAGE_SLUGS = Object.freeze({
  [PAGES.HOME]: "resume",
  [PAGES.TRANSACTIONS]: "transactions",
  [PAGES.OBJECTIFS]: "objectifs",
  [PAGES.FRAIS_FIXES]: "frais-fixes",
  [PAGES.REVENUS_RECURRENTS]: "revenus-recurrents",
  [PAGES.TRAVAIL]: "travail",
  [PAGES.VEHICLES]: "vehicules",
  [PAGES.OPPORTUNITES]: "opportunites",
  [PAGES.DETTES_CREANCES]: "dettes-creances",
  [PAGES.BUDGETS]: "budgets",
  [PAGES.PREVISIONS]: "previsions",
  [PAGES.ANALYSE]: "analyse",
  [PAGES.CATEGORIES]: "categories",
  [PAGES.REFERENTIELS]: "referentiels",
  [PAGES.IMPORT_HISTORY]: "historique-imports",
  [PAGES.PARAMETRES]: "parametres",
});

const SLUG_PAGES = new Map(Object.entries(PAGE_SLUGS).map(([page, slug]) => [slug, page]));

export function getPageSlug(page) {
  return PAGE_SLUGS[page] || PAGE_SLUGS[PAGES.HOME];
}

export function getPageFromLocation(locationLike) {
  const search = String(locationLike?.search || "");
  const slug = new URLSearchParams(search).get("page") || "";
  return SLUG_PAGES.get(slug) || PAGES.HOME;
}

export function buildPageUrl(page, locationLike) {
  const pathname = String(locationLike?.pathname || "/");
  const hash = String(locationLike?.hash || "");
  const params = new URLSearchParams(String(locationLike?.search || ""));
  params.set("page", getPageSlug(page));
  return `${pathname}?${params.toString()}${hash}`;
}
