import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const hookUrl = new URL("./useAccounts.js", import.meta.url);
const serviceUrl = new URL("../services/accountsService.js", import.meta.url);

test("useAccounts initializes the new-user environment before subscribing", async () => {
  const source = await readFile(hookUrl, "utf8");

  assert.match(source, /initializeDefaultAccountsIfEmpty/);
  assert.match(source, /seedDefaultCategories/);
  assert.match(source, /seedDefaultSubcategories/);
  assert.match(source, /subscribeToAccounts/);
  assert.match(source, /setAccounts\(data\)/);
});

test("account existence decisions are server-only and never fall back to getDocs", async () => {
  const source = await readFile(serviceUrl, "utf8");
  const existenceFunction = source.match(/export async function hasAnyAccountDocuments\(\)[\s\S]*?\n}/)?.[0] || "";

  assert.match(source, /getDocsFromServer/);
  assert.match(existenceFunction, /getDocsFromServer/);
  assert.match(existenceFunction, /hasAnyAccountDocumentsWithReader/);
  assert.doesNotMatch(existenceFunction, /\bgetDocs\s*\(/);
  assert.doesNotMatch(existenceFunction, /catch\s*\(/);
});

test("default initialization remains delegated to the account service", async () => {
  const source = await readFile(serviceUrl, "utf8");

  assert.match(source, /initializeDefaultAccountsIfEmptyWithAdapter/);
  assert.match(source, /commitDefaultAccounts/);
});