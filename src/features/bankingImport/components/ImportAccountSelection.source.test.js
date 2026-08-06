import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const componentsDir = resolve(process.cwd(), "src/features/bankingImport/components");

test("one import account is selected automatically and the selector is hidden", async () => {
  const [wizard, mapping] = await Promise.all([
    readFile(resolve(componentsDir, "BankingImportWizard.jsx"), "utf8"),
    readFile(resolve(componentsDir, "ImportMappingStep.jsx"), "utf8"),
  ]);
  assert.match(wizard, /accounts\.length === 1[\s\S]*setSelectedAccountId\(accounts\[0\]\.id\)/);
  assert.match(mapping, /accounts\.length >= 2 && \([\s\S]*label="Compte Horizon"/);
});

test("two or more import accounts retain the account selector", async () => {
  const mapping = await readFile(resolve(componentsDir, "ImportMappingStep.jsx"), "utf8");
  assert.match(mapping, /accounts\.length >= 2/);
  assert.match(mapping, /accounts\.map\(\(account\) =>/);
  assert.match(mapping, /onAccountChange\?\.\(event\.target\.value\)/);
});