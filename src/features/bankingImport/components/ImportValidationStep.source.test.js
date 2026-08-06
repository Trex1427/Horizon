import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const componentPath = resolve(process.cwd(), "src/features/bankingImport/components/ImportValidationStep.jsx");

test("ImportValidationStep exposes automatic classification suggestion indicator", async () => {
  const content = await readFile(componentPath, "utf8");

  assert.equal(content.includes("classificationSuggestionApplied"), true);
  assert.equal(content.includes("Suggestion automatique"), true);
  assert.equal(content.includes("getSuggestionBadgeLabel"), true);
  assert.equal(content.includes("classificationSuggestion?.score"), true);
});

test("ImportValidationStep reuses transaction quick-create sentinels for every import row reference", async () => {
  const content = await readFile(componentPath, "utf8");

  assert.equal(content.includes("CREATE_CATEGORY_VALUE"), true);
  assert.equal(content.includes("CREATE_SUBCATEGORY_VALUE"), true);
  assert.equal(content.includes("CREATE_THIRD_PARTY_VALUE"), true);
  assert.equal(content.includes("CREATE_ACTIVITY_VALUE"), true);
  assert.equal(content.includes("CREATE_PROJECT_VALUE"), true);
  assert.equal(content.includes("CREATE_ACCOUNT_VALUE"), true);
  assert.equal(content.includes("Créer cette catégorie"), true);
  assert.equal(content.includes("Créer cette sous-catégorie"), true);
  assert.equal(content.includes("Créer ce tiers"), true);
  assert.equal(content.includes("Créer cette activité"), true);
  assert.equal(content.includes("Créer ce projet"), true);
  assert.equal(content.includes("Créer ce compte"), true);
  assert.equal(content.includes('requestQuickCreate(row, "category")'), true);
  assert.equal(content.includes('requestQuickCreate(row, "subcategory")'), true);
  assert.equal(content.includes('requestQuickCreate(row, "thirdParty")'), true);
  assert.equal(content.includes('requestQuickCreate(row, "activity")'), true);
  assert.equal(content.includes('requestQuickCreate(row, "project")'), true);
  assert.equal(content.includes('requestQuickCreate(row, "account")'), true);
});

test("ImportValidationStep selects created entities without rebuilding the import list", async () => {
  const content = await readFile(componentPath, "utf8");

  assert.equal(content.includes("listRef"), true);
  assert.equal(content.includes("restoreListScroll(scrollPosition)"), true);
  assert.equal(content.includes("updateRowPreservingScroll"), true);
  assert.equal(content.includes("onCreated: buildOnCreated"), true);
  assert.equal(content.includes("categoryId: category.id || null"), true);
  assert.equal(content.includes("subcategoryId: subcategory.id || null"), true);
  assert.equal(content.includes("thirdPartyId: thirdParty.id || null"), true);
  assert.equal(content.includes("activityId: activity.id || null"), true);
  assert.equal(content.includes("projectId: project.id || null"), true);
  assert.equal(content.includes("accountId: account.id || row.accountId ||"), true);
});

test("ImportValidationStep displays and can ignore bank import classification suggestions", async () => {
  const content = await readFile(componentPath, "utf8");

  assert.equal(content.includes("buildSuggestionFieldLabels"), true);
  assert.equal(content.includes("classificationSuggestionApplied && !row.classificationSuggestionIgnored"), true);
  assert.equal(content.includes("ignoreClassificationSuggestion"), true);
  assert.equal(content.includes("classificationSuggestionIgnored: true"), true);
  assert.equal(content.includes("classificationSuggestionApplied: false"), true);
  assert.equal(content.includes("Ignorer"), true);
});
test("ImportValidationStep keeps the classification context after every reference creation", async () => {
  const content = await readFile(componentPath, "utf8");

  for (const kind of ["category", "subcategory", "thirdParty", "activity", "project"]) {
    assert.equal(content.includes(`requestQuickCreate(row, "${kind}")`), true);
  }
  assert.equal(content.includes("onCreated: buildOnCreated"), true);
  assert.equal(content.includes("rowRefs.current.get(row.sourceRowIndex)?.focus()"), true);
  assert.equal(content.includes("restoreListScroll(scrollPosition)"), true);
});

test("ImportValidationStep exposes the live similarity search assistant", async () => {
  const content = await readFile(componentPath, "utf8");

  assert.equal(content.includes("🔍 Rechercher des opérations similaires"), true);
  assert.equal(content.includes("openSimilarityAssistant(row, \"manual\")"), true);
  assert.equal(content.includes("Portée de la recherche"), true);
  assert.equal(content.includes("Cet import uniquement"), true);
  assert.equal(content.includes("Historique uniquement"), true);
  assert.equal(content.includes("Cet import + historique"), true);
  assert.equal(content.includes("value={similarityScope}"), true);
  assert.equal(content.includes("onChange={(event) => updateSimilarityScope(event.target.value)}"), true);
  assert.equal(content.includes("Résultats"), true);
  assert.equal(content.includes("Import : {importProposalMatches.length}"), true);
  assert.equal(content.includes("Historique : {historicalProposalMatches.length}"), true);
  assert.equal(content.includes("findSimilarUnvalidatedImportRows"), true);
  assert.equal(content.includes("proposalMatches.length} opérations trouvées"), true);
  assert.equal(content.includes("updateSimilarityCriteria"), true);
  assert.equal(content.includes("updateSimilaritySelection"), true);
  assert.equal(content.includes("Ignorer les différences de montant"), true);
  assert.equal(content.includes("Même compte uniquement"), true);
  assert.equal(content.includes("Même année uniquement"), true);
  assert.equal(content.includes("Tout sélectionner"), true);
  assert.equal(content.includes("Tout désélectionner"), true);
  assert.equal(content.includes("describeSimilarImportRowMatch"), true);
  assert.equal(content.includes("checked={checkedIdenticalRows.has(resultKey)}"), true);
  assert.equal(content.includes("focusFirstRemainingRow(nextRows)"), true);
  assert.equal(content.includes("rowRefs.current.get(sourceRowIndex)?.focus()"), true);
  assert.equal(content.includes("searchOwnedHistoricalTransactions"), true);
  assert.equal(content.includes("Import actuel"), true);
  assert.equal(content.includes("Historique"), true);
  assert.equal(content.includes("Créer un frais fixe"), true);
  assert.equal(content.includes("onRequestCreateFixedExpense"), true);
});