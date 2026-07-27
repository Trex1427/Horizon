export const WORK_PROJECT_STATUSES = Object.freeze([
  "planned",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
]);

export const WORK_PROJECT_STATUS_LABELS = Object.freeze({
  planned: "À planifier",
  in_progress: "En cours",
  on_hold: "En attente",
  completed: "Terminé",
  cancelled: "Annulé",
});

const STATUS_ORDER = new Map(WORK_PROJECT_STATUSES.map((status, index) => [status, index]));
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
function normalizeMoney(value) {
  if (value === "" || value === null || value === undefined) throw new Error("Les dépenses prévisionnelles sont obligatoires.");
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error("Les dépenses prévisionnelles doivent être un nombre.");
  if (amount < 0) throw new Error("Les dépenses prévisionnelles ne peuvent pas être négatives.");
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
function normalizeOptionalDate(value, label) {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (!DATE_PATTERN.test(normalized)) throw new Error(`${label} est invalide.`);
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error(`${label} est invalide.`);
  return normalized;
}
export function calculatePlannedMargin(plannedRevenue, plannedExpenses) {
  const revenue = Number(plannedRevenue);
  if (!Number.isFinite(revenue)) throw new Error("La recette prévisionnelle est invalide.");
  return Math.round((revenue - normalizeMoney(plannedExpenses) + Number.EPSILON) * 100) / 100;
}
export function normalizeWorkProjectUpdate(project, payload = {}) {
  const name = String(payload.name || "").trim();
  if (!name) throw new Error("Le nom du dossier est obligatoire.");
  const status = String(payload.status || "");
  if (!WORK_PROJECT_STATUSES.includes(status)) throw new Error("Le statut du dossier est invalide.");
  const plannedExpenses = normalizeMoney(payload.plannedExpenses);
  const startDate = normalizeOptionalDate(payload.startDate, "La date de début");
  const endDate = normalizeOptionalDate(payload.endDate, "La date de fin");
  if (startDate && endDate && endDate < startDate) throw new Error("La date de fin ne peut pas être antérieure à la date de début.");
  return { name, status, plannedExpenses, plannedMargin: calculatePlannedMargin(project?.plannedRevenue, plannedExpenses), startDate, endDate, description: String(payload.description || "").trim(), notes: String(payload.notes || "").trim() };
}

function timestampValue(value) {
  if (typeof value?.toMillis === "function") return value.toMillis();
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildWorkProjectName(quote, thirdPartyName = "") {
  const customer = String(thirdPartyName || "").trim();
  const number = String(quote?.quoteNumber || "").trim();
  if (customer && number) return `${customer} — Devis ${number}`;
  if (customer) return customer;
  if (number) return `Dossier — Devis ${number}`;
  return "Nouveau dossier";
}

export function buildWorkProjectPayload(quote, { ownerUid, thirdPartyName = "", now = new Date() } = {}) {
  if (!ownerUid) throw new Error("Utilisateur non authentifié.");
  if (!quote?.id || !quote.professionalActivityId || !quote.thirdPartyId) {
    throw new Error("Le devis ne contient pas toutes les informations requises.");
  }
  if (quote.status !== "accepted") throw new Error("Seul un devis accepté peut créer un dossier.");
  const plannedRevenue = Number(quote.amount);
  if (!Number.isFinite(plannedRevenue) || plannedRevenue < 0) throw new Error("Le montant du devis est invalide.");
  return {
    ownerUid,
    quoteId: quote.id,
    professionalActivityId: quote.professionalActivityId,
    thirdPartyId: quote.thirdPartyId,
    name: buildWorkProjectName(quote, thirdPartyName),
    status: "planned",
    plannedRevenue,
    plannedExpenses: 0,
    plannedMargin: plannedRevenue,
    startDate: null,
    endDate: null,
    description: "",
    notes: "",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export function sortWorkProjects(projects = []) {
  return [...projects].sort((left, right) => {
    const statusDifference = (STATUS_ORDER.get(left.status) ?? 99) - (STATUS_ORDER.get(right.status) ?? 99);
    return statusDifference || timestampValue(right.updatedAt) - timestampValue(left.updatedAt);
  });
}

export function calculateWorkProjectMetrics(projects = []) {
  const current = projects.filter((project) => !project.deletedAt);
  return {
    active: current.filter((project) => !["completed", "cancelled"].includes(project.status)).length,
    inProgress: current.filter((project) => project.status === "in_progress").length,
    completed: current.filter((project) => project.status === "completed").length,
    plannedRevenue: current
      .filter((project) => project.status !== "cancelled")
      .reduce((total, project) => total + Number(project.plannedRevenue || 0), 0),
  };
}
