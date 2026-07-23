import test from "node:test";
import assert from "node:assert/strict";
import {
  getSafeCategoryLabel,
  getSafeIconLabel,
  isTechnicalCategoryDisplayValue,
} from "./displayTextUtils.js";

test("technical material icon names are treated as non-display category labels", () => {
  const iconNames = [
    "restaurant",
    "home",
    "directions_car",
    "medical_services",
    "sports_esports",
    "subscriptions",
    "receipt_long",
  ];

  iconNames.forEach((value) => {
    assert.equal(isTechnicalCategoryDisplayValue(value), true);
    assert.equal(getSafeCategoryLabel(value, "Categorie"), "Categorie");
  });
});

test("icon labels never expose material symbol names as visible text", () => {
  assert.equal(getSafeIconLabel("restaurant"), "Icône");
  assert.equal(getSafeIconLabel("home"), "Icône");
  assert.equal(getSafeIconLabel("🍽️"), "🍽️");
});
