function normalizeType(value) {
  return value === "revenu" ? "revenu" : "depense";
}

export function normalizeSubcategoryPayloadForCreate(payload = {}) {
  return {
    name: String(payload.name || "").trim(),
    categoryId: String(payload.categoryId || "").trim(),
    type: normalizeType(payload.type),
    isActive: payload.isActive !== false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeSubcategoryPayloadForUpdate(payload = {}) {
  return {
    name: String(payload.name || "").trim(),
    categoryId: String(payload.categoryId || "").trim(),
    type: normalizeType(payload.type),
    isActive: payload.isActive !== false,
    updatedAt: new Date().toISOString(),
  };
}

const ALLOWED_ACTIVITY_KINDS = new Set(["profit_center", "interest_center", "mixed"]);

export function normalizeActivityPayload(payload = {}) {
  const kind = String(payload.kind || "").trim();

  return {
    name: String(payload.name || "").trim(),
    kind: ALLOWED_ACTIVITY_KINDS.has(kind) ? kind : "mixed",
    isActive: payload.isActive !== false,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeActivityPayloadForCreate(payload = {}) {
  return {
    ...normalizeActivityPayload(payload),
    createdAt: new Date().toISOString(),
  };
}

const ALLOWED_THIRD_PARTY_TYPES = new Set([
  "client",
  "supplier",
  "administration",
  "employer",
  "bank",
  "social_organization",
  "individual",
  "other",
]);

export function normalizeThirdPartyPayload(payload = {}) {
  const type = String(payload.type || "").trim();

  return {
    name: String(payload.name || "").trim(),
    type: ALLOWED_THIRD_PARTY_TYPES.has(type) ? type : "other",
    notes: String(payload.notes || "").trim(),
    isActive: payload.isActive !== false,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeThirdPartyPayloadForCreate(payload = {}) {
  return {
    ...normalizeThirdPartyPayload(payload),
    createdAt: new Date().toISOString(),
  };
}

export function normalizeProjectPayload(payload = {}) {
  return {
    name: String(payload.name || "").trim(),
    activityId: String(payload.activityId || "").trim() || null,
    startDate: payload.startDate || null,
    endDate: payload.endDate || null,
    notes: String(payload.notes || "").trim(),
    isActive: payload.isActive !== false,
    updatedAt: new Date().toISOString(),
  };
}

export function normalizeProjectPayloadForCreate(payload = {}) {
  return {
    ...normalizeProjectPayload(payload),
    createdAt: new Date().toISOString(),
  };
}
