import test from "node:test";
import assert from "node:assert/strict";
import {
  buildBankImportClassificationSuggestion,
  buildImportValidationRows,
  normalizeBankImportClassificationTitle,
} from "../services/importPreviewService.js";

test("client virement label is not auto-marked as internal transfer candidate", () => {
  const rows = buildImportValidationRows({
    preview: {
      transactions: [
        {
          id: "row-1",
          operationDate: "2026-07-11",
          rawLabel: "VIREMENT CLIENT DUPONT",
          normalizedLabel: "VIREMENT CLIENT DUPONT",
          amount: 1200,
          type: "revenu",
          accountId: "acc-1",
          duplicateStatus: "new_transaction",
          transferCandidate: false,
          transferConfidence: 0,
          transferReasons: [],
        },
      ],
    },
    existingTransactions: [],
    categories: [],
  });

  assert.equal(rows[0].transferCandidate, false);
  assert.equal(rows[0].transferConfirmed, false);
});

test("internal virement can be marked as transfer candidate but remains unconfirmed", () => {
  const rows = buildImportValidationRows({
    preview: {
      transactions: [
        {
          id: "row-1",
          operationDate: "2026-07-11",
          rawLabel: "VIREMENT INTERNE VERS LIVRET A",
          normalizedLabel: "VIREMENT INTERNE VERS LIVRET A",
          amount: -500,
          type: "depense",
          accountId: "acc-1",
          duplicateStatus: "new_transaction",
          transferCandidate: true,
          transferConfidence: 0.72,
          transferReasons: ["Libelle contenant virement interne"],
        },
      ],
    },
    existingTransactions: [
      {
        id: "tx-opposite",
        type: "revenu",
        montant: 500,
        accountId: "acc-2",
      },
    ],
    categories: [],
  });

  assert.equal(rows[0].transferCandidate, true);
  assert.equal(rows[0].transferConfidence >= 0.72, true);
  assert.equal(rows[0].transferReasons.some((reason) => reason.includes("Montant oppose")), true);
  assert.equal(rows[0].transferConfirmed, false);
  assert.equal(rows[0].type, "depense");
});

test("bank import preview applies a classification suggestion without committing", () => {
  const rows = buildImportValidationRows({
    preview: {
      transactions: [
        {
          id: "row-1",
          operationDate: "2026-07-11",
          rawLabel: "CARREFOUR MARKET",
          normalizedLabel: "CARREFOUR MARKET",
          amount: -42,
          type: "depense",
          accountId: "acc-1",
          duplicateStatus: "new_transaction",
        },
      ],
    },
    existingTransactions: [
      {
        id: "history-1",
        description: "carrefour market",
        type: "depense",
        accountId: "acc-1",
        categoryId: "cat-food",
        subcategoryId: "sub-groceries",
        thirdPartyId: "third-carrefour",
        activityId: "act-home",
        projectId: "proj-1",
      },
    ],
    categories: [{ id: "cat-food", name: "Alimentation" }],
  });

  assert.equal(rows[0].classificationSuggestionApplied, true);
  assert.equal(rows[0].classificationSuggestion.score, 95);
  assert.equal(rows[0].categoryId, "cat-food");
  assert.equal(rows[0].subcategoryId, "sub-groceries");
  assert.equal(rows[0].thirdPartyId, "third-carrefour");
  assert.equal(rows[0].activityId, "act-home");
  assert.equal(rows[0].projectId, "proj-1");
});

test("bank import classification normalizes long card labels without fuzzy matching", () => {
  assert.equal(
    normalizeBankImportClassificationTitle("Paiement par carte X2648 INTERMARCHE VENTABRE 28/05 - Intermarché"),
    normalizeBankImportClassificationTitle("Paiement par carte X2648 INTERMARCHE VENTABRE 10/06 - Intermarché")
  );
  assert.equal(
    normalizeBankImportClassificationTitle("Paiement par carte X2648 GOOGLE*GOOGLE PLAY A 26/05 - Google"),
    normalizeBankImportClassificationTitle("Paiement par carte X2648 GOOGLE *Google Play 28/06 - Google")
  );
  assert.equal(
    normalizeBankImportClassificationTitle("Virement en votre faveur FRANCE TRAVAIL 26125501820 - 34 4T 7871126X 07052026 26125501820"),
    normalizeBankImportClassificationTitle("Virement en votre faveur FRANCE TRAVAIL 26153501408 - 34 4T 7871126X 04062026 26153501408")
  );
  assert.notEqual(
    normalizeBankImportClassificationTitle("Paiement par carte X2648 INTERMARCHE VENTABRE 28/05 - Intermarché"),
    normalizeBankImportClassificationTitle("Paiement par carte X2648 SOFIANE CARBURANTS V 13/06 - Intermarché")
  );
});

test("known Intermarche, Google Play and France Travail rows receive import suggestions", () => {
  const existingTransactions = [
    {
      id: "history-intermarche",
      description: "Paiement par carte X2648 INTERMARCHE VENTABRE 10/06 - Intermarché",
      type: "depense",
      accountId: "acc-main",
      categoryId: "cat-food",
      subcategoryId: "sub-grocery",
      thirdPartyId: "third-intermarche",
    },
    {
      id: "history-google",
      description: "Paiement par carte X2648 GOOGLE *Google Play 28/06 - Google",
      type: "depense",
      accountId: "acc-main",
      categoryId: "cat-digital",
      subcategoryId: "sub-apps",
      thirdPartyId: "third-google",
    },
    {
      id: "history-france-travail",
      description: "Virement en votre faveur FRANCE TRAVAIL 26153501408 - 34 4T 7871126X 04062026 26153501408",
      type: "revenu",
      accountId: "acc-main",
      categoryId: "cat-income",
      subcategoryId: "sub-benefits",
      thirdPartyId: "third-france-travail",
    },
  ];

  const rows = buildImportValidationRows({
    preview: {
      transactions: [
        { id: "row-intermarche", sourceRowIndex: 1, operationDate: "2026-05-29", rawLabel: "Paiement par carte X2648 INTERMARCHE VENTABRE 28/05 - Intermarché", amount: -20, type: "depense", accountId: "acc-main", duplicateStatus: "new_transaction" },
        { id: "row-google", sourceRowIndex: 2, operationDate: "2026-05-29", rawLabel: "Paiement par carte X2648 GOOGLE*GOOGLE PLAY A 26/05 - Google", amount: -5, type: "depense", accountId: "acc-main", duplicateStatus: "new_transaction" },
        { id: "row-france-travail", sourceRowIndex: 3, operationDate: "2026-05-07", rawLabel: "Virement en votre faveur FRANCE TRAVAIL 26125501820 - 34 4T 7871126X 07052026 26125501820", amount: 1100, type: "revenu", accountId: "acc-main", duplicateStatus: "new_transaction" },
      ],
    },
    existingTransactions,
    categories: [
      { id: "cat-food", name: "Alimentation" },
      { id: "cat-digital", name: "Numerique" },
      { id: "cat-income", name: "Revenus" },
    ],
  });

  assert.equal(rows[0].classificationSuggestion.score, 95);
  assert.equal(rows[0].categoryId, "cat-food");
  assert.equal(rows[1].classificationSuggestion.score, 95);
  assert.equal(rows[1].thirdPartyId, "third-google");
  assert.equal(rows[2].classificationSuggestion.score, 95);
  assert.equal(rows[2].subcategoryId, "sub-benefits");
});

test("import suggestions respect unknown label, account and type filters", () => {
  const existingTransactions = [
    {
      id: "history-main",
      description: "Paiement par carte X2648 INTERMARCHE VENTABRE 10/06 - Intermarché",
      type: "depense",
      accountId: "acc-main",
      categoryId: "cat-food",
    },
  ];

  assert.equal(buildBankImportClassificationSuggestion(existingTransactions, {
    description: "Libelle totalement inconnu",
    type: "depense",
    accountId: "acc-main",
  }).suggestion, null);
  assert.equal(buildBankImportClassificationSuggestion(existingTransactions, {
    description: "Paiement par carte X2648 INTERMARCHE VENTABRE 28/05 - Intermarché",
    type: "depense",
    accountId: "acc-other",
  }).suggestion, null);
  assert.equal(buildBankImportClassificationSuggestion(existingTransactions, {
    description: "Paiement par carte X2648 INTERMARCHE VENTABRE 28/05 - Intermarché",
    type: "revenu",
    accountId: "acc-main",
  }).suggestion, null);
});

test("import suggestions follow the account selected for preview and recalculate on account change", () => {
  const existingTransactions = [
    {
      id: "history-main",
      description: "Paiement par carte X2648 INTERMARCHE VENTABRE 10/06 - Intermarché",
      type: "depense",
      accountId: "acc-main",
      categoryId: "cat-food",
    },
  ];
  const transaction = {
    id: "row-1",
    sourceRowIndex: 1,
    operationDate: "2026-05-29",
    rawLabel: "Paiement par carte X2648 INTERMARCHE VENTABRE 28/05 - Intermarché",
    amount: -20,
    type: "depense",
    duplicateStatus: "new_transaction",
  };

  const rowsForMainAccount = buildImportValidationRows({
    preview: { transactions: [{ ...transaction, accountId: "acc-main" }] },
    existingTransactions,
    categories: [{ id: "cat-food", name: "Alimentation" }],
  });
  const rowsForOtherAccount = buildImportValidationRows({
    preview: { transactions: [{ ...transaction, accountId: "acc-other" }] },
    existingTransactions,
    categories: [{ id: "cat-food", name: "Alimentation" }],
  });

  assert.equal(rowsForMainAccount[0].classificationSuggestionApplied, true);
  assert.equal(rowsForOtherAccount[0].classificationSuggestionApplied, false);
});

test("manual edits can override suggested fields without autosave", () => {
  const rows = buildImportValidationRows({
    preview: {
      transactions: [
        {
          id: "row-1",
          sourceRowIndex: 1,
          operationDate: "2026-05-29",
          rawLabel: "Paiement par carte X2648 INTERMARCHE VENTABRE 28/05 - Intermarché",
          amount: -20,
          type: "depense",
          accountId: "acc-main",
          duplicateStatus: "new_transaction",
        },
      ],
    },
    existingTransactions: [
      {
        id: "history-main",
        description: "Paiement par carte X2648 INTERMARCHE VENTABRE 10/06 - Intermarché",
        type: "depense",
        accountId: "acc-main",
        categoryId: "cat-food",
      },
    ],
    categories: [{ id: "cat-food", name: "Alimentation" }],
  });

  const editedRow = { ...rows[0], categoryId: "cat-manual", categoryName: "Manuelle" };
  assert.equal(rows[0].categoryId, "cat-food");
  assert.equal(editedRow.categoryId, "cat-manual");
  assert.equal(rows[0].userDecision, "import");
});

test("bank import validation rows preserve suggestion payload for preview and validation", () => {
  const rows = buildImportValidationRows({
    preview: {
      transactions: [
        {
          id: "row-1",
          sourceRowIndex: 1,
          operationDate: "2026-05-29",
          rawLabel: "Paiement par carte X2648 GOOGLE*GOOGLE PLAY A 26/05 - Google",
          amount: -5,
          type: "depense",
          accountId: "acc-main",
          duplicateStatus: "new_transaction",
        },
      ],
    },
    existingTransactions: [
      {
        id: "history-google",
        description: "Paiement par carte X2648 GOOGLE *Google Play 28/06 - Google",
        type: "depense",
        accountId: "acc-main",
        categoryId: "cat-digital",
      },
    ],
    categories: [{ id: "cat-digital", name: "Numerique" }],
  });

  assert.equal(rows[0].classificationSuggestionApplied, true);
  assert.equal(rows[0].classificationSuggestionIgnored, false);
  assert.equal(rows[0].classificationSuggestion.patch.categoryId, "cat-digital");
  assert.equal(rows[0].categoryName, "Numerique");
});

test("bank import suggestions do not create fixed expenses or transactions", () => {
  const rows = buildImportValidationRows({
    preview: {
      transactions: [
        {
          id: "row-1",
          sourceRowIndex: 1,
          operationDate: "2026-05-29",
          rawLabel: "Paiement par carte X2648 GOOGLE*GOOGLE PLAY A 26/05 - Google",
          amount: -5,
          type: "depense",
          accountId: "acc-main",
          duplicateStatus: "new_transaction",
        },
      ],
    },
    existingTransactions: [
      { id: "history-google", description: "Paiement par carte X2648 GOOGLE *Google Play 28/06 - Google", type: "depense", accountId: "acc-main", categoryId: "cat-digital" },
    ],
    categories: [{ id: "cat-digital", name: "Numerique" }],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].fixedExpenseId, undefined);
  assert.equal(rows[0].importId, undefined);
});

test("import suggestions score unique, concordant and contradictory histories", () => {
  const unique = buildBankImportClassificationSuggestion([
    { id: "history-1", description: "Paiement par carte X2648 GOOGLE *Google Play 28/06 - Google", type: "depense", accountId: "acc-main", categoryId: "cat-digital" },
  ], {
    description: "Paiement par carte X2648 GOOGLE*GOOGLE PLAY A 26/05 - Google",
    type: "depense",
    accountId: "acc-main",
  });
  assert.equal(unique.suggestion.score, 95);

  const concordant = buildBankImportClassificationSuggestion([
    { id: "history-1", description: "Paiement par carte X2648 GOOGLE *Google Play 28/06 - Google", type: "depense", accountId: "acc-main", categoryId: "cat-digital" },
    { id: "history-2", description: "Paiement par carte X2648 GOOGLE*GOOGLE PLAY A 12/06 - Google", type: "depense", accountId: "acc-main", categoryId: "cat-digital" },
  ], {
    description: "Paiement par carte X2648 GOOGLE*GOOGLE PLAY A 26/05 - Google",
    type: "depense",
    accountId: "acc-main",
  });
  assert.equal(concordant.suggestion.score, 100);

  const contradictory = buildBankImportClassificationSuggestion([
    { id: "history-1", description: "Paiement par carte X2648 GOOGLE *Google Play 28/06 - Google", type: "depense", accountId: "acc-main", categoryId: "cat-digital" },
    { id: "history-2", description: "Paiement par carte X2648 GOOGLE*GOOGLE PLAY A 12/06 - Google", type: "depense", accountId: "acc-main", categoryId: "cat-other" },
  ], {
    description: "Paiement par carte X2648 GOOGLE*GOOGLE PLAY A 26/05 - Google",
    type: "depense",
    accountId: "acc-main",
  });
  assert.equal(contradictory.suggestion, null);
  assert.equal(contradictory.trace.noSuggestionReason, "no_winning_field");
});
