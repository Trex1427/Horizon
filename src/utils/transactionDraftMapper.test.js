import test from "node:test";
import assert from "node:assert/strict";
import { buildTransactionPayload, validateTransactionForm } from "./transactionDraftMapper.js";
import {
  CREATE_ACCOUNT_VALUE,
  CREATE_ACTIVITY_VALUE,
  CREATE_CATEGORY_VALUE,
  CREATE_PROJECT_VALUE,
  CREATE_SUBCATEGORY_VALUE,
  CREATE_THIRD_PARTY_VALUE,
} from "../constants/transactionReferenceCreateValues.js";

test("validateTransactionForm rejects virement as transaction type", () => {
  const error = validateTransactionForm({
    date: "2026-07-11",
    montant: 100,
    type: "virement",
    accountId: "acc-1",
    categorie: "Alimentation",
  });

  assert.equal(error.includes("depense ou revenu"), true);
});

test("buildTransactionPayload includes V4 optional reference fields as nullable", () => {
  const payload = buildTransactionPayload({
    date: "2026-07-11",
    montant: "80.5",
    categorie: "Alimentation",
    categoryName: "Alimentation",
    categoryId: "cat-food",
    description: "Courses",
    type: "depense",
    accountId: "acc-1",
  });

  assert.equal(payload.type, "depense");
  assert.equal(payload.categoryId, "cat-food");
  assert.equal(payload.subcategoryId, null);
  assert.equal(payload.subcategoryName, null);
  assert.equal(payload.activityId, null);
  assert.equal(payload.activityName, null);
  assert.equal(payload.thirdPartyId, null);
  assert.equal(payload.thirdPartyName, null);
  assert.equal(payload.projectId, null);
  assert.equal(payload.projectName, null);
  assert.equal(payload.destinationAccountId, null);
  assert.equal(payload.workProjectId, null);
});

test("buildTransactionPayload keeps explicit reference ids and names", () => {
  const payload = buildTransactionPayload({
    date: "2026-07-11",
    montant: "125",
    categorie: "Transport",
    categoryName: "Transport",
    categoryId: "cat-transport",
    subcategoryId: "sub-carburant",
    subcategoryName: "Carburant",
    activityId: "act-auto",
    activityName: "Auto-entreprise",
    thirdPartyId: "tp-total",
    thirdPartyName: "TotalEnergies",
    projectId: "proj-monod",
    projectName: "Chantier Monod",
    description: "Plein",
    type: "depense",
    accountId: "acc-1",
  });

  assert.equal(payload.subcategoryId, "sub-carburant");
  assert.equal(payload.subcategoryName, "Carburant");
  assert.equal(payload.activityId, "act-auto");
  assert.equal(payload.activityName, "Auto-entreprise");
  assert.equal(payload.thirdPartyId, "tp-total");
  assert.equal(payload.thirdPartyName, "TotalEnergies");
  assert.equal(payload.projectId, "proj-monod");
  assert.equal(payload.projectName, "Chantier Monod");
});

test("individual edit removes category and subcategory without changing transaction fields", () => {
  const payload = buildTransactionPayload({
    date: "2026-07-11",
    montant: "125",
    categorie: "",
    categoryName: "",
    categoryId: "",
    subcategoryId: "",
    subcategoryName: "",
    description: "Libellé conservé",
    type: "depense",
    accountId: "acc-1",
  });

  assert.equal(payload.categoryId, null);
  assert.equal(payload.categoryName, "");
  assert.equal(payload.categorie, "");
  assert.equal(payload.subcategoryId, null);
  assert.equal(payload.subcategoryName, null);
  assert.equal(payload.date, "2026-07-11");
  assert.equal(payload.montant, 125);
  assert.equal(payload.description, "Libellé conservé");
  assert.equal(validateTransactionForm(payload), "");
});

test("buildTransactionPayload strips quick-create sentinels from optional references", () => {
  const payload = buildTransactionPayload({
    date: "2026-07-11",
    montant: "125",
    categorie: CREATE_CATEGORY_VALUE,
    categoryName: CREATE_CATEGORY_VALUE,
    categoryId: CREATE_CATEGORY_VALUE,
    subcategoryId: CREATE_SUBCATEGORY_VALUE,
    subcategoryName: "A ignorer",
    activityId: CREATE_ACTIVITY_VALUE,
    activityName: "A ignorer",
    thirdPartyId: CREATE_THIRD_PARTY_VALUE,
    thirdPartyName: "A ignorer",
    projectId: CREATE_PROJECT_VALUE,
    projectName: "A ignorer",
    description: "Plein",
    type: "depense",
    accountId: CREATE_ACCOUNT_VALUE,
  });

  assert.equal(payload.categoryId, null);
  assert.equal(payload.categoryName, "");
  assert.equal(payload.categorie, "");
  assert.equal(payload.subcategoryId, null);
  assert.equal(payload.subcategoryName, null);
  assert.equal(payload.activityId, null);
  assert.equal(payload.activityName, null);
  assert.equal(payload.thirdPartyId, null);
  assert.equal(payload.thirdPartyName, null);
  assert.equal(payload.projectId, null);
  assert.equal(payload.projectName, null);
  assert.equal(payload.accountId, "");
});

test("validateTransactionForm rejects create sentinels in required fields", () => {
  const categoryError = validateTransactionForm({
    date: "2026-07-11",
    montant: 100,
    type: "depense",
    accountId: "acc-1",
    categorie: CREATE_CATEGORY_VALUE,
    categoryName: CREATE_CATEGORY_VALUE,
    categoryId: CREATE_CATEGORY_VALUE,
  });

  const accountError = validateTransactionForm({
    date: "2026-07-11",
    montant: 100,
    type: "depense",
    accountId: CREATE_ACCOUNT_VALUE,
    categorie: "Alimentation",
    categoryName: "Alimentation",
    categoryId: "cat-food",
  });

  assert.equal(categoryError.includes("categorie selectionnee est invalide"), true);
  assert.equal(accountError.includes("compte source est obligatoire"), true);
});

test("buildTransactionPayload never persists the fixed-expense creation sentinel", () => {
  const sourceForm = {
    date: "2026-07-11",
    montant: "49.9",
    categorie: "Abonnements",
    categoryName: "Abonnements",
    categoryId: "cat-sub",
    description: "Internet",
    type: "depense",
    accountId: "acc-1",
    isFixedExpense: true,
    fixedExpenseId: "__CREATE_FIXED_EXPENSE__",
  };

  const payload = buildTransactionPayload(sourceForm);

  assert.equal(payload.isFixedExpense, false);
  assert.equal(payload.fixedExpenseId, null);
  assert.equal(payload.type, "depense");
  assert.equal(payload.categoryId, "cat-sub");
});

test("buildTransactionPayload persists an explicit fixed-expense association", () => {
  const payload = buildTransactionPayload({
    date: "2026-07-11",
    montant: "49.9",
    categorie: "Abonnements",
    categoryName: "Abonnements",
    categoryId: "cat-sub",
    description: "Internet",
    type: "depense",
    accountId: "acc-1",
    isFixedExpense: true,
    fixedExpenseId: "fixed-internet",
  });

  assert.equal(payload.isFixedExpense, true);
  assert.equal(payload.fixedExpenseId, "fixed-internet");
});

test("buildTransactionPayload preserves opportunity link metadata", () => {
  const payload = buildTransactionPayload({
    date: "2026-08-18",
    montant: "1180",
    categorie: "Prestations",
    categoryName: "Prestations",
    categoryId: "cat-income",
    description: "Prime chantier",
    type: "revenu",
    accountId: "acc-1",
    opportunityId: "opp-1",
    opportunityName: "Prime chantier",
    opportunityNotes: "Solde facture",
  });

  assert.equal(payload.opportunityId, "opp-1");
  assert.equal(payload.opportunityName, "Prime chantier");
  assert.equal(payload.opportunityNotes, "Solde facture");
});

test("buildTransactionPayload adds and removes a work dossier association", () => {
  const base = { date: "2026-07-27", montant: "25", type: "depense", accountId: "acc-1" };
  assert.equal(buildTransactionPayload({ ...base, workProjectId: "work-1" }).workProjectId, "work-1");
  assert.equal(buildTransactionPayload({ ...base, workProjectId: "" }).workProjectId, null);
});
