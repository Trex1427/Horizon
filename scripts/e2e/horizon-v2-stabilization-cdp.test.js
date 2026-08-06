import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("./horizon-v2-stabilization-cdp.mjs", import.meta.url), "utf8");

test("V2 stabilization campaign covers the declared non-destructive matrix", () => {
  assert.match(source, /export const VIEWPORTS = \[390, 768, 1024, 1440\]/);
  assert.equal((source.match(/\["[^"]+","[^"]+","[^"]+"\]/g) || []).length, 16);
  assert.doesNotMatch(source, /firebase|firestore|addDoc|setDoc|updateDoc|deleteDoc/i);
  for (const check of ["overflow", "clipped", "unnamed", "undersized", "Runtime.exceptionThrown", "Input.dispatchKeyEvent", "Escape", "Page.captureScreenshot"]) {
    assert.ok(source.includes(check), check);
  }
});
