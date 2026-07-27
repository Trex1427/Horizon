import test from "node:test";
import assert from "node:assert/strict";
import {
  matchThirdParties, normalizeProfessionalActivity, normalizeProfessionalActivityForCreate,
  normalizeQuote, normalizeQuoteExtraction, normalizeQuoteForCreate, validatePdfFile,
} from "./workModels.js";

const now = new Date("2026-07-27T00:00:00Z");

test("professional activity creation, update and activation validation", () => {
  const created = normalizeProfessionalActivityForCreate({ name: "Auto-entreprise", urssafRate: 24.6 }, { now });
  assert.equal(created.name, "Auto-entreprise");
  assert.equal(created.urssafRate, 24.6);
  assert.equal(created.isActive, true);
  assert.equal(created.createdAt, now);
  assert.equal(normalizeProfessionalActivity({ name: "Pet-sitting", urssafRate: 0, isActive: false }, { now }).isActive, false);
  assert.throws(() => normalizeProfessionalActivity({ name: " ", urssafRate: 1 }), /obligatoire/);
  assert.throws(() => normalizeProfessionalActivity({ name: "Test", urssafRate: -1 }), /supérieur/);
});

test("manual and imported quote payloads accept zero and optional number", () => {
  const manual = normalizeQuoteForCreate({ professionalActivityId: "a1", thirdPartyId: "t1", issueDate: "2026-07-27", amount: 0, status: "pending", source: "manual" }, { now });
  assert.equal(manual.quoteNumber, "");
  assert.equal(manual.amount, 0);
  assert.equal(manual.createdAt, now);
  assert.equal(normalizeQuote({ ...manual, status: "accepted" }, { now }).status, "accepted");
  assert.equal(normalizeQuote({ ...manual, source: "tiiime_pdf", documentId: "d1" }, { now }).source, "tiiime_pdf");
});

test("quote validation rejects invalid status, amount, tier and activity", () => {
  const base = { professionalActivityId: "a", thirdPartyId: "t", issueDate: "2026-07-27", amount: 1, source: "manual" };
  assert.throws(() => normalizeQuote({ ...base, status: "unknown" }), /Statut/);
  assert.throws(() => normalizeQuote({ ...base, amount: -1 }), /montant/);
  assert.throws(() => normalizeQuote({ ...base, amount: "abc" }), /montant/);
  assert.throws(() => normalizeQuote({ ...base, thirdPartyId: "" }), /tiers/);
  assert.throws(() => normalizeQuote({ ...base, professionalActivityId: "" }), /activité/);
  assert.throws(() => normalizeQuote({ ...base, source: "tiiime_pdf" }), /PDF/);
});

test("PDF metadata validation rejects wrong mime and excessive size", () => {
  assert.equal(validatePdfFile({ type: "application/pdf", size: 10, name: "d.pdf" }).name, "d.pdf");
  assert.throws(() => validatePdfFile({ type: "image/png", size: 10 }), /PDF/);
  assert.throws(() => validatePdfFile({ type: "application/pdf", size: 11 }, 10), /taille/);
});

test("third-party matching is explicit for found, multiple and none", () => {
  const tiers = [{ id: "1", name: "SARL Dupont" }, { id: "2", name: "Dupont Services" }, { id: "3", name: "Martin" }];
  assert.equal(matchThirdParties("Martin", tiers).state, "found");
  assert.equal(matchThirdParties("Dupont", tiers).state, "multiple");
  assert.equal(matchThirdParties("Inconnu", tiers).state, "none");
});

test("server extraction normalization handles fields and invalid responses", () => {
  assert.deepEqual(normalizeQuoteExtraction({ quoteNumber: null, issueDate: "bad", amount: null, customerName: "" }),
    { quoteNumber: "", issueDate: "", amount: "", customerName: "" });
  assert.throws(() => normalizeQuoteExtraction(null), /serveur/);
});
