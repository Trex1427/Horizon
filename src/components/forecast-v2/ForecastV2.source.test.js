import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const component = resolve(process.cwd(), "src/components/forecast-v2/ForecastV2.jsx");
const styles = resolve(process.cwd(), "src/components/forecast-v2/ForecastV2.css");

test("ForecastV2 reuses existing data and calculations only", async () => {
  const content = await readFile(component, "utf8");
  for (const item of ["calculateAnnualTrajectory", "calculateBudgetMetrics", "useAccounts", "useTransactions", "useFixedExpenses", "useRecurringIncome", "useBudgets", "useTransfers"]) assert.equal(content.includes(item), true);
  assert.doesNotMatch(content, /firebase|Firestore|addDoc|updateDoc|deleteDoc/);
});

test("ForecastV2 contains the required cockpit and responsive states", async () => {
  const [content, css] = await Promise.all([readFile(component, "utf8"), readFile(styles, "utf8")]);
  for (const label of ["Solde actuel", "Solde prévu fin de mois", "Projection au 31 décembre", "Variation prévisionnelle", "Projection annuelle", "Résumé des prévisions", "Historique", "Aujourd’hui", "Projection", "Revenus prévus", "Dépenses prévues", "Épargne attendue", "À surveiller", "Aucun risque détecté", "Découvert futur"]) assert.equal(content.includes(label), true);
  assert.match(content, /current\?\.monthlyNet/);
  assert.match(content, /onNavigate\?\.\("budgets"\)/);
  assert.match(css, /@media\(max-width:620px\)/); assert.match(css, /min-height:44px/); assert.match(css, /grid-template-columns:1fr/);
  assert.match(css, /overflow:hidden/); assert.doesNotMatch(css, /overflow-x:auto|min-width:620px/);
  assert.match(css, /@keyframes forecast-card-in/); assert.match(css, /prefers-reduced-motion:reduce/);
});
