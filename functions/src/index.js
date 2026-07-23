import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { parseReceiptWithVision } from "./parseReceipt.js";

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://budget-alexandre.web.app",
  "https://budget-alexandre.firebaseapp.com",
];

export const parseReceipt = onRequest(
  {
    region: "europe-west1",
    cors: ALLOWED_ORIGINS,
    timeoutSeconds: 60,
    memory: "512MiB",
    secrets: [OPENAI_API_KEY],
  },
  async (req, res) => {
    await parseReceiptWithVision(req, res, {
      openAiApiKey: OPENAI_API_KEY.value(),
      openAiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      maxImageBytes: Number(process.env.RECEIPT_MAX_IMAGE_BYTES || 8 * 1024 * 1024),
      allowedOrigins: ALLOWED_ORIGINS,
    });
  }
);
