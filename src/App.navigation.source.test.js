import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const appPath = resolve(process.cwd(), "src/App.jsx");

test("App wires URL state, history navigation and the V2 routes", async () => {
  const source = await readFile(appPath, "utf8");

  for (const snippet of [
    "const [page, setPage] = useState(() => {",
    "normalizeHomePage",
    "return nextPage === PAGES.HOME ? PAGES.DASHBOARD_V2 : nextPage",
    'window.history[replace ? "replaceState" : "pushState"]',
    "window.history.pushState({ page: PAGES.TRAVAIL }",
    "const initialPage = getPageFromLocation(window.location)",
    'window.addEventListener("popstate", handlePopState)',
    'return () => window.removeEventListener("popstate", handlePopState)',
    "home: PAGES.DASHBOARD_V2",
    "settings: PAGES.SETTINGS_V2",
    "more: PAGES.SETTINGS_V2",
  ]) {
    assert.equal(source.includes(snippet), true, snippet);
  }

  for (const route of [
    "PAGES.DASHBOARD_V2",
    "PAGES.ACCOUNTS_V2",
    "PAGES.BUDGETS_V2",
    "PAGES.FORECAST_V2",
    "PAGES.ANALYSE_V2",
    "PAGES.REPORTS_V2",
    "PAGES.OBJECTIVES_V2",
    "PAGES.RECURRING_INCOME_V2",
    "PAGES.FIXED_EXPENSES_V2",
    "PAGES.DEBTS_CLAIMS_V2",
    "PAGES.VEHICLES_V2",
    "PAGES.WORK_V2",
    "PAGES.QUOTES_V2",
    "PAGES.INVOICES_V2",
    "PAGES.SETTINGS_V2",
  ]) {
    assert.equal(source.includes(route), true, route);
  }
});