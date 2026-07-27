import OpenAI from "openai";
import { getAuth } from "firebase-admin/auth";
import { parseOpenAiJson, TIIIME_QUOTE_SCHEMA } from "./tiiimeQuoteExtraction.js";

function error(res, status, message) { res.status(status).json({ error: message }); }
function base64Bytes(value) {
  const clean = String(value || "").replace(/\s+/g, "");
  return Math.floor(clean.length * 3 / 4) - ((clean.match(/=+$/) || [""])[0].length);
}

export async function parseTiiimeQuoteRequest(req, res, config = {}) {
  if (req.method === "OPTIONS") { res.status(204).send(""); return; }
  if (req.method !== "POST") { error(res, 405, "METHOD_NOT_ALLOWED"); return; }
  const token = String(req.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) { error(res, 401, "AUTH_REQUIRED"); return; }
  try { await (config.verifyIdToken || ((value) => getAuth().verifyIdToken(value)))(token); }
  catch { error(res, 401, "AUTH_INVALID"); return; }

  const mimeType = String(req.body?.mimeType || "").toLowerCase();
  const pdfBase64 = String(req.body?.pdfBase64 || "").trim();
  if (mimeType !== "application/pdf" || !pdfBase64) { error(res, 400, "PDF_INVALID"); return; }
  if (base64Bytes(pdfBase64) > Number(config.maxPdfBytes || 10 * 1024 * 1024)) { error(res, 413, "PDF_TOO_LARGE"); return; }
  if (!config.openAiApiKey) { error(res, 500, "OPENAI_API_KEY_NOT_CONFIGURED"); return; }

  try {
    const client = config.openAiClient || new OpenAI({ apiKey: config.openAiApiKey });
    const response = await client.responses.create({
      model: config.openAiModel || "gpt-4.1-mini",
      temperature: 0,
      text: { format: { type: "json_schema", name: "tiiime_quote", strict: true, schema: TIIIME_QUOTE_SCHEMA } },
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: "Extrais le numéro du devis, la date d'émission ISO YYYY-MM-DD, le montant total TTC et le nom du client. Retourne null si absent." },
          { type: "input_file", filename: "devis-tiiime.pdf", file_data: `data:application/pdf;base64,${pdfBase64}` },
        ],
      }],
    });
    res.status(200).json(parseOpenAiJson(response));
  } catch (err) {
    console.error("tiiime_quote:error", { message: err?.message, status: err?.status });
    error(res, Number(err?.status) === 429 ? 503 : 500, "QUOTE_PARSING_FAILED");
  }
}
