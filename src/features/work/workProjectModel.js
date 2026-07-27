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
