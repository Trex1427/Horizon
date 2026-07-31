export function normalizeVehicleNameKey(value) {
  return String(value || "").trim().toLocaleLowerCase("fr-FR");
}

export function sortVehicles(vehicles = []) {
  return [...vehicles].sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || ""), "fr", { sensitivity: "base" }));
}

export function findActiveVehicleDuplicate(vehicles = [], name = "", excludedId = "") {
  const key = normalizeVehicleNameKey(name);
  return vehicles.find((vehicle) => vehicle.id !== excludedId && vehicle.isDeleted !== true && normalizeVehicleNameKey(vehicle.name) === key) || null;
}

function normalizeName(value) {
  const name = String(value || "").trim();
  if (!name) throw new Error("Le nom du véhicule est obligatoire.");
  return name;
}

export function buildVehicleCreatePayload(payload = {}, { now = new Date() } = {}) {
  const timestamp = now.toISOString();
  return { name: normalizeName(payload.name), isDeleted: false, createdAt: timestamp, updatedAt: timestamp };
}

export function buildVehicleUpdatePayload(payload = {}, { now = new Date() } = {}) {
  return { name: normalizeName(payload.name), updatedAt: now.toISOString() };
}

export function calculateVehicleExpenses(vehicleId, transactions = []) {
  const expenses = (transactions || [])
    .filter((transaction) => transaction.vehicleId === vehicleId && transaction.type === "depense" && transaction.isDeleted !== true);
  const total = expenses.reduce((sum, transaction) => sum + Math.abs(Number(transaction.montant) || 0), 0);
  return { transactions: expenses, total: Math.round((total + Number.EPSILON) * 100) / 100 };
}
