import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const componentPath = resolve(process.cwd(), "src/components/dashboard-v2/DashboardV2.jsx");
const stylesPath = resolve(process.cwd(), "src/components/dashboard-v2/DashboardV2.css");

test("DashboardV2 is isolated and consumes supplied data", async () => {
  const content = await readFile(componentPath, "utf8");
  assert.match(content, /export default function DashboardV2/);
  assert.match(content, /metrics = \{\}/);
  assert.doesNotMatch(content, /firebase|Firestore|useDashboard|calculateAnnualTrajectory/);
  assert.match(content, /Projection au 31 décembre/);
});

test("DashboardV2 contains the requested desktop and mobile sections", async () => {
  const [content, styles] = await Promise.all([readFile(componentPath, "utf8"), readFile(stylesPath, "utf8")]);
  for (const label of ["Solde disponible", "Solde prévu fin de mois", "Projection au 31 décembre", "Dépenses du mois", "Dernières transactions", "Épargne", "Raccourcis"]) {
    assert.equal(content.includes(label), true);
  }
  assert.match(content, /lucide-react/);
  assert.match(styles, /grid-template-columns: repeat\(4/);
  assert.match(styles, /v2-bottom-nav/);
  assert.match(styles, /@media \(max-width: 620px\)/);
  assert.match(styles, /white-space: nowrap/);
});

test("DashboardV2 V2.4 uses the annual trajectory without new business calculations", async () => {
  const [content, styles] = await Promise.all([readFile(componentPath, "utf8"), readFile(stylesPath, "utf8")]);
  assert.match(content, /metrics\.annualTrajectory/);
  assert.match(content, /status === "current"/);
  assert.match(content, /strokeDasharray: "3 3"/);
  assert.match(content, /Estimation/);
  assert.match(styles, /font-size: 11px/);
  assert.match(styles, /gap: 14px/);
});

test("DashboardV2 temporary access remains outside the current navigation", async () => {
  const [app, navigation, settings, home] = await Promise.all([
    readFile(resolve(process.cwd(), "src/App.jsx"), "utf8"),
    readFile(resolve(process.cwd(), "src/navigation/appNavigation.js"), "utf8"),
    readFile(resolve(process.cwd(), "src/pages/Parametres.jsx"), "utf8"),
    readFile(resolve(process.cwd(), "src/pages/FinancialHome.jsx"), "utf8"),
  ]);

  assert.match(navigation, /DASHBOARD_V2: "DASHBOARD_V2"/);
  assert.match(navigation, /\[PAGES\.DASHBOARD_V2\]: "dashboard-v2"/);
  assert.match(navigation.match(/PAGE_ORDER = Object\.freeze\(\[([\s\S]*?)\]\)/)?.[1] || "", /DASHBOARD_V2/);
  assert.match(settings, /Ouvrir Dashboard V2/);
  assert.match(app, /page === PAGES\.DASHBOARD_V2/);
  assert.match(home, /variant === "v2"/);
  assert.match(home, /return <HorizonCockpit/);
});
test("DashboardV2 V2.2 visual tokens stay consistent and overflow-safe", async () => {
  const styles = await readFile(stylesPath, "utf8");
  assert.match(styles, /--radius: 16px/);
  assert.match(styles, /--shadow: 0 8px 28px/);
  assert.match(styles, /background: #f8faf9/);
  assert.match(styles, /\.v2-shell \{ display: grid; grid-template-columns: 248px minmax\(0, 1fr\); min-height: 100dvh; align-items: start; \}/);
  assert.match(styles, /min-height: 156px/);
  assert.match(styles, /overflow-x: clip/);
});
test("DashboardV2 V2.3 navigation is grouped and mobile-accessible", async () => {
  const navigation = await readFile(resolve(process.cwd(), "src/components/dashboard-v2/DashboardV2Navigation.jsx"), "utf8");
  for (const group of ["Pilotage", "Gestion financière", "Organisation", "Activité", "Configuration"]) {
    assert.equal(navigation.includes(`label: "${group}"`), true);
  }
  for (const item of ["Accueil", "Transactions", "Analyse", "Objectifs", "Plus"]) {
    assert.equal(navigation.includes(item), true);
  }
  for (const item of ["Comptes", "Budgets", "Prévisions", "Revenus récurrents", "Frais fixes", "Dettes & créances", "Travail", "Véhicules", "Devis", "Factures", "Rapports", "Paramètres"]) {
    assert.equal(navigation.includes(item), true);
  }
  assert.match(navigation, /aria-modal="true"/);
  assert.match(navigation, /event\.key === "Escape"/);
  assert.match(navigation, /aria-current=/);
  assert.match(navigation, /requestAnimationFrame/);
});
