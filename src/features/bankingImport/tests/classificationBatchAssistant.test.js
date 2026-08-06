import test from "node:test";
import assert from "node:assert/strict";
import {
  applyClassificationToImportRows,
  describeSimilarImportRowMatch,
  findFirstUnvalidatedImportRow,
  findIdenticalUnvalidatedImportRows,
  findSimilarUnvalidatedImportRows,
  normalizeComparableImportLabel,
} from "../utils/classificationBatchAssistant.js";

const classification = {
  categoryId: "cat-1", categoryName: "Achats",
  subcategoryId: "sub-1", subcategoryName: "Internet",
  thirdPartyId: "third-1", thirdPartyName: "Amazon",
  activityId: "activity-1", activityName: "Personnel",
  projectId: "project-1", projectName: "Maison",
};
const row = (sourceRowIndex, rawLabel, amount, extra = {}) => ({ sourceRowIndex, rawLabel, amount, userDecision: "import", ...extra });

test("normalization ignores card number, date, whitespace, line breaks and case", () => {
  assert.equal(normalizeComparableImportLabel("CARTE X2648  AMAZON   EU SARL 31/07"), "AMAZON EU SARL");
  assert.equal(normalizeComparableImportLabel("paiement par carte\nX1234 Amazon EU Sarl 31-07-2026"), "AMAZON EU SARL");
});

test("identical detection stays inside unvalidated rows with same normalized label and amount", () => {
  const source = row(1, "CARTE X2648 AMAZON EU SARL 31/07", -45.47, classification);
  const rows = [source, row(2, "Amazon EU SARL", -45.47), row(3, "CARTE X9999 AMAZON EU SARL 01/08", -40), row(4, "Amazon EU SARL", -45.47, { classificationValidated: true })];
  assert.deepEqual(findIdenticalUnvalidatedImportRows(rows, source).map((item) => item.sourceRowIndex), [2]);
});

test("same merchant with different amounts is proposed only when amount differences are ignored", () => {
  const source = row(1, "CARTE X2648 KEEP COOL 05/02", -29.99, classification);
  const rows = [source, row(2, "Keep Cool 05/03", -29.99), row(3, "PAIEMENT PAR CARTE X9999 KEEP COOL 05/04", -34.99)];
  assert.deepEqual(findSimilarUnvalidatedImportRows(rows, source).map((item) => item.sourceRowIndex), [2]);
  assert.deepEqual(findSimilarUnvalidatedImportRows(rows, source, { ignoreAmountDifferences: true }).map((item) => item.sourceRowIndex), [2, 3]);
});

test("different merchants are never proposed even when amount differences are ignored", () => {
  const source = row(1, "KEEP COOL", -29.99, classification);
  assert.deepEqual(findSimilarUnvalidatedImportRows([source, row(2, "AMAZON", -29.99)], source, { ignoreAmountDifferences: true }), []);
});
test("classification can be applied to every identical operation", () => {
  const source = row(1, "Amazon", -10, classification);
  const result = applyClassificationToImportRows([source, row(2, "Amazon", -10), row(3, "Amazon", -10)], source, [2, 3]);
  assert.equal(result.every((item) => item.categoryId === "cat-1" && item.projectId === "project-1" && item.classificationValidated), true);
});

test("classification can be applied to only checked operations", () => {
  const source = row(1, "Amazon", -10, classification);
  const untouched = row(3, "Amazon", -10, { categoryId: "old" });
  const result = applyClassificationToImportRows([source, row(2, "Amazon", -10), untouched], source, [2]);
  assert.equal(result[1].thirdPartyId, "third-1");
  assert.deepEqual(result[2], untouched);
});

test("no identical operation returns an empty proposal and advances to first remaining row", () => {
  const source = row(1, "Amazon", -10, classification);
  const other = row(2, "Supermarche", -10);
  assert.deepEqual(findIdenticalUnvalidatedImportRows([source, other], source), []);
  const result = applyClassificationToImportRows([source, other], source, []);
  assert.equal(findFirstUnvalidatedImportRow(result).sourceRowIndex, 2);
});
test("same account criterion filters the current batch", () => {
  const source = row(1, "KEEP COOL", -29.99, { ...classification, accountId: "account-1" });
  const rows = [source, row(2, "KEEP COOL", -29.99, { accountId: "account-1" }), row(3, "KEEP COOL", -29.99, { accountId: "account-2" })];
  assert.deepEqual(findSimilarUnvalidatedImportRows(rows, source, { sameAccountOnly: true }).map((item) => item.sourceRowIndex), [2]);
});

test("same year criterion supports imported operation dates", () => {
  const source = row(1, "KEEP COOL", -29.99, { ...classification, operationDate: "2026-01-05" });
  const rows = [source, row(2, "KEEP COOL", -29.99, { operationDate: "2026-05-05" }), row(3, "KEEP COOL", -29.99, { operationDate: "2025-05-05" })];
  assert.deepEqual(findSimilarUnvalidatedImportRows(rows, source, { sameYearOnly: true }).map((item) => item.sourceRowIndex), [2]);
});

test("account, year and amount criteria can be combined", () => {
  const source = row(1, "CARTE X2648 KEEP COOL 05/01", -29.99, { ...classification, accountId: "account-1", operationDate: "2026-01-05" });
  const rows = [
    source,
    row(2, "KEEP COOL 05/02", -34.99, { accountId: "account-1", operationDate: "2026-02-05" }),
    row(3, "KEEP COOL 05/03", -34.99, { accountId: "account-2", operationDate: "2026-03-05" }),
    row(4, "KEEP COOL 05/04", -34.99, { accountId: "account-1", operationDate: "2025-04-05" }),
  ];
  const matches = findSimilarUnvalidatedImportRows(rows, source, {
    ignoreAmountDifferences: true,
    sameAccountOnly: true,
    sameYearOnly: true,
  });
  assert.deepEqual(matches.map((item) => item.sourceRowIndex), [2]);
});

test("match reason explains amount, account and year transparently", () => {
  const source = row(1, "KEEP COOL", -29.99, { accountId: "account-1", operationDate: "2026-01-05" });
  const exact = row(2, "KEEP COOL", -29.99, { accountId: "account-1", operationDate: "2026-02-05" });
  const differentAmount = row(3, "KEEP COOL", -34.99, { accountId: "account-2", operationDate: "2025-02-05" });
  assert.equal(describeSimilarImportRowMatch(source, exact), "Même commerçant + même montant + même compte + même année");
  assert.equal(describeSimilarImportRowMatch(source, differentAmount), "Même commerçant + montant différent");
});