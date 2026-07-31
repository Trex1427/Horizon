import test from "node:test";
import assert from "node:assert/strict";
import { buildVehicleCreatePayload, buildVehicleUpdatePayload, calculateVehicleExpenses } from "./vehicleModel.js";

test("vehicle payload contains only the V1 business fields", () => {
  const now = new Date("2026-08-01T10:00:00.000Z");
  assert.deepEqual(buildVehicleCreatePayload({ name: "  Kangoo  ", brand: "ignored" }, { now }), {
    name: "Kangoo", isDeleted: false, createdAt: now.toISOString(), updatedAt: now.toISOString(),
  });
  assert.deepEqual(buildVehicleUpdatePayload({ name: " Partner ", mileage: 12 }, { now }), {
    name: "Partner", updatedAt: now.toISOString(),
  });
  assert.throws(() => buildVehicleCreatePayload({ name: " " }), /obligatoire/);
});

test("vehicle expenses include only linked active expenses", () => {
  const result = calculateVehicleExpenses("v1", [
    { id: "a", vehicleId: "v1", type: "depense", montant: -50 },
    { id: "b", vehicleId: "v1", type: "depense", montant: 20.25 },
    { id: "c", vehicleId: "v1", type: "revenu", montant: 999 },
    { id: "d", vehicleId: "v2", type: "depense", montant: 80 },
    { id: "e", vehicleId: "v1", type: "depense", montant: 10, isDeleted: true },
  ]);
  assert.deepEqual(result.transactions.map((entry) => entry.id), ["a", "b"]);
  assert.equal(result.total, 70.25);
});
