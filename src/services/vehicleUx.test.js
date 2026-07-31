import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { findActiveVehicleDuplicate, sortVehicles } from "./vehicleModel.js";
import { buildTransactionPayload } from "../utils/transactionDraftMapper.js";
import { validateTransactionReferencesForSave } from "../utils/transactionReferencesValidation.js";

test("vehicles are sorted alphabetically in French without mutating the source", () => {
  const source = [{ name: "zèbre" }, { name: "Alpha" }, { name: "éclair" }, { name: "beta" }];
  assert.deepEqual(sortVehicles(source).map((vehicle) => vehicle.name), ["Alpha", "beta", "éclair", "zèbre"]);
  assert.equal(source[0].name, "zèbre");
});

test("active duplicate detection ignores case and surrounding spaces", () => {
  const vehicles = [{ id: "v1", name: "Kangoo", isDeleted: false }, { id: "v2", name: "Kangoo", isDeleted: true }];
  assert.equal(findActiveVehicleDuplicate(vehicles, "  kANGOO ")?.id, "v1");
  assert.equal(findActiveVehicleDuplicate(vehicles, "Kangoo", "v1"), null);
  assert.equal(findActiveVehicleDuplicate([{ id: "v2", name: "Kangoo", isDeleted: true }], "kangoo"), null);
});

test("an archived vehicle can be preserved, replaced or cleared during edit", () => {
  const archived = { id: "v1", name: "Kangoo", isDeleted: true };
  const catalogs = { vehicleMap: new Map([["v1", archived]]), allowDeletedVehicleId: "v1" };
  assert.equal(validateTransactionReferencesForSave({ vehicleId: "v1" }, catalogs), "");
  assert.equal(buildTransactionPayload({ type: "depense", vehicleId: "v1" }).vehicleId, "v1");
  assert.equal(buildTransactionPayload({ type: "depense", vehicleId: "" }).vehicleId, null);
});

test("quick-create UX keeps the transaction draft and auto-selects the created vehicle", async () => {
  const [transactions, fields, dialog, vehiclesPage, service] = await Promise.all([
    readFile(resolve(process.cwd(), "src/pages/Transactions.jsx"), "utf8"),
    readFile(resolve(process.cwd(), "src/components/TransactionFormFields.jsx"), "utf8"),
    readFile(resolve(process.cwd(), "src/components/VehicleFormDialog.jsx"), "utf8"),
    readFile(resolve(process.cwd(), "src/pages/Vehicles.jsx"), "utf8"),
    readFile(resolve(process.cwd(), "src/services/vehicleService.js"), "utf8"),
  ]);
  assert.match(fields, /\+ Ajouter un véhicule/);
  assert.match(transactions, /setForm\(\(previous\) => \(\{ \.\.\.previous, vehicleId: result\.value\.id \}\)\)/);
  assert.match(transactions, /includeDeleted: true/);
  assert.match(dialog, /<form[^>]*onSubmit=\{submit\}/);
  assert.match(dialog, /disabled=\{!normalizedName \|\| saving\}/);
  assert.match(vehiclesPage, /Ajouter un véhicule/);
  assert.match(service, /assertUniqueActiveName/);
  assert.match(service, /isDeleted: true/);
});

test("quick vehicle creation is available for a Transport expense draft and preserves every field", async () => {
  const [draftDialog, transactions, vehiclesHook] = await Promise.all([
    readFile(resolve(process.cwd(), "src/components/TransactionDraftReviewDialog.jsx"), "utf8"),
    readFile(resolve(process.cwd(), "src/pages/Transactions.jsx"), "utf8"),
    readFile(resolve(process.cwd(), "src/hooks/useVehicles.js"), "utf8"),
  ]);

  assert.match(draftDialog, /form\?\.type === "depense"/);
  assert.match(draftDialog, /name="vehicleId"/);
  assert.match(draftDialog, /<MenuItem value="">Aucun<\/MenuItem>/);
  assert.match(draftDialog, /CREATE_VEHICLE_VALUE}>\+ Ajouter un véhicule/);
  assert.match(draftDialog, /<VehicleFormDialog/);
  assert.match(draftDialog, /onCreateVehicle\?\.\(\{ name \}\)/);
  assert.match(draftDialog, /setForm\(\(previous\) => \(\{ \.\.\.previous, vehicleId: createdVehicle\.id \}\)\)/);
  assert.doesNotMatch(draftDialog, /categorie[^\n]*Transport|Transport[^\n]*categorie/);
  assert.match(transactions, /vehicles=\{activeVehicles\}/);
  assert.match(transactions, /onCreateVehicle=\{addVehicle\}/);
  assert.match(vehiclesHook, /run\(\(\) => createVehicle\(payload\)\)/);

  const transportDraft = {
    type: "depense",
    categorie: "Transport",
    categoryId: "category-transport",
    montant: "87.40",
    description: "Péage",
    accountId: "account-1",
    activityId: "activity-1",
    projectId: "project-1",
    workProjectId: "work-project-1",
    thirdPartyId: "third-party-1",
    subcategoryId: "subcategory-1",
    vehicleId: "vehicle-new",
  };
  const payload = buildTransactionPayload(transportDraft);

  assert.equal(payload.vehicleId, "vehicle-new");
  assert.equal(payload.categorie, "Transport");
  assert.equal(payload.montant, 87.4);
  assert.equal(payload.description, "Péage");
  assert.equal(payload.accountId, "account-1");
  assert.equal(payload.activityId, "activity-1");
  assert.equal(payload.projectId, "project-1");
  assert.equal(payload.workProjectId, "work-project-1");
  assert.equal(payload.thirdPartyId, "third-party-1");
  assert.equal(payload.subcategoryId, "subcategory-1");
});
test("every vehicle create sentinel consumer imports the shared constant", async () => {
  const consumerPaths = [
    "src/components/TransactionFormFields.jsx",
    "src/components/TransactionDraftReviewDialog.jsx",
    "src/pages/Transactions.jsx",
  ];
  const [constantSource, ...consumers] = await Promise.all([
    readFile(resolve(process.cwd(), "src/constants/transactionVehicleReference.js"), "utf8"),
    ...consumerPaths.map((path) => readFile(resolve(process.cwd(), path), "utf8")),
  ]);

  assert.match(constantSource, /export const CREATE_VEHICLE_VALUE = "__create_vehicle__"/);
  consumers.forEach((source, index) => {
    assert.match(source, /import \{ CREATE_VEHICLE_VALUE \} from ["'][^"']*transactionVehicleReference\.js["'];/,
      `${consumerPaths[index]} must import the shared vehicle sentinel`);
    assert.ok(source.match(/CREATE_VEHICLE_VALUE/g)?.length >= 2,
      `${consumerPaths[index]} must use the imported vehicle sentinel`);
  });
});