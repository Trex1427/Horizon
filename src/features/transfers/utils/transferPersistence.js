import { normalizeTransferPayload } from "./transferValidation.js";
import { sanitizeUserPayload } from "../../../auth/requireCurrentUid.js";

export function buildTransferCreatePayload(payload = {}) {
  const normalized = normalizeTransferPayload(sanitizeUserPayload(payload, { removeSystemFields: true }));
  const nowIso = new Date().toISOString();

  return {
    ...normalized,
    createdAt: normalized.createdAt || nowIso,
    updatedAt: nowIso,
  };
}

export function buildTransferUpdatePayload(payload = {}) {
  const normalized = normalizeTransferPayload(sanitizeUserPayload(payload, { removeSystemFields: true }));
  const updatePayload = { ...normalized };
  delete updatePayload.createdAt;

  return {
    ...updatePayload,
    updatedAt: new Date().toISOString(),
  };
}

export function buildTransferDeletePatch() {
  return {
    isActive: false,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
