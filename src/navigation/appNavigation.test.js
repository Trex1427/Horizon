import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPageUrl,
  getPageFromLocation,
  getPageSlug,
  MOBILE_NAVIGATION_MEDIA_QUERY,
  MOBILE_PRIMARY_PAGES,
  MOBILE_SECONDARY_PAGES,
  PAGE_ORDER,
  PAGES,
} from "./appNavigation.js";

test("every functional desktop page has exactly one primary or secondary mobile path", () => {
  const mobilePages = [...MOBILE_PRIMARY_PAGES, ...MOBILE_SECONDARY_PAGES];
  assert.equal(new Set(PAGE_ORDER).size, PAGE_ORDER.length);
  assert.equal(new Set(mobilePages).size, mobilePages.length);
  assert.deepEqual(new Set(mobilePages), new Set(PAGE_ORDER));
});

test("mobile direct routes expose the four M1 destinations", () => {
  assert.deepEqual(MOBILE_PRIMARY_PAGES, [PAGES.HOME, PAGES.TRANSACTIONS, PAGES.TRAVAIL, PAGES.ANALYSE]);
  assert.equal(MOBILE_SECONDARY_PAGES.includes(PAGES.TRANSACTIONS), false);
  assert.equal(MOBILE_SECONDARY_PAGES.includes(PAGES.BUDGETS), true);
  assert.match(MOBILE_NAVIGATION_MEDIA_QUERY, /orientation: landscape/);
});

test("PAGE_ORDER includes every V2 route and keeps existing legacy routes", () => {
  for (const page of [
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
  ]) {
    assert.equal(PAGE_ORDER.includes(page), true);
  }
  for (const legacyPage of [
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
  ]) {
    assert.equal(PAGE_ORDER.includes(legacyPage), true);
  }
});

test("all routes expose unique stable direct-link slugs", () => {
  const slugs = PAGE_ORDER.map(getPageSlug);
  assert.equal(new Set(slugs).size, PAGE_ORDER.length);
  PAGE_ORDER.forEach((page) => {
    const expectedPage = page === PAGES.HOME ? PAGES.DASHBOARD_V2 : page;
    assert.equal(getPageFromLocation({ search: `?page=${getPageSlug(page)}` }), expectedPage);
  });
});

test("V2 direct links round-trip to their dedicated routes", () => {
  const v2Routes = [
    [PAGES.DASHBOARD_V2, "dashboard-v2"],
    [PAGES.ACCOUNTS_V2, "comptes-v2"],
    [PAGES.BUDGETS_V2, "budgets-v2"],
    [PAGES.FORECAST_V2, "forecast-v2"],
    [PAGES.ANALYSE_V2, "analyse-v2"],
    [PAGES.REPORTS_V2, "reports-v2"],
    [PAGES.OBJECTIVES_V2, "objectives-v2"],
    [PAGES.RECURRING_INCOME_V2, "recurring-income-v2"],
    [PAGES.FIXED_EXPENSES_V2, "fixed-expenses-v2"],
    [PAGES.DEBTS_CLAIMS_V2, "debts-claims-v2"],
    [PAGES.VEHICLES_V2, "vehicles-v2"],
    [PAGES.WORK_V2, "work-v2"],
    [PAGES.QUOTES_V2, "quotes-v2"],
    [PAGES.INVOICES_V2, "invoices-v2"],
    [PAGES.SETTINGS_V2, "settings-v2"],
  ];
  v2Routes.forEach(([page, slug]) => {
    assert.equal(getPageSlug(page), slug);
    assert.equal(getPageFromLocation({ search: `?page=${slug}` }), page);
  });
});

test("secondary direct route survives refresh and invalid or missing route falls back to V2", () => {
  assert.equal(getPageFromLocation({ search: "?page=revenus-recurrents" }), PAGES.REVENUS_RECURRENTS);
  assert.equal(getPageFromLocation({ search: "?page=accounts-v2" }), PAGES.ACCOUNTS_V2);
  assert.equal(getPageFromLocation({ search: "?page=home" }), PAGES.DASHBOARD_V2);
  assert.equal(getPageFromLocation({ search: "?page=resume" }), PAGES.DASHBOARD_V2);
  assert.equal(getPageFromLocation({ search: "?page=inconnue" }), PAGES.DASHBOARD_V2);
  assert.equal(getPageFromLocation({ search: "" }), PAGES.DASHBOARD_V2);
});

test("page URL preserves pathname, other query parameters and hash", () => {
  assert.equal(
    buildPageUrl(PAGES.ANALYSE, { pathname: "/app", search: "?source=pwa", hash: "#detail" }),
    "/app?source=pwa&page=analyse#detail"
  );
});
