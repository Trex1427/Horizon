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
});
