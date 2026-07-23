import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const categoryCardPath = resolve(process.cwd(), "src/components/CategoryCard.jsx");

test("CategoryCard component does not render technical icon fields as text chips", async () => {
  const content = await readFile(categoryCardPath, "utf8");

  assert.equal(content.includes("label={iconLabel}"), false);
  assert.equal(content.includes("getSafeIconLabel"), false);
  assert.equal(content.includes("category.icon"), false);
});

test("CategoryCard keeps French type labels available", async () => {
  const content = await readFile(categoryCardPath, "utf8");

  assert.equal(content.includes('"Dépense"'), true);
  assert.equal(content.includes('"Revenu"'), true);
});
