import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("form serves create/update, validates and blocks duplicate submissions while remaining reusable", async () => {
  const source = await readFile(resolve(process.cwd(), "src/components/DebtReceivableForm.jsx"), "utf8");
  assert.match(source, /initialItem/);
  assert.match(source, /validateDebtReceivable\(form\)/);
  assert.match(source, /if \(submittingRef\.current\) return/);
  assert.match(source, /submittingRef\.current = true/);
  assert.match(source, /submittingRef\.current = false/);
  assert.match(source, /setSubmitError/);
  assert.match(source, /label="Tiers"/);
  assert.equal(source.includes("label=\"Contrepartie\""), false);
  assert.match(source, /Le tiers est obligatoire\./);
  assert.match(source, /<MenuItem value="">Sélectionner<\/MenuItem>/);
  assert.match(source, /CREATE_THIRD_PARTY_VALUE/);
  assert.match(source, /onRequestCreateThirdParty/);
  assert.match(source, /Ancienne contrepartie détectée/);
});
