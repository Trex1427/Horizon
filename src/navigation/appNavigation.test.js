import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPageUrl,
  getPageFromLocation,
  getPageSlug,
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

test("mobile direct routes keep summary, transactions and budgets", () => {
  assert.deepEqual(MOBILE_PRIMARY_PAGES, [PAGES.HOME, PAGES.TRANSACTIONS, PAGES.BUDGETS]);
  assert.equal(MOBILE_SECONDARY_PAGES.includes(PAGES.TRANSACTIONS), false);
});

test("all routes expose unique stable direct-link slugs", () => {
  const slugs = PAGE_ORDER.map(getPageSlug);
  assert.equal(new Set(slugs).size, PAGE_ORDER.length);
  PAGE_ORDER.forEach((page) => {
    assert.equal(getPageFromLocation({ search: `?page=${getPageSlug(page)}` }), page);
  });
});

test("secondary direct route survives refresh and invalid route falls back to summary", () => {
  assert.equal(getPageFromLocation({ search: "?page=revenus-recurrents" }), PAGES.REVENUS_RECURRENTS);
  assert.equal(getPageFromLocation({ search: "?page=inconnue" }), PAGES.HOME);
  assert.equal(getPageFromLocation({ search: "" }), PAGES.HOME);
});

test("page URL preserves pathname, other query parameters and hash", () => {
  assert.equal(
    buildPageUrl(PAGES.ANALYSE, { pathname: "/app", search: "?source=pwa", hash: "#detail" }),
    "/app?source=pwa&page=analyse#detail"
  );
});
