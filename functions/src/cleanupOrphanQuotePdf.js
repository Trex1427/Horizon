import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

export function isOwnedQuoteStoragePath(storagePath, ownerUid) {
  const path = String(storagePath || "").trim();
  const uid = String(ownerUid || "").trim();
  if (!path || !uid || path.includes("..") || path.includes("\\") || path.startsWith("/")) return false;
  const prefixes = ["quotes", "invoices"].map((kind) => `users/${uid}/documents/${kind}/`);
  const prefix = prefixes.find((candidate) => path.startsWith(candidate));
  if (!prefix) return false;
  const relative = path.slice(prefix.length);
  const segments = relative.split("/");
  return segments.length === 2 && segments.every((segment) => segment.length > 0);
}

export async function cleanupOrphanQuotePdfRequest(req, res, config = {}) {
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    sendError(res, 405, "METHOD_NOT_ALLOWED");
    return;
  }

  const token = String(req.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    sendError(res, 401, "AUTH_REQUIRED");
    return;
  }

  let decodedToken;
  try {
    decodedToken = await (config.verifyIdToken || ((value) => getAuth().verifyIdToken(value)))(token);
  } catch {
    sendError(res, 401, "AUTH_INVALID");
    return;
  }

  const ownerUid = String(decodedToken?.uid || "").trim();
  const storagePath = String(req.body?.storagePath || "").trim();
  if (!isOwnedQuoteStoragePath(storagePath, ownerUid)) {
    sendError(res, 403, "STORAGE_PATH_FORBIDDEN");
    return;
  }

  try {
    const deleteFile = config.deleteFile || ((path) => getStorage().bucket().file(path).delete({ ignoreNotFound: true }));
    await deleteFile(storagePath);
    res.status(200).json({ deleted: true, storagePath });
  } catch (error) {
    console.error("document_pdf_compensation:delete_failed", {
      ownerUid,
      storagePath,
      message: error?.message,
    });
    sendError(res, 500, "STORAGE_CLEANUP_FAILED");
  }
}
