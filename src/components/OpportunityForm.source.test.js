import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const formPath = resolve(process.cwd(), "src/components/OpportunityForm.jsx");

test("OpportunityForm supports quick-create sentinels for activity, third party, and project", async () => {
  const content = await readFile(formPath, "utf8");

  assert.equal(content.includes("CREATE_ACTIVITY_VALUE"), true);
  assert.equal(content.includes("CREATE_THIRD_PARTY_VALUE"), true);
  assert.equal(content.includes("CREATE_PROJECT_VALUE"), true);
  assert.equal(content.includes("+ Créer une activité"), true);
  assert.equal(content.includes("+ Créer un tiers"), true);
  assert.equal(content.includes("openQuickActivityDialog();"), true);
  assert.equal(content.includes("openQuickThirdPartyDialog();"), true);
  assert.equal(content.includes("openQuickProjectDialog();"), true);
});

test("OpportunityForm keeps quick-create dialogs local and selects created ids", async () => {
  const content = await readFile(formPath, "utf8");

  assert.equal(content.includes("Création rapide d'un tiers"), true);
  assert.equal(content.includes("Création rapide d'une activité"), true);
  assert.equal(content.includes("Création rapide d'un projet"), true);
  assert.equal(content.includes("thirdPartyId: result.id"), true);
  assert.equal(content.includes("activityId: result.id"), true);
  assert.equal(content.includes("projectId: result.id"), true);
  assert.equal(content.includes("quickThirdPartySubmittingRef"), true);
  assert.equal(content.includes("quickActivitySubmittingRef"), true);
  assert.equal(content.includes("quickProjectSubmittingRef"), true);
  assert.equal(content.includes("if (quickThirdPartySubmittingRef.current)"), true);
  assert.equal(content.includes("if (quickActivitySubmittingRef.current)"), true);
  assert.equal(content.includes("if (quickProjectSubmittingRef.current)"), true);
});

test("OpportunityForm no longer exposes probability input or validation", async () => {
  const content = await readFile(formPath, "utf8");

  assert.equal(content.includes("Probabilite"), false);
  assert.equal(content.includes("probability"), false);
  assert.equal(content.includes("min: 0, max: 100"), false);
});
