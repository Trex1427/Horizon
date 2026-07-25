import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const servicePath = resolve(process.cwd(), "src/services/debtsReceivablesService.js");
test("service filters reads by ownerUid and active tombstones", async () => {
  const source = await readFile(servicePath, "utf8");
  assert.match(source, /where\("ownerUid", "==", ownerUid\)/);
  assert.match(source, /where\("isDeleted", "==", false\)/);
  assert.match(source, /\.filter\(\(item\) => item\.isDeleted !== true\)/);
});
test("service authenticates creates and verifies ownership before update and soft delete", async () => {
  const source = await readFile(servicePath, "utf8");
  assert.match(source, /withOwnerUidForCreate/);
  assert.match(source, /snapshot\.data\(\)\.ownerUid !== ownerUid/);
  assert.match(source, /isDeleted: true/);
  assert.equal(source.includes("deleteDoc"), false);
});
