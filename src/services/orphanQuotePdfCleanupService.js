import { auth } from "../firebase.js";
import { requestOrphanQuotePdfCleanup } from "./orphanQuotePdfCleanupRequest.js";

function getEndpointUrl() {
  const explicit = import.meta.env.VITE_CLEANUP_ORPHAN_QUOTE_PDF_FUNCTION_URL;
  if (explicit) return explicit;
  const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID || "").trim();
  if (!projectId) throw new Error("Configuration Firebase incomplète.");
  const region = import.meta.env.VITE_CLEANUP_ORPHAN_QUOTE_PDF_FUNCTION_REGION || "europe-west1";
  return `https://${region}-${projectId}.cloudfunctions.net/cleanupOrphanQuotePdf`;
}

export async function cleanupOrphanQuotePdf(storagePath, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Utilisateur Firebase requis pour nettoyer le PDF.");
  const token = await user.getIdToken();
  return requestOrphanQuotePdfCleanup({
    endpointUrl: options.endpointUrl || getEndpointUrl(),
    token,
    storagePath,
    fetchImpl: options.fetchImpl,
  });
}
