/* global process */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function source(path) {
  return readFile(resolve(process.cwd(), path), "utf8");
}

test("recurring income form resets add state and contains income-only copy", async () => {
  const content = await source("src/components/RecurringIncomeForm.jsx");
  assert.match(content, /setFormData\(\{[\s\S]*\.\.\.defaultForm/);
  assert.match(content, /Modifier un revenu récurrent/);
  assert.match(content, /Ajouter un revenu récurrent/);
  assert.doesNotMatch(content.toLowerCase(), /dépense|depense/);
});

test("recurring income form blocks duplicate submits and keeps visible mutation errors", async () => {
  const content = await source("src/components/RecurringIncomeForm.jsx");
  assert.match(content, /submittingRef\.current/);
  assert.match(content, /errorMessage=\{submitError\}/);
  assert.match(content, /if \(result\?\.success\)/);
});

test("one provider owns the real-time recurring-income listener", async () => {
  const [app, hook, service] = await Promise.all([
    source("src/App.jsx"),
    source("src/hooks/useRecurringIncome.js"),
    source("src/services/recurringIncomeService.js"),
  ]);
  assert.match(app, /RecurringIncomeProvider/);
  assert.equal((hook.match(/subscribeToRecurringIncome\(/g) || []).length, 1);
  assert.match(hook, /return \(\) => unsubscribe\(\)/);
  assert.match(service, /where\("ownerUid", "==", ownerUid\)/);
  assert.match(service, /income\.isActive !== false/);
});
