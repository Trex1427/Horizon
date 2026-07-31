/* global process */
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { getApps, initializeApp } from "firebase-admin/app";
import { parseReceiptWithVision } from "./parseReceipt.js";
import { parseTiiimeQuoteRequest } from "./parseTiiimeQuote.js";
import { parseTiiimeInvoiceRequest } from "./parseTiiimeInvoice.js";
import { cleanupOrphanQuotePdfRequest } from "./cleanupOrphanQuotePdf.js";

if (!getApps().length) initializeApp();

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

export const parseTiiimeQuote = onRequest(
  {
    region: "europe-west1",
    cors: ALLOWED_ORIGINS,
    timeoutSeconds: 60,
    memory: "512MiB",
    secrets: [OPENAI_API_KEY],
  },
  async (req, res) => {
    await parseTiiimeQuoteRequest(req, res, {
      openAiApiKey: OPENAI_API_KEY.value(),
      openAiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      maxPdfBytes: Number(process.env.TIIIME_QUOTE_MAX_PDF_BYTES || 10 * 1024 * 1024),
    });
  }
);

export const parseTiiimeInvoice = onRequest(
  { region: "europe-west1", cors: ALLOWED_ORIGINS, timeoutSeconds: 60, memory: "512MiB", secrets: [OPENAI_API_KEY] },
  async (req, res) => {
    await parseTiiimeInvoiceRequest(req, res, { openAiApiKey: OPENAI_API_KEY.value(), openAiModel: process.env.OPENAI_MODEL || "gpt-4.1-mini", maxPdfBytes: Number(process.env.TIIIME_INVOICE_MAX_PDF_BYTES || 10 * 1024 * 1024) });
  }
);

export const cleanupOrphanQuotePdf = onRequest(
  {
    region: "europe-west1",
    cors: ALLOWED_ORIGINS,
    timeoutSeconds: 30,
    memory: "256MiB",
  },
  async (req, res) => {
    await cleanupOrphanQuotePdfRequest(req, res);
  }
);
