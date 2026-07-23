const PROTECTED_USER_FIELDS = new Set([
  "ownerUid",
  "createdBy",
  "uid",
  "userId",
  "ownerId",
]);

const SYSTEM_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "id",
]);

export function requireCurrentUid(authInstance) {
  const uid = String(authInstance?.currentUser?.uid || "").trim();

  if (!uid) {
    throw new Error("Utilisateur Firebase requis pour écrire dans Firestore.");
  }

  return uid;
}

export function sanitizeUserPayload(payload = {}, options = {}) {
  const removeSystemFields = options?.removeSystemFields === true;
  const source = payload && typeof payload === "object" ? payload : {};
  const sanitized = {};

  for (const [key, value] of Object.entries(source)) {
    if (PROTECTED_USER_FIELDS.has(key)) {
      continue;
    }

    if (removeSystemFields && SYSTEM_FIELDS.has(key)) {
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
}

export function withOwnerUidForCreate(payload = {}, options = {}) {
  return {
    ...sanitizeUserPayload(payload, options),
    ownerUid: requireCurrentUid(options?.auth),
  };
}
