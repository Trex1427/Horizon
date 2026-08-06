import { spawn } from "node:child_process";
import path from "node:path";

const BASELINE = Object.freeze({
  "src/auth/AuthProvider.jsx|react-hooks/set-state-in-effect|2": 1,
  "src/auth/AuthProvider.jsx|react-refresh/only-export-components|2": 1,
  "src/components/BetaJournalSection.jsx|react-hooks/set-state-in-effect|2": 1,
  "src/components/CategoryForm.jsx|react-hooks/set-state-in-effect|2": 1,
  "src/components/EntityDialog.jsx|react-hooks/set-state-in-effect|2": 1,
  "src/components/ObjectiveForm.jsx|react-hooks/immutability|2": 1,
  "src/components/ObjectiveForm.jsx|react-hooks/set-state-in-effect|2": 1,
  "src/components/OpportunityForm.jsx|react-hooks/set-state-in-effect|2": 1,
  "src/components/PilotagePageLayout.jsx|react-refresh/only-export-components|2": 3,
  "src/components/TransactionBulkEditDialog.jsx|react-hooks/set-state-in-effect|2": 1,
  "src/components/TransactionDraftReviewDialog.jsx|react-hooks/preserve-manual-memoization|2": 4,
  "src/components/TransactionDraftReviewDialog.jsx|react-hooks/set-state-in-effect|2": 1,
  "src/components/VehicleFormDialog.jsx|react-hooks/set-state-in-effect|2": 1,
  "src/context/TransactionsContext.jsx|react-hooks/set-state-in-effect|2": 1,
  "src/context/TransactionsContext.jsx|react-refresh/only-export-components|2": 1,
  "src/features/bankingImport/components/BankingImportWizard.jsx|react-hooks/set-state-in-effect|2": 1,
  "src/features/transfers/components/TransferForm.jsx|react-hooks/set-state-in-effect|2": 1,
  "src/hooks/useAccounts.js|react-hooks/set-state-in-effect|2": 1,
  "src/hooks/useActivities.js|react-hooks/set-state-in-effect|2": 1,
  "src/hooks/useBudgets.js|react-hooks/set-state-in-effect|2": 1,
  "src/hooks/useCategories.js|react-hooks/set-state-in-effect|2": 1,
  "src/hooks/useFixedExpenses.js|react-hooks/set-state-in-effect|2": 1,
  "src/hooks/useObjectives.js|react-hooks/set-state-in-effect|2": 1,
  "src/hooks/useOpportunities.js|react-hooks/set-state-in-effect|2": 1,
  "src/hooks/useProjects.js|react-hooks/set-state-in-effect|2": 1,
  "src/hooks/useSubcategories.js|react-hooks/set-state-in-effect|2": 1,
  "src/hooks/useThirdParties.js|react-hooks/set-state-in-effect|2": 1,
  "src/hooks/useTransfers.js|react-hooks/set-state-in-effect|2": 1,
  "src/pages/Analyse.jsx|react-hooks/set-state-in-effect|2": 2,
  "src/pages/Referentiels.jsx|react-hooks/exhaustive-deps|1": 5,
  "src/pages/Referentiels.jsx|react-hooks/static-components|2": 5,
  "src/pages/Transactions.jsx|react-hooks/exhaustive-deps|1": 7,
  "src/pages/Transactions.jsx|react-hooks/preserve-manual-memoization|2": 4,
  "src/pages/Transactions.jsx|react-hooks/set-state-in-effect|2": 7,
  "src/services/fixedExpenseDuplicateMerge.test.js|no-unused-vars|2": 1,
  "src/services/receiptParserService.js|no-useless-escape|2": 1,
  "src/services/receiptParserService.js|preserve-caught-error|2": 2,
  "src/services/voiceTransactionParser.js|no-useless-escape|2": 2,
});

function runEslint() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["node_modules/eslint/bin/eslint.js", ".", "-f", "json"], { cwd: process.cwd(), shell: false });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

const result = await runEslint();
if (!result.stdout.trim()) throw new Error(result.stderr || "ESLint did not return JSON.");
const reports = JSON.parse(result.stdout);
const current = new Map();
for (const report of reports) {
  const relative = path.relative(process.cwd(), report.filePath).split(path.sep).join("/");
  for (const message of report.messages) {
    const key = `${relative}|${message.ruleId}|${message.severity}`;
    current.set(key, (current.get(key) || 0) + 1);
  }
}

const regressions = [];
for (const [key, count] of current) {
  const ceiling = BASELINE[key];
  if (ceiling === undefined) regressions.push(`Nouveau diagnostic : ${key} × ${count}`);
  else if (count > ceiling) regressions.push(`Baseline dépassée : ${key} (${count} > ${ceiling})`);
}

const total = [...current.values()].reduce((sum, count) => sum + count, 0);
const baselineTotal = Object.values(BASELINE).reduce((sum, count) => sum + count, 0);
if (regressions.length) {
  console.error(regressions.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Baseline ESLint respectée : ${total}/${baselineTotal} diagnostics historiques maximum, aucune nouvelle catégorie.`);
}
