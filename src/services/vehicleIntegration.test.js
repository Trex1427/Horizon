import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildTransactionPayload } from "../utils/transactionDraftMapper.js";
import { normalizeTransactionRecord } from "../utils/transactionTypeUtils.js";
import { validateTransactionReferencesForSave } from "../utils/transactionReferencesValidation.js";

test("transaction payload persists an optional vehicleId and clears it explicitly", () => {
  assert.equal(buildTransactionPayload({ vehicleId: " vehicle-1 ", type: "depense" }).vehicleId, "vehicle-1");
  assert.equal(buildTransactionPayload({ vehicleId: "", type: "depense" }).vehicleId, null);
  assert.equal(normalizeTransactionRecord({ type: "depense" }).vehicleId, null);
});

test("vehicle reference validation accepts active vehicles and rejects unknown ones", () => {
  const catalogs = { vehicleMap: new Map([["v1", { id: "v1", name: "Kangoo", isDeleted: false }]]) };
  assert.equal(validateTransactionReferencesForSave({ vehicleId: "v1" }, catalogs), "");
  assert.match(validateTransactionReferencesForSave({ vehicleId: "missing" }, catalogs), /inexistant/);
});

test("vehicle service and rules enforce owner scope and soft delete", async () => {
  const [service, rules] = await Promise.all([
    readFile(resolve(process.cwd(), "src/services/vehicleService.js"), "utf8"),
    readFile(resolve(process.cwd(), "firestore.rules"), "utf8"),
  ]);
  assert.match(service, /where\("ownerUid", "==", ownerUid\)/);
  assert.match(service, /isDeleted: true/);
  assert.match(rules, /match \/vehicles\/\{documentId\}/);
  assert.match(rules, /hasValidVehicleLink/);
  assert.match(rules, /allow delete: if false/);
});
