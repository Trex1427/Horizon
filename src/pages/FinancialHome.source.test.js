import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("Accueil reuses the annual forecast and exposes the mobile-first financial summary", async () => {
  const [app, home, cockpit] = await Promise.all([
    readFile(resolve(process.cwd(), "src/App.jsx"), "utf8"),
    readFile(resolve(process.cwd(), "src/pages/FinancialHome.jsx"), "utf8"),
    readFile(resolve(process.cwd(), "src/components/HorizonCockpit.jsx"), "utf8"),
  ]);

  assert.match(app, /page === PAGES\.HOME[\s\S]*<FinancialHome/);
  assert.match(home, /calculateAnnualTrajectory/);
  assert.match(home, /remaining: forecastEndOfMonth/);
  assert.match(cockpit, /title="Solde actuel"[\s\S]*title="Solde prévu fin de mois"[\s\S]*title="Solde prévu au 31 décembre"/);
  assert.match(cockpit, /visibleRows\.map/);
  assert.match(cockpit, /MonthAmountLine label="Début"/);
  assert.doesNotMatch(cockpit, /<Table/);
  assert.match(cockpit, /Solde négatif|Solde negatif/);
});

test("Dashboard V2 branch renders before no-account guard", async () => {
  const home = await readFile(resolve(process.cwd(), "src/pages/FinancialHome.jsx"), "utf8");
  const v2Index = home.indexOf('if (variant === "v2")');
  const noAccountIndex = home.indexOf("if (!accounts.length)");
  assert.notEqual(v2Index, -1);
  assert.notEqual(noAccountIndex, -1);
  assert.equal(v2Index < noAccountIndex, true);
});
