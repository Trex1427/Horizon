import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const hookUrl = new URL("./useAccounts.js", import.meta.url);
const serviceUrl = new URL("../services/accountsService.js", import.meta.url);

test("useAccounts remains read-only on empty, cached, offline and repeated snapshots", async () => {
  const source = await readFile(hookUrl, "utf8");

  assert.doesNotMatch(source, /initializeDefaultAccountsIfEmpty/);
  assert.doesNotMatch(source, /hasAnyAccountDocuments/);
  assert.doesNotMatch(source, /defaultAccountDefinitions|commitDefaultAccounts|batch\.set/i);
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

test("default initialization is retained only as an explicitly documented service action", async () => {
  const source = await readFile(serviceUrl, "utf8");

  assert.match(source, /Explicit onboarding\/admin action only/);
  assert.match(source, /initializeDefaultAccountsIfEmptyWithAdapter/);
});
