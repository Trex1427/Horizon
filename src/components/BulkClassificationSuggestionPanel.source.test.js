import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const suggestionPanelPath = resolve(process.cwd(), "src/components/BulkClassificationSuggestionPanel.jsx");

test("BulkClassificationSuggestionPanel exposes the mock intelligent-classification UX copy", async () => {
  const content = await readFile(suggestionPanelPath, "utf8");

  assert.equal(content.includes("Suggestion"), true);
  assert.equal(content.includes("Catégorie suggérée :"), true);
  assert.equal(content.includes("Accepter la suggestion"), true);
  assert.equal(content.includes("Choisir une autre catégorie"), true);
  assert.equal(content.includes("Suggestion appliquée"), true);
  assert.equal(content.includes("suggestion.sourceLabel"), true);
  assert.equal(content.includes("suggestion.categoryName"), true);
});