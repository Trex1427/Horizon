import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const cockpitPath = resolve(process.cwd(), "src/components/HorizonCockpit.jsx");

test("HorizonCockpit displays current month revenue, expenses, and variation in the cockpit indicators", async () => {
  const content = await readFile(cockpitPath, "utf8");

  assert.equal(content.includes("Variation du mois"), true);
  assert.equal(content.includes("Solde prévu fin de mois"), true);
  assert.equal(content.includes("Solde prévu au 31 décembre"), true);
  assert.equal(content.includes("totalRevenue"), true);
  assert.equal(content.includes("totalExpense"), true);
  assert.equal(content.includes("monthlySavings"), true);
  assert.equal(content.includes("remaining"), true);
});

test("AnnualTrajectorySummary displays monthly income, expenses, and variation without recalculating in React", async () => {
  const content = await readFile(cockpitPath, "utf8");

  assert.equal(content.includes("row?.monthlyIncome"), true);
  assert.equal(content.includes("row?.monthlyExpenses"), true);
  assert.equal(content.includes("row?.monthlyNet"), true);
  assert.equal(content.includes("Rev."), true);
  assert.equal(content.includes("Dep."), true);
  assert.equal(content.includes("Variation"), true);
});

test("HorizonCockpit exposes accessible helper tooltips on principal indicators", async () => {
  const content = await readFile(cockpitPath, "utf8");

  assert.equal(content.includes("helpText=\"Total actuel de tous les comptes actifs.\""), true);
  assert.equal(content.includes("helpText=\"Revenus moins dépenses du mois.\""), true);
  assert.equal(content.includes("helpText=\"Estimation du solde à la fin du mois selon les prévisions actuelles.\""), true);
  assert.equal(content.includes("helpText=\"Projection du solde au dernier jour de l'année.\""), true);
  assert.equal(content.includes("aria-label={`${title} : ${helpText}`}"), true);
});

test("HorizonCockpit makes principal cards and trajectory months interactive without touching calculations", async () => {
  const content = await readFile(cockpitPath, "utf8");

  assert.equal(content.includes("ButtonBase"), true);
  assert.equal(content.includes("onOpenTransactions"), true);
  assert.equal(content.includes("onOpenAnalysisMonth"), true);
  assert.equal(content.includes("onOpenOpportunities"), true);
  assert.equal(content.includes("scrollIntoView({ behavior: \"smooth\", block: \"center\", inline: \"nearest\" })"), true);
  assert.equal(content.includes("aria-label={`Ouvrir l'analyse du mois de ${monthLabel}`}"), true);
  assert.equal(content.includes("ariaLabel=\"Ouvrir les transactions depuis le solde actuel\""), true);
  assert.equal(content.includes("ariaLabel=\"Ouvrir l'analyse du mois courant\""), true);
  assert.equal(content.includes("ariaLabel=\"Faire défiler la trajectoire jusqu'au mois courant\""), true);
  assert.equal(content.includes("ariaLabel=\"Faire défiler la trajectoire jusqu'à décembre\""), true);
  assert.equal(content.includes("ariaLabel=\"Ouvrir les opportunités\""), true);
  assert.equal(content.includes("findFirstProjectedNegativeMonth(trajectoryRows)"), true);
});
