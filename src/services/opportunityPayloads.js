import { OPPORTUNITY_STATUSES } from "../constants/opportunityConstants.js";

function toAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeDateString(value) {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
}

function normalizeStatus(value) {
  const status = String(value || "").trim();
  return OPPORTUNITY_STATUSES.includes(status) ? status : "A etudier";
}

export function buildOpportunityPayload(payload = {}, now = new Date()) {
  const categoryName = String(payload.categoryName || payload.category || "").trim();
  const realizedAmount = payload.realizedAmount === "" || payload.realizedAmount === null || payload.realizedAmount === undefined
    ? null
    : toAmount(payload.realizedAmount);
  const realizedDate = normalizeDateString(payload.realizedDate);

  return {
    name: String(payload.name || "").trim(),
    description: String(payload.description || "").trim(),
    estimatedAmount: toAmount(payload.estimatedAmount ?? payload.amount),
    estimatedDate: normalizeDateString(payload.estimatedDate),
    accountId: String(payload.accountId || "").trim(),
    categoryId: String(payload.categoryId || "").trim(),
    categoryName,
    category: categoryName,
    projectId: String(payload.projectId || "").trim(),
    projectName: String(payload.projectName || "").trim(),
    thirdPartyId: String(payload.thirdPartyId || "").trim(),
    thirdPartyName: String(payload.thirdPartyName || "").trim(),
    activityId: String(payload.activityId || "").trim(),
    activityName: String(payload.activityName || "").trim(),
    realizedAmount,
    realizedDate,
    status: normalizeStatus(payload.status),
    comment: String(payload.comment || "").trim(),
    isActive: payload.isActive !== false,
    updatedAt: now,
  };
}

export function buildOpportunityCreatePayload(payload = {}, now = new Date()) {
  return {
    ...buildOpportunityPayload(payload, now),
    createdAt: now,
    isDeleted: false,
  };
}
