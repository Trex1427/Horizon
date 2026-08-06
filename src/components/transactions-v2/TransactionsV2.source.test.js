import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("TransactionsV2 is a new interface that preserves the V1 functional engine", async () => {
  const content = await readFile(resolve(process.cwd(), "src/components/transactions-v2/TransactionsV2.jsx"), "utf8");
  assert.match(content, /import Transactions from "\.\.\/\.\.\/pages\/Transactions\.jsx"/);
  assert.match(content, /<Transactions \{\.\.\.transactionsProps\} \/>/);
  assert.doesNotMatch(content, /Firestore|useTransactions|calculate/);
  for (const label of ["Transactions", "Pilotage financier", "Ce mois"]) assert.equal(content.includes(label), true);
});

test("TransactionsV2 inherits Horizon tokens and has desktop/mobile treatments", async () => {
  const styles = await readFile(resolve(process.cwd(), "src/components/transactions-v2/TransactionsV2.css"), "utf8");
  assert.match(styles, /var\(--teal\)/);
  assert.match(styles, /var\(--radius\)/);
  assert.match(styles, /var\(--shadow\)/);
  assert.match(styles, /@media \(min-width: 861px\)/);
  assert.match(styles, /@media \(max-width: 620px\)/);
  assert.match(styles, /overflow: visible/);
  assert.match(styles, /input\[name="searchText"\]/);
  assert.match(styles, /TRANSACTION {2}· {2}CATÉGORIE {2}· {2}COMPTE {2}· {2}DATE {2}· {2}MONTANT/);
  assert.match(styles, /white-space: normal !important/);
  assert.match(styles, /\.hui-button--primary \{ color: #fff; background: #0f766e; border-color: #0f766e; \}/);
  assert.match(styles, /\.hui-button--primary:hover \{ background: #115e59; border-color: #115e59; \}/);
  assert.match(styles, /\.transactions-compact-toolbar/);
  assert.match(styles, /\.transactions-compact-toolbar-actions/);
  assert.match(styles, /\.transactions-compact-toolbar \.MuiOutlinedInput-root/);
  assert.match(styles, /\.transactions-compact-toolbar \.hui-button--secondary/);
  assert.match(styles, /button:focus-visible/);
  assert.match(styles, /\.transactions-smart-sticky-header/);
  assert.match(styles, /@media \(max-width: 620px\)[\s\S]*transactions-compact-toolbar \.MuiInputBase-input/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
});
