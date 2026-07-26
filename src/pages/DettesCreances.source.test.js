import test from "node:test";
import assert from "node:assert/strict";
import process from "node:process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("navigation exposes and renders Dettes et créances without global loading", async () => {
  const app = await readFile(resolve(process.cwd(), "src/App.jsx"), "utf8");
  assert.match(app, /DETTES_CREANCES/);
  assert.match(app, /label: "Dettes et créances"/);
  assert.match(app, /page === PAGES\.DETTES_CREANCES[\s\S]*<DettesCreances[\s\S]*accounts=\{accounts\}[\s\S]*defaultAccount=\{defaultAccount\}[\s\S]*accountsLoading=\{accountsLoading\}[\s\S]*accountsError=\{accountsError\}/);
  assert.equal(app.includes("useDebtsReceivables"), false);
  assert.match(app, /import DettesCreances from "\.\/pages\/DettesCreances"/);
});
test("page presents summaries, CRUD actions, empty state and confirmation", async () => {
  const page = await readFile(resolve(process.cwd(), "src/pages/DettesCreances.jsx"), "utf8");
  for (const label of ["Dettes ouvertes", "Créances ouvertes", "Solde net indicatif", "Paiements", "Modifier", "Supprimer", "Aucune dette ni créance ouverte", "Payé:", "Restant:"]) {
    assert.ok(page.includes(label), `missing ${label}`);
  }
  assert.ok(page.includes("Tiers:"), "missing third-party display");
  assert.ok(page.includes("compatibilité legacy"), "missing legacy compatibility fallback");
  assert.ok(page.includes("introuvable ou supprimé"), "missing missing-third-party fallback");
  assert.equal(page.includes("{item.thirdPartyId}"), false, "must not render raw thirdPartyId");
  assert.match(page, /Supprimez d abord les paiements actifs/);
});
test("each debt or receivable exposes a responsive action opening the payments dialog", async () => {
  const page = await readFile(resolve(process.cwd(), "src/pages/DettesCreances.jsx"), "utf8");
  const dialog = await readFile(resolve(process.cwd(), "src/components/DebtReceivablePaymentsDialog.jsx"), "utf8");

  assert.match(page, /variant="contained"[\s\S]*PaymentsOutlined[\s\S]*onClick=\{\(\) => setPaymentsTarget\(item\)\}[\s\S]*Paiements/);
  assert.match(page, /flexDirection: \{ xs: "column", sm: "row" \}/);
  assert.match(page, /width: \{ xs: "100%", sm: "auto" \}/);
  assert.match(page, /<DebtReceivablePaymentsDialog key=\{paymentsTarget\?\.id \|\| "payments-closed"\} open=\{Boolean\(paymentsTarget\)\} debtReceivable=\{paymentsTarget\}/);
  assert.match(page, /onClose=\{\(\) => setPaymentsTarget\(null\)\}/);

  for (const field of ["Historique des paiements", "Montant (EUR)", "Date de paiement", "Libelle de la transaction", "AccountSelector", "Modifier", "Supprimer"]) {
    assert.ok(dialog.includes(field), `missing payment dialog capability: ${field}`);
  }
});
test("payment creation is explicit, account-backed and surfaces failures", async () => {
  const page = await readFile(resolve(process.cwd(), "src/pages/DettesCreances.jsx"), "utf8");
  const dialog = await readFile(resolve(process.cwd(), "src/components/DebtReceivablePaymentsDialog.jsx"), "utf8");
  const hook = await readFile(resolve(process.cwd(), "src/hooks/useDebtReceivablePayments.js"), "utf8");

  assert.match(dialog, /<Button variant="contained" onClick=\{startCreate\}/);
  assert.match(dialog, /Ajouter un paiement/);
  assert.match(dialog, /value && isValidDateString\(value\)/);
  assert.match(dialog, /parsePaymentAmountInput\(form\.amount\)/);
  assert.match(dialog, /\{editorOpen \? \([\s\S]*label="Montant \(EUR\)"[\s\S]*label="Date de paiement"[\s\S]*<AccountSelector/);
  assert.match(dialog, /accounts=\{accounts\}/);
  assert.match(dialog, /editingId[\s\S]*\? await update\(editingId, payload\)[\s\S]*: await create\(payload\)/);
  assert.match(dialog, /setSubmitError\(result\.error/);
  assert.match(dialog, /accountsError \? <Alert severity="error">/);
  assert.match(dialog, /window\.confirm\("Supprimer ce paiement et sa transaction liée \?"\)/);
  assert.match(dialog, /if \(!payment \|\| payment\.isDeleted === true \|\| deletingRef\.current\)/);
  assert.match(dialog, /setSubmitError\(result\.error \|\| "Impossible de supprimer ce paiement\."\)/);
  assert.match(hook, /createDebtReceivablePayment\(safeDebtReceivableId, payload\)/);
  assert.match(page, /accounts=\{accounts\} defaultAccount=\{defaultAccount\} accountsLoading=\{accountsLoading\} accountsError=\{accountsError\}/);
});

test("card double-click opens edit and ignores interactive controls", async () => {
  const page = await readFile(resolve(process.cwd(), "src/pages/DettesCreances.jsx"), "utf8");

  assert.match(page, /onDoubleClick=\{\(event\) => handleCardDoubleClick\(event, item\)\}/);
  assert.match(page, /event\.target\.closest\("button, a, input, textarea, select, \[role='button'\]"\)/);
  assert.match(page, /openEditForm\(item\)/);
  assert.match(page, /<Button onClick=\{\(\) => openEditForm\(item\)\}>Modifier<\/Button>/);
});
