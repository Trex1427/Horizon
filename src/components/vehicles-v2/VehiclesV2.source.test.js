import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
const component = resolve(
    process.cwd(),
    "src/components/vehicles-v2/VehiclesV2.jsx",
  ),
  cssPath = resolve(process.cwd(), "src/components/vehicles-v2/VehiclesV2.css");
test("VehiclesV2 consumes the existing hook and form only", async () => {
  const source = await readFile(component, "utf8");
  assert.match(source, /useVehicles/);
  assert.match(source, /VehicleFormDialog/);
  for (const mutation of ["addVehicle", "editVehicle", "removeVehicle"])
    assert.match(source, new RegExp(mutation));
  assert.doesNotMatch(
    source,
    /firebase|firestore|collection\(|setDoc|addDoc|vehicleService/,
  );
});
test("VehiclesV2 exposes the requested honest responsive states", async () => {
  const [source, css] = await Promise.all([
    readFile(component, "utf8"),
    readFile(cssPath, "utf8"),
  ]);
  for (const label of [
    "Organisation",
    "Véhicules",
    "Nombre de véhicules",
    "Kilométrage total",
    "Entretiens à prévoir",
    "Coût annuel",
    "À venir",
    "Parc automobile",
    "Aucun entretien programmé.",
    "Aucun véhicule.",
  ])
    assert.match(source, new RegExp(label));
  assert.match(source, /vehicle\.brand\s*&&/);
  assert.match(source, /vehicle\.status/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(css, /overflow-x:\s*(auto|scroll)/);
});
