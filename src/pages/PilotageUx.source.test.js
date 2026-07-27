import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const files = {
  layout: resolve(process.cwd(), "src/components/PilotagePageLayout.jsx"),
  budgets: resolve(process.cwd(), "src/pages/Budgets.jsx"),
  objectifs: resolve(process.cwd(), "src/pages/Objectifs.jsx"),
  previsions: resolve(process.cwd(), "src/pages/Previsions.jsx"),
  budgetCard: resolve(process.cwd(), "src/components/BudgetCard.jsx"),
  objectiveCard: resolve(process.cwd(), "src/components/ObjectiveCard.jsx"),
  forecastCard: resolve(process.cwd(), "src/components/ForecastSummaryCard.jsx"),
  app: resolve(process.cwd(), "src/App.jsx"),
};

test("Pilotage financier pages share the common UX structure", async () => {
  const layout = await readFile(files.layout, "utf8");
  const budgets = await readFile(files.budgets, "utf8");
  const objectifs = await readFile(files.objectifs, "utf8");
  const previsions = await readFile(files.previsions, "utf8");

  assert.equal(layout.includes("PilotageHeader"), true);
  assert.equal(layout.includes("PilotageSummary"), true);
  assert.equal(layout.includes("PilotageSection"), true);
  assert.equal(layout.includes("PilotageEmptyState"), true);

  for (const content of [budgets, objectifs, previsions]) {
    assert.equal(content.includes("PilotagePageShell"), true);
    assert.equal(content.includes("PilotageHeader"), true);
    assert.equal(content.includes("PilotageSummary"), true);
    assert.equal(content.includes("PilotageSection"), true);
  }
});

test("Budgets and Objectifs keep existing actions while adding relevant search", async () => {
  const budgets = await readFile(files.budgets, "utf8");
  const objectifs = await readFile(files.objectifs, "utf8");

  assert.equal(budgets.includes("searchPlaceholder=\"Rechercher un budget\""), true);
  assert.equal(objectifs.includes("searchPlaceholder=\"Rechercher un objectif\""), true);
  assert.equal(budgets.includes("onAdd={() => {"), true);
  assert.equal(objectifs.includes("onAdd={() => {"), true);
  assert.equal(budgets.includes("enableDoubleClickEdit={enableDesktopDoubleClickEdit}"), true);
  assert.equal(objectifs.includes("enableDoubleClickEdit={enableDesktopDoubleClickEdit}"), true);
});

test("Pilotage cards use the shared progress style and accessible progress labels", async () => {
  const budgetCard = await readFile(files.budgetCard, "utf8");
  const objectiveCard = await readFile(files.objectiveCard, "utf8");
  const forecastCard = await readFile(files.forecastCard, "utf8");

  assert.equal(budgetCard.includes("PILOTAGE_PROGRESS_SX"), true);
  assert.equal(objectiveCard.includes("PILOTAGE_PROGRESS_SX"), true);
  assert.equal(forecastCard.includes("PILOTAGE_PROGRESS_SX"), true);
  assert.equal(budgetCard.includes("aria-label={`Progression du budget"), true);
  assert.equal(objectiveCard.includes("aria-label={`Progression de l'objectif"), true);
  assert.equal(forecastCard.includes("aria-label=\"Progression des revenus attendus dans la prevision\""), true);
});

test("Previsions is reachable from the existing navigation without business logic changes", async () => {
  const app = await readFile(files.app, "utf8");
  const navigation = await readFile(new URL("../navigation/appNavigation.js", import.meta.url), "utf8");
  const previsions = await readFile(files.previsions, "utf8");

  assert.equal(app.includes("import Previsions from \"./pages/Previsions\";"), true);
  assert.equal(navigation.includes("PREVISIONS: \"PREVISIONS\""), true);
  assert.equal(navigation.includes("PAGES.PREVISIONS"), true);
  assert.equal(app.includes("{page === PAGES.PREVISIONS && <Previsions />}"), true);
  assert.equal(previsions.includes("useForecast()"), true);
  assert.equal(previsions.includes("PilotageHeader"), true);
});
