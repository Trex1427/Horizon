import test from "node:test";
import assert from "node:assert/strict";
import {
  buildVoiceDraftForm,
  normalizeVoiceDraftContract,
  parseVoiceTransactionDraft,
} from "./voiceTransactionParser.js";
import { getSpeechRecognitionConstructor, isSpeechRecognitionAvailable, mapSpeechRecognitionError } from "./speechRecognitionService.js";

const categories = [
  { id: "cat-food", name: "Alimentation", type: "depense" },
  { id: "cat-transport", name: "Transport", type: "depense" },
  { id: "cat-salary", name: "Salaire", type: "revenu" },
  { id: "cat-work", name: "Remboursement professionnel", type: "income" },
];

const accounts = [
  { id: "acc-main", name: "Compte courant" },
  { id: "acc-pro", name: "Compte professionnel" },
];

test("voice parser handles expense with decimal amount and category", () => {
  const parsed = parseVoiceTransactionDraft(
    "J'ai depense 34 euros 50 chez Carrefour aujourd'hui en alimentation",
    { categories, accounts }
  );

  assert.equal(parsed.type, "depense");
  assert.equal(parsed.montant, 34.5);
  assert.equal(parsed.categoryId, "cat-food");
  assert.equal(parsed.categoryName, "Alimentation");
  assert.ok(parsed.date);
});

test("voice parser handles requested alimentation sentence", () => {
  const parsed = parseVoiceTransactionDraft("J'ai depense 35 euros en alimentation", {
    categories,
    accounts,
  });

  assert.equal(parsed.type, "depense");
  assert.equal(parsed.montant, 35);
  assert.equal(parsed.categoryId, "cat-food");
  assert.equal(parsed.categoryName, "Alimentation");
});

test("voice parser handles revenu and account matching", () => {
  const parsed = parseVoiceTransactionDraft(
    "Ajoute un revenu de 1 200 euros paiement client Dupont sur le compte professionnel",
    { categories, accounts }
  );

  assert.equal(parsed.type, "revenu");
  assert.equal(parsed.montant, 1200);
  assert.equal(parsed.accountId, "acc-pro");
  assert.equal(parsed.categoryId, null);
});

test("voice parser handles hier date", () => {
  const parsed = parseVoiceTransactionDraft("J'ai depense 20 euros hier", {
    categories,
    accounts,
  });

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const expected = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  assert.equal(parsed.date, expected);
});

test("voice parser leaves unknown category without id", () => {
  const parsed = parseVoiceTransactionDraft("Depense 15 euros en bricolage", {
    categories,
    accounts,
  });

  assert.equal(parsed.categoryId, null);
  assert.equal(parsed.categoryName, null);
});

test("voice parser maps courses alias to alimentation", () => {
  const parsed = parseVoiceTransactionDraft("J'ai depense 50 euros pour les courses", {
    categories,
    accounts,
  });

  assert.equal(parsed.categoryId, "cat-food");
  assert.equal(parsed.categoryName, "Alimentation");
});

test("voice parser maps carburant alias to transport", () => {
  const parsed = parseVoiceTransactionDraft("J'ai mis 70 euros de carburant", {
    categories,
    accounts,
  });

  assert.equal(parsed.categoryId, "cat-transport");
  assert.equal(parsed.categoryName, "Transport");
});

test("voice parser recognizes salaire category for income", () => {
  const parsed = parseVoiceTransactionDraft("J'ai recu 2 000 euros de salaire", {
    categories,
    accounts,
  });

  assert.equal(parsed.type, "revenu");
  assert.equal(parsed.categoryId, "cat-salary");
  assert.equal(parsed.categoryName, "Salaire");
});

test("voice parser does not preselect category when type does not match", () => {
  const parsed = parseVoiceTransactionDraft("J'ai recu 120 euros de carburant", {
    categories,
    accounts,
  });

  assert.equal(parsed.type, "revenu");
  assert.equal(parsed.categoryId, null);
  assert.equal(parsed.categoryName, null);
});

test("voice parser does not preselect category when match is ambiguous", () => {
  const ambiguousCategories = [
    ...categories,
    { id: "cat-food-2", name: "Courses maison", type: "depense" },
  ];

  const parsed = parseVoiceTransactionDraft("J'ai depense 45 euros en courses", {
    categories: ambiguousCategories,
    accounts,
  });

  assert.equal(parsed.categoryId, null);
  assert.equal(parsed.categoryName, null);
});

test("voice parser leaves account empty when not explicit", () => {
  const parsed = parseVoiceTransactionDraft("Depense 18 euros chez boulangerie", {
    categories,
    accounts,
  });

  assert.equal(parsed.accountId, null);
});

test("voice parser handles french format 35 euros 50", () => {
  const parsed = parseVoiceTransactionDraft("J'ai depense 35 euros 50 chez Carrefour", {
    categories,
    accounts,
  });

  assert.equal(parsed.montant, 35.5);
});

test("voice parser handles euro symbol with spaces", () => {
  const parsed = parseVoiceTransactionDraft("40 € de nourriture a Intermarche", {
    categories,
    accounts,
  });

  assert.equal(parsed.montant, 40);
});

test("voice parser handles compact euro symbol", () => {
  const parsed = parseVoiceTransactionDraft("40€ chez Intermarche", {
    categories,
    accounts,
  });

  assert.equal(parsed.montant, 40);
});

test("voice parser handles decimal euro symbol", () => {
  const parsed = parseVoiceTransactionDraft("40,50 € chez Intermarche", {
    categories,
    accounts,
  });

  assert.equal(parsed.montant, 40.5);
});

test("voice parser handles grouped thousands with euro symbol", () => {
  const parsed = parseVoiceTransactionDraft("J'ai recu 1 200 € de salaire", {
    categories,
    accounts,
  });

  assert.equal(parsed.montant, 1200);
});

test("voice parser handles unicode non-breaking space before euro symbol", () => {
  const parsed = parseVoiceTransactionDraft("40\u00A0€ de nourriture", {
    categories,
    accounts,
  });

  assert.equal(parsed.montant, 40);
});

test("voice parser handles french format 35,50 euros", () => {
  const parsed = parseVoiceTransactionDraft("J'ai depense 35,50 euros chez Carrefour", {
    categories,
    accounts,
  });

  assert.equal(parsed.montant, 35.5);
});

test("voice parser handles french format 35.50 euros", () => {
  const parsed = parseVoiceTransactionDraft("J'ai depense 35.50 euros chez Carrefour", {
    categories,
    accounts,
  });

  assert.equal(parsed.montant, 35.5);
});

test("voice parser handles 9 euros et 99 centimes", () => {
  const parsed = parseVoiceTransactionDraft("J'ai paye 9 euros et 99 centimes", {
    categories,
    accounts,
  });

  assert.equal(parsed.montant, 9.99);
});

test("voice parser returns null amount when sentence has no amount", () => {
  const parsed = parseVoiceTransactionDraft("J'ai depense en alimentation", {
    categories,
    accounts,
  });

  assert.equal(parsed.montant, null);
});

test("voice parser does not treat date as amount when no euro keyword", () => {
  const parsed = parseVoiceTransactionDraft("Transaction du 12/07/2026 a Carrefour", {
    categories,
    accounts,
  });

  assert.equal(parsed.montant, null);
});

test("voice parser handles grouped decimal thousands with euro symbol", () => {
  const parsed = parseVoiceTransactionDraft("1 200,50 € de salaire", {
    categories,
    accounts,
  });

  assert.equal(parsed.montant, 1200.5);
});

test("normalizeVoiceDraftContract maps amount to montant", () => {
  const normalized = normalizeVoiceDraftContract({ amount: 35.5, type: "depense" });

  assert.equal(normalized.montant, 35.5);
});

test("buildVoiceDraftForm keeps montant up to form payload", () => {
  const formDraft = buildVoiceDraftForm(
    { amount: 35.5, type: "depense", description: "Carrefour" },
    { montant: "", type: "depense" }
  );

  assert.equal(formDraft.montant, "35.5");
  assert.equal(formDraft.description, "Carrefour");
});

test("buildVoiceDraftForm keeps montant from euro symbol sentence", () => {
  const parsed = parseVoiceTransactionDraft("40 € de nourriture a Intermarche", {
    categories,
    accounts,
  });

  const formDraft = buildVoiceDraftForm(
    { ...parsed, amount: parsed.montant },
    { montant: "", type: "depense" }
  );

  assert.equal(formDraft.montant, "40");
});

test("speech recognition availability detection", () => {
  const fakeWindow = { webkitSpeechRecognition: function WebkitSpeech() {} };
  assert.equal(Boolean(getSpeechRecognitionConstructor(fakeWindow)), true);
  assert.equal(isSpeechRecognitionAvailable(fakeWindow), true);
  assert.equal(isSpeechRecognitionAvailable({}), false);
});

test("speech recognition error mapping", () => {
  assert.equal(mapSpeechRecognitionError("not-allowed"), "Permission microphone refusee");
  assert.equal(mapSpeechRecognitionError("audio-capture"), "Microphone indisponible");
  assert.equal(mapSpeechRecognitionError("unknown"), "Erreur de reconnaissance vocale");
});
