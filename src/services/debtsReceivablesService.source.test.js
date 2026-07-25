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
test("service authenticates creates, validates third-party ownership/activity, and soft-deletes", async () => {
  const source = await readFile(servicePath, "utf8");
  assert.match(source, /withOwnerUidForCreate/);
  assert.match(source, /snapshot\.data\(\)\.ownerUid !== ownerUid/);
  assert.match(source, /THIRD_PARTIES_COLLECTION/);
  assert.match(source, /requireOwnedActiveThirdParty\(normalized\.thirdPartyId\)/);
  assert.match(source, /thirdParty\.ownerUid !== ownerUid/);
  assert.match(source, /thirdParty\.isActive === false/);
  assert.match(source, /Tiers introuvable\./);
  assert.match(source, /n'appartient pas à l'utilisateur connecté/);
  assert.match(source, /est inactif\./);
  assert.match(source, /Le tiers est obligatoire\./);
  assert.match(source, /counterparty: deleteField\(\)/);
  assert.match(source, /isDeleted: true/);
  assert.equal(source.includes("deleteDoc"), false);
});
