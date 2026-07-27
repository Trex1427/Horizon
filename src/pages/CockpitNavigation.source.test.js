import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const appPath = resolve(process.cwd(), "src/App.jsx");
const analysePath = resolve(process.cwd(), "src/pages/Analyse.jsx");

test("App wires cockpit card actions through existing local navigation state", async () => {
  const content = await readFile(appPath, "utf8");

  assert.equal(content.includes("analysisNavigationContext"), true);
  assert.equal(content.includes("function openAnalysisWithContext(context = null)"), true);
  assert.equal(content.includes("function openAnalysisMonth(monthKey, referenceDate)"), true);
  assert.equal(content.includes("onOpenTransactions={() => openTransactionsWithContext(null)}"), true);
  assert.equal(content.includes("onOpenAnalysisMonth={openAnalysisMonth}"), true);
  assert.equal(content.includes("onOpenOpportunities={() => navigateToPage(PAGES.OPPORTUNITES)}"), true);
  assert.equal(content.includes("navigationContext={analysisNavigationContext}"), true);
});

test("Analyse uses its existing period range calculation with a navigation reference date", async () => {
  const content = await readFile(analysePath, "utf8");

  assert.equal(content.includes("navigationContext = null"), true);
  assert.equal(content.includes("parseNavigationReferenceDate"), true);
  assert.equal(content.includes("const [referenceDate, setReferenceDate] = useState(() => new Date());"), true);
  assert.equal(content.includes("getPeriodRange(period, referenceDate)"), true);
  assert.equal(content.includes("getPreviousPeriodRange(period, referenceDate)"), true);
  assert.equal(content.includes("onNavigationContextApplied"), true);
});
