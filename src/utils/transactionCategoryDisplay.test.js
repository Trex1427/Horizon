import test from "node:test";
import assert from "node:assert/strict";
import {
  getTransactionDisplayCategoryLabel,
  resolveTransactionCategoryMeta,
} from "./transactionCategoryDisplay.js";

const CATEGORIES = [
  { id: "cat-food", name: "Alimentation", isActive: true },
  { id: "cat-transport", name: "Transport", isActive: true },
];

test("transaction with valid categoryId uses catalog category name", () => {
  const transaction = {
    id: "tx-1",
    categoryId: "cat-food",
    categoryName: "Ancien nom",
  };

  const categoryMeta = resolveTransactionCategoryMeta(transaction, CATEGORIES);
  const label = getTransactionDisplayCategoryLabel(transaction, categoryMeta);

  assert.equal(categoryMeta?.name, "Alimentation");
  assert.equal(label, "Alimentation");
});

test("explicit uncategorized transaction keeps Sans catégorie", () => {
  const transaction = {
    id: "tx-2",
    categoryId: "",
    categoryName: "",
    categorie: "",
  };

  const categoryMeta = resolveTransactionCategoryMeta(transaction, CATEGORIES);
  const label = getTransactionDisplayCategoryLabel(transaction, categoryMeta);

  assert.equal(categoryMeta, null);
  assert.equal(label, "Sans catégorie");
});

test("legacy transaction with category name and no categoryId keeps readable category", () => {
  const transaction = {
    id: "tx-3",
    categoryId: "",
    categoryName: "Transport",
  };

  const categoryMeta = resolveTransactionCategoryMeta(transaction, CATEGORIES);
  const label = getTransactionDisplayCategoryLabel(transaction, categoryMeta);

  assert.equal(categoryMeta?.id, "cat-transport");
  assert.equal(label, "Transport");
});

test("transaction with invalid categoryId and no legacy label stays uncategorized", () => {
  const transaction = {
    id: "tx-4",
    categoryId: "cat-missing",
    categoryName: "",
    categorie: "",
    category: "",
  };

  const categoryMeta = resolveTransactionCategoryMeta(transaction, CATEGORIES);
  const label = getTransactionDisplayCategoryLabel(transaction, categoryMeta);

  assert.equal(categoryMeta, null);
  assert.equal(label, "Sans catégorie");
});

test("display helper does not mutate source transaction", () => {
  const transaction = {
    id: "tx-5",
    categoryId: "",
    categoryName: "Transport",
    nested: { untouched: true },
  };
  const before = structuredClone(transaction);

  const categoryMeta = resolveTransactionCategoryMeta(transaction, CATEGORIES);
  const label = getTransactionDisplayCategoryLabel(transaction, categoryMeta);

  assert.equal(label, "Transport");
  assert.deepEqual(transaction, before);
});
