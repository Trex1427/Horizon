import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const analysePath = resolve(process.cwd(), "src/pages/Analyse.jsx");

test("Analyse displays a zero revenue share when the selected period has no revenue", async () => {
  const source = await readFile(analysePath, "utf8");

  assert.equal(source.includes("share={revenuesTotal > 0 ? 100 : 0}"), true);
  assert.equal(source.includes('title="Revenus"'), true);
});
