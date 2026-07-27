import { auth } from "../firebase.js";
import { validatePdfFile } from "../features/work/workModels.js";
import { requestTiiimeQuoteExtraction } from "./tiiimeQuoteRequest.js";

function endpoint() {
  if (import.meta.env.VITE_PARSE_TIIIME_QUOTE_FUNCTION_URL) return import.meta.env.VITE_PARSE_TIIIME_QUOTE_FUNCTION_URL;
  const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID || "").trim();
  if (!projectId) throw new Error("Configuration Firebase incomplète.");
  const region = import.meta.env.VITE_PARSE_TIIIME_QUOTE_FUNCTION_REGION || "europe-west1";
  return `https://${region}-${projectId}.cloudfunctions.net/parseTiiimeQuote`;
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Lecture du PDF impossible."));
    reader.readAsDataURL(file);
  });
}


export async function parseTiiimeQuotePdf(file, options = {}) {
  validatePdfFile(file);
  const user = auth.currentUser;
  if (!user) throw new Error("Utilisateur Firebase requis.");
  const token = await user.getIdToken();
  const dataUrl = await readAsDataUrl(file);
  const pdfBase64 = dataUrl.split(",")[1] || "";
  return requestTiiimeQuoteExtraction({
    url: options.endpointUrl || endpoint(),
    token,
    pdfBase64,
    fetchImpl: options.fetchImpl,
  });
}
