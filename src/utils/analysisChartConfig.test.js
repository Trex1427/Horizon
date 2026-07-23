import test from "node:test";
import assert from "node:assert/strict";
import { getAnalysisPieChartCopy } from "./analysisChartConfig.js";

test("analysis pie chart copy uses revenus labels for income sections", () => {
  const fixedIncomeCopy = getAnalysisPieChartCopy("fixedIncome");
  const variableIncomeCopy = getAnalysisPieChartCopy("variableIncome");

  assert.equal(fixedIncomeCopy.title, "Répartition des revenus fixes");
  assert.equal(fixedIncomeCopy.subtitle, "Revenus récurrents par source");
  assert.equal(fixedIncomeCopy.totalLabel, "Total des revenus fixes");
  assert.equal(fixedIncomeCopy.emptyMessage, "Aucun revenu fixe sur cette période");
  assert.equal(variableIncomeCopy.title, "Repartition des revenus variables");
  assert.equal(variableIncomeCopy.subtitle, "Revenus du mois par categorie");
  assert.equal(variableIncomeCopy.totalLabel, "Total des revenus");
  assert.equal(variableIncomeCopy.entityLabelSingular, "revenu");
  assert.equal(variableIncomeCopy.entityLabelPlural, "revenus");
  assert.match(fixedIncomeCopy.emptyMessage, /revenu/i);
  assert.match(variableIncomeCopy.valueLabel, /revenus/i);

  const incomeCombinedCopy = [
    fixedIncomeCopy.title,
    fixedIncomeCopy.subtitle,
    fixedIncomeCopy.emptyMessage,
    fixedIncomeCopy.valueLabel,
    variableIncomeCopy.title,
    variableIncomeCopy.subtitle,
    variableIncomeCopy.emptyMessage,
    variableIncomeCopy.valueLabel,
    variableIncomeCopy.totalLabel,
  ].join(" ").toLowerCase();

  assert.equal(incomeCombinedCopy.includes("depense"), false);
  assert.equal(incomeCombinedCopy.includes("dépense"), false);
});