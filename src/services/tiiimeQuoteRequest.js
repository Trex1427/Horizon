import { normalizeQuoteExtraction } from "../features/work/workModels.js";

export async function requestTiiimeQuoteExtraction({ url, token, pdfBase64, fetchImpl = fetch }) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ pdfBase64, mimeType: "application/pdf" }),
  });
  let body;
  try { body = await response.json(); } catch { throw new Error("Réponse serveur invalide."); }
  if (!response.ok) throw new Error(body?.error || "Analyse du devis impossible.");
  return normalizeQuoteExtraction(body);
}
