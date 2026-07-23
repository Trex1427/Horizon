import test from "node:test";
import assert from "node:assert/strict";
import { selectAccountsForBalanceDisplay } from "./accountBalanceDisplay.js";

const current = { id: "acc-current", name: "Compte courant", type: "standard", isActive: true, balance: 1200 };
const savings = { id: "acc-savings", name: "Livret A", type: "savings", isActive: true, balance: 500 };
const business = { id: "acc-business", name: "Compte professionnel", type: "business", isActive: true, balance: 2500 };
const cash = { id: "acc-cash", name: "Espèces", type: "cash", isActive: true, balance: 80 };
const paypal = { id: "acc-paypal", name: "PayPal", type: "digital", isActive: true, balance: 0 };

function ids(accounts) {
  return accounts.map((account) => account.id);
}

test("keeps five unique active accounts for balance display", () => {
  const selected = selectAccountsForBalanceDisplay([current, savings, business, cash, paypal]);

  assert.deepEqual(ids(selected), ["acc-current", "acc-savings", "acc-business", "acc-cash", "acc-paypal"]);
});

test("keeps accounts with zero and positive balances", () => {
  const selected = selectAccountsForBalanceDisplay([paypal, current]);

  assert.deepEqual(ids(selected), ["acc-paypal", "acc-current"]);
  assert.equal(selected.find((account) => account.id === "acc-paypal").balance, 0);
  assert.equal(selected.find((account) => account.id === "acc-current").balance, 1200);
});

test("keeps the canonical cash account with its adjusted balance and removes the default seed duplicate", () => {
  const selected = selectAccountsForBalanceDisplay([
    cash,
    { id: "default-cash", name: "Espèces", type: "cash", isActive: true, balance: 0 },
  ]);

  assert.deepEqual(ids(selected), ["acc-cash"]);
  assert.equal(selected[0].balance, 80);
});

test("keeps transfer-derived balances untouched while selecting display accounts", () => {
  const selected = selectAccountsForBalanceDisplay([
    { ...current, balance: 1150 },
    { ...savings, balance: 550 },
    { id: "default-current-account", name: "Compte courant", type: "standard", isActive: true, balance: 0 },
  ]);

  assert.deepEqual(ids(selected), ["acc-current", "acc-savings"]);
  assert.equal(selected.find((account) => account.id === "acc-current").balance, 1150);
  assert.equal(selected.find((account) => account.id === "acc-savings").balance, 550);
});

test("excludes inactive accounts", () => {
  const selected = selectAccountsForBalanceDisplay([
    current,
    { id: "closed", name: "Clos", type: "standard", isActive: false, balance: 999 },
  ]);

  assert.deepEqual(ids(selected), ["acc-current"]);
});

test("handles a list received twice by keeping one entry per account id", () => {
  const selected = selectAccountsForBalanceDisplay([current, savings, current, savings]);

  assert.deepEqual(ids(selected), ["acc-current", "acc-savings"]);
});

test("keeps the first account when identical ids are present", () => {
  const selected = selectAccountsForBalanceDisplay([
    { id: "same-id", name: "Compte courant", type: "standard", isActive: true, balance: 100 },
    { id: "same-id", name: "Compte courant", type: "standard", isActive: true, balance: 0 },
  ]);

  assert.equal(selected.length, 1);
  assert.equal(selected[0].balance, 100);
});

test("does not deduplicate by name when ids are different and neither account is a default seed", () => {
  const selected = selectAccountsForBalanceDisplay([
    { id: "cash-main", name: "Espèces", type: "cash", isActive: true, balance: 80 },
    { id: "cash-wallet", name: "Espèces", type: "cash", isActive: true, balance: 15 },
  ]);

  assert.deepEqual(ids(selected), ["cash-main", "cash-wallet"]);
});

test("keeps default seed accounts when no canonical equivalent exists", () => {
  const selected = selectAccountsForBalanceDisplay([
    { id: "default-savings-a", name: "Livret A", type: "savings", isActive: true, balance: 0 },
  ]);

  assert.deepEqual(ids(selected), ["default-savings-a"]);
});

test("removes recreated default seed accounts when canonical equivalents exist", () => {
  const selected = selectAccountsForBalanceDisplay([
    current,
    savings,
    business,
    cash,
    paypal,
    { id: "default-current-account", name: "Compte courant", type: "standard", isActive: true, balance: 0 },
    { id: "default-savings-a", name: "Livret A", type: "savings", isActive: true, balance: 0 },
    { id: "default-professional-account", name: "Compte professionnel", type: "business", isActive: true, balance: 0 },
    { id: "default-cash", name: "Espèces", type: "cash", isActive: true, balance: 0 },
    { id: "default-paypal", name: "PayPal", type: "digital", isActive: true, balance: 0 },
  ]);

  assert.deepEqual(ids(selected), ["acc-current", "acc-savings", "acc-business", "acc-cash", "acc-paypal"]);
});
