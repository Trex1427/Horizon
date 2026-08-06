import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve('src/components/ui');
const indexSource = fs.readFileSync(path.join(root, 'index.js'), 'utf8');
const componentSources = fs.readdirSync(root, { recursive: true })
  .filter(file => /\.(jsx|js)$/.test(file) && !file.endsWith('.test.js'))
  .map(file => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');

const expected = ['PageLayout','PageHeader','Section','Grid','Container','Sidebar','BottomNavigation','ActionBar','Card','KpiCard','SummaryCard','SectionCard','InfoCard','PrimaryButton','SecondaryButton','GhostButton','DangerButton','IconButton','Input','SearchInput','CurrencyInput','Textarea','Checkbox','Switch','Select','DatePicker','DataTable','MobileCard','LineChart','DonutChart','Sparkline','ProgressBar','Badge','Toast','Alert','Banner','Dialog','ConfirmDialog','Drawer','BottomSheet','EmptyState','LoadingState','Skeleton','ErrorState'];

test('exposes every Design System family from one public entry point', () => {
  for (const family of ['layout','navigation','cards','buttons','forms','tables','charts','feedback','dialogs','states']) assert.match(indexSource, new RegExp(`./${family}/`));
  for (const component of expected) assert.match(componentSources, new RegExp(`export (?:function|const) ${component}\\b`));
});

test('keeps the UI library independent from application data layers', () => {
  assert.doesNotMatch(componentSources, /(?:firebase|firestore|annualTrajectory|\/hooks\/|\/services\/|useAuth)/i);
});

test('documents public props and accessibility guarantees', () => {
  const documentation = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
  for (const component of expected) assert.ok(documentation.includes('`' + component + '`'));
  assert.match(documentation, /44 px/);
  assert.match(documentation, /prefers-reduced-motion/);
});

test('all V2 page-owned KPIs use the shared KpiCard', () => {
  const migratedPages = ['dashboard-v2/DashboardV2.jsx','accounts-v2/AccountsV2.jsx','budgets-v2/BudgetsV2.jsx','forecast-v2/ForecastV2.jsx','analyse-v2/AnalyseV2.jsx','reports-v2/ReportsV2.jsx','objectives-v2/ObjectivesV2.jsx','recurring-income-v2/RecurringIncomeV2.jsx','fixed-expenses-v2/FixedExpensesV2.jsx','debts-claims-v2/DebtsClaimsV2.jsx','vehicles-v2/VehiclesV2.jsx','work-v2/WorkV2.jsx','quotes-v2/QuotesV2.jsx','invoices-v2/InvoicesV2.jsx'];
  for (const relativePath of migratedPages) {
    const source = fs.readFileSync(path.resolve('src/components', relativePath), 'utf8');
    assert.match(source, /import \{[^}]*KpiCard[^}]*\} from "\.\.\/ui";/);
    assert.match(source, /<KpiCard\b/);
    assert.doesNotMatch(source, /function Kpi\b|<Kpi\b/);
  }
  const transactions = fs.readFileSync(path.resolve('src/components/transactions-v2/TransactionsV2.jsx'), 'utf8');
  assert.doesNotMatch(transactions, /function Kpi\b|<Kpi\b/);
});

test('all V2 page-owned action bars use the shared ActionBar', () => {
  const migratedPages = ['accounts-v2/AccountsV2.jsx','budgets-v2/BudgetsV2.jsx','forecast-v2/ForecastV2.jsx','analyse-v2/AnalyseV2.jsx','reports-v2/ReportsV2.jsx','objectives-v2/ObjectivesV2.jsx','recurring-income-v2/RecurringIncomeV2.jsx','fixed-expenses-v2/FixedExpensesV2.jsx','debts-claims-v2/DebtsClaimsV2.jsx','vehicles-v2/VehiclesV2.jsx','work-v2/WorkV2.jsx','quotes-v2/QuotesV2.jsx','invoices-v2/InvoicesV2.jsx','settings-v2/SettingsV2.jsx'];
  for (const relativePath of migratedPages) {
    const source = fs.readFileSync(path.resolve('src/components', relativePath), 'utf8');
    assert.match(source, /import \{[^}]*ActionBar[^}]*\} from "\.\.\/ui";/);
    assert.match(source, /<ActionBar\b/);
    assert.doesNotMatch(source, /<(?:section|div)[^>]*className="[^"]*(?:-v2-actions|action-bar)[^"]*"/);
  }
  for (const relativePath of ['transactions-v2/TransactionsV2.jsx','dashboard-v2/DashboardV2.jsx']) {
    const source = fs.readFileSync(path.resolve('src/components', relativePath), 'utf8');
    assert.doesNotMatch(source, /<(?:section|div)[^>]*className="[^"]*(?:-v2-actions|action-bar)[^"]*"/);
  }
});

test('all V2 base cards use the shared Card', () => {
  const migrations = new Map([
    ['accounts-v2/AccountsV2.jsx', 'accounts-v2-account'],
    ['budgets-v2/BudgetsV2.jsx', 'budgets-v2-card'],
    ['objectives-v2/ObjectivesV2.jsx', 'objectives-v2-card'],
    ['recurring-income-v2/RecurringIncomeV2.jsx', 'recurring-v2-card'],
    ['fixed-expenses-v2/FixedExpensesV2.jsx', 'fixed-v2-card'],
    ['debts-claims-v2/DebtsClaimsV2.jsx', 'debts-v2-card'],
    ['vehicles-v2/VehiclesV2.jsx', 'vehicles-v2-card'],
    ['work-v2/WorkV2.jsx', 'work-v2-card'],
    ['quotes-v2/QuotesV2.jsx', 'quotes-v2-card'],
    ['invoices-v2/InvoicesV2.jsx', 'invoices-v2-card'],
    ['settings-v2/SettingsV2.jsx', 'settings-v2-card'],
    ['forecast-v2/ForecastV2.jsx', 'forecast-v2-alerts'],
    ['analyse-v2/AnalyseV2.jsx', 'analyse-v2-attention'],
  ]);
  for (const [relativePath, marker] of migrations) {
    const source = fs.readFileSync(path.resolve('src/components', relativePath), 'utf8');
    assert.match(source, /import \{[^}]*Card[^}]*\} from "\.\.\/ui";/);
    assert.match(source, /<Card\b/);
    if (marker.endsWith('-card') || marker.endsWith('-account')) {
      assert.doesNotMatch(source, new RegExp(`<article[^>]*className=[^>]*${marker}`));
    }
  }
});

test('all V2 specialized cards use SummaryCard, SectionCard or InfoCard', () => {
  const pagesRoot = path.resolve('src/components');
  const pageFiles = fs.readdirSync(pagesRoot, { recursive: true }).filter(file => file.endsWith('V2.jsx'));
  const specialized = ['SummaryCard', 'SectionCard', 'InfoCard'];
  let migratedCards = 0;
  for (const relativePath of pageFiles) {
    const source = fs.readFileSync(path.join(pagesRoot, relativePath), 'utf8');
    assert.doesNotMatch(source, /<(?:article|section|div|form)\b[^>]*className[^>]*v2-card/, relativePath);
    assert.doesNotMatch(source, /function\s+(?:SummaryCard|SectionCard|InfoCard)\b/, relativePath);
    for (const component of specialized) {
      const occurrences = [...source.matchAll(new RegExp(`<${component}\\b`, 'g'))];
      if (!occurrences.length) continue;
      migratedCards += occurrences.length;
      assert.match(source, new RegExp(`import \\{[^}]*\\b${component}\\b[^}]*\\} from "\\.\\.\\/ui";`), `${relativePath} must import ${component} from the Design System`);
    }
  }
  assert.equal(migratedCards, 34);
});

test('all V2 dialogs use Dialog, ConfirmDialog, Drawer or BottomSheet', () => {
  const pagesRoot = path.resolve('src/components');
  const pageFiles = fs.readdirSync(pagesRoot, { recursive: true }).filter(file => file.endsWith('V2.jsx'));
  const dialogComponents = ['Dialog', 'ConfirmDialog', 'Drawer', 'BottomSheet'];
  let migratedDialogs = 0;
  for (const relativePath of pageFiles) {
    const source = fs.readFileSync(path.join(pagesRoot, relativePath), 'utf8');
    assert.doesNotMatch(source, /role="dialog"|className="[^"]*dialog-backdrop/, relativePath);
    assert.doesNotMatch(source, /function\s+(?:Dialog|ConfirmDialog|Drawer|BottomSheet)\b/, relativePath);
    for (const component of dialogComponents) {
      const occurrences = [...source.matchAll(new RegExp(`<${component}\\b`, 'g'))];
      if (!occurrences.length) continue;
      migratedDialogs += occurrences.length;
      assert.match(source, new RegExp(`import \\{[^}]*\\b${component}\\b[^}]*\\} from "\\.\\.\\/ui";`), `${relativePath} must import ${component} from the Design System`);
    }
  }
  assert.equal(migratedDialogs, 5);
});

test('all V2 charts and progress visuals use Design System primitives', () => {
  const pagesRoot = path.resolve('src/components');
  const pageFiles = fs.readdirSync(pagesRoot, { recursive: true }).filter(file => file.endsWith('V2.jsx'));
  const forbiddenLocalRendering = /<svg\b|function\s+\w*(?:Chart|Donut|Sparkline)\b|<(?:div|i)\b[^>]*className="(?:v2-progress|v2-saving-bar|budgets-v2-progress|objectives-v2-(?:global-bar|progress))"/;
  for (const relativePath of pageFiles) {
    const source = fs.readFileSync(path.join(pagesRoot, relativePath), 'utf8');
    assert.doesNotMatch(source, forbiddenLocalRendering, relativePath);
    assert.doesNotMatch(source, /ExpenseCategoryPieChart/, relativePath);
  }
  const migrations = new Map([
    ['dashboard-v2/DashboardV2.jsx', ['LineChart', 'DonutChart', 'Sparkline', 'ProgressBar']],
    ['forecast-v2/ForecastV2.jsx', ['LineChart']],
    ['analyse-v2/AnalyseV2.jsx', ['LineChart', 'DonutChart']],
    ['reports-v2/ReportsV2.jsx', ['LineChart', 'DonutChart']],
    ['budgets-v2/BudgetsV2.jsx', ['ProgressBar']],
    ['objectives-v2/ObjectivesV2.jsx', ['ProgressBar']],
    ['recurring-income-v2/RecurringIncomeV2.jsx', ['ProgressBar']],
    ['fixed-expenses-v2/FixedExpensesV2.jsx', ['ProgressBar']],
    ['debts-claims-v2/DebtsClaimsV2.jsx', ['ProgressBar']],
  ]);
  for (const [relativePath, components] of migrations) {
    const source = fs.readFileSync(path.join(pagesRoot, relativePath), 'utf8');
    for (const component of components) {
      assert.match(source, new RegExp(`<${component}\\b`), `${relativePath} must render ${component}`);
      assert.match(source, new RegExp(`import \\{[^}]*${component}[^}]*\\} from "\\.\\.\\/ui";`), `${relativePath} must import ${component} from the Design System`);
    }
  }
});

test('all V2 form controls use Design System primitives', () => {
  const pagesRoot = path.resolve('src/components');
  const pageFiles = fs.readdirSync(pagesRoot, { recursive: true }).filter(file => file.endsWith('V2.jsx'));
  const formComponents = ['Input', 'SearchInput', 'CurrencyInput', 'Textarea', 'Checkbox', 'Switch', 'Select', 'DatePicker'];
  let migratedControls = 0;
  for (const relativePath of pageFiles) {
    const source = fs.readFileSync(path.join(pagesRoot, relativePath), 'utf8');
    assert.doesNotMatch(source, /<(?:input|select|textarea)\b/, relativePath);
    for (const component of formComponents) {
      const occurrences = [...source.matchAll(new RegExp(`<${component}\\b`, 'g'))];
      if (!occurrences.length) continue;
      migratedControls += occurrences.length;
      assert.match(source, new RegExp(`import \\{[^}]*\\b${component}\\b[^}]*\\} from "\\.\\.\\/ui";`), `${relativePath} must import ${component} from the Design System`);
    }
  }
  assert.equal(migratedControls, 66);
});

test('all V2 display states use Design System primitives', () => {
  const pagesRoot = path.resolve('src/components');
  const pageFiles = fs.readdirSync(pagesRoot, { recursive: true }).filter(file => file.endsWith('V2.jsx'));
  const stateComponents = ['EmptyState', 'LoadingState', 'Skeleton', 'ErrorState'];
  let migratedStates = 0;
  const forbiddenLocalState = /function\s+(?:EmptyState|LoadingState|ErrorState)\b|<(?:div|section|p)\b[^>]*(?:role="alert"|className="[^"]*(?:-empty|v2-empty|-loading|-error)[^"]*")/;
  for (const relativePath of pageFiles) {
    const source = fs.readFileSync(path.join(pagesRoot, relativePath), 'utf8');
    assert.doesNotMatch(source, forbiddenLocalState, relativePath);
    for (const component of stateComponents) {
      const occurrences = [...source.matchAll(new RegExp(`<${component}\\b`, 'g'))];
      if (!occurrences.length) continue;
      migratedStates += occurrences.length;
      assert.match(source, new RegExp(`import \\{[^}]*\\b${component}\\b[^}]*\\} from "\\.\\.\\/ui";`), `${relativePath} must import ${component} from the Design System`);
    }
  }
  assert.ok(migratedStates > 0);
});
