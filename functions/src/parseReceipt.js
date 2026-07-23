import { extractReceiptFieldsWithVision } from "./openaiVisionClient.js";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

function sendError(res, statusCode, message) {
  res.status(statusCode).json({ error: message });
}

function getTraceId(req) {
  return String(req.get("x-cloud-trace-context") || "").split("/")[0] || `local-${Date.now()}`;
}

function getMemoryUsageMb() {
  const rssBytes = Number(process.memoryUsage?.().rss || 0);
  return Math.round((rssBytes / (1024 * 1024)) * 100) / 100;
}

function isAllowedOrigin(origin, allowedOrigins = []) {
  if (!origin || typeof origin !== "string") {
    return false;
  }

  return allowedOrigins.includes(origin);
}

function normalizeBase64(value) {
  if (!value || typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  const dataUrlMatch = trimmed.match(/^data:[^;]+;base64,(.+)$/i);

  if (dataUrlMatch) {
    return dataUrlMatch[1];
  }

  return trimmed;
}

function estimateBytesFromBase64(base64String) {
  const clean = base64String.replace(/\s+/g, "");
  const padding = (clean.match(/=+$/) || [""])[0].length;
  return Math.floor((clean.length * 3) / 4) - padding;
}

function normalizeAvailableCategories(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((category) => ({
      id: typeof category?.id === "string" ? category.id.trim() : "",
      name: typeof category?.name === "string" ? category.name.trim() : "",
      type: typeof category?.type === "string" ? category.type.trim() : "depense",
    }))
    .filter((category) => category.id && category.name);
}

function mapExtractionToDraft(extraction) {
  const amountText = extraction.amount === null || Number.isNaN(Number(extraction.amount)) ? "" : String(extraction.amount);
  const description = extraction.merchant || extraction.items?.[0]?.label || "";
  const categoryName = "";

  return {
    date: extraction.date || new Date().toISOString().slice(0, 10),
    montant: amountText,
    categorie: categoryName,
    categoryId: "",
    categoryName,
    description,
    type: extraction.type || "depense",
    accountId: "",
    destinationAccountId: "",
    items: Array.isArray(extraction.items) ? extraction.items : [],
    keywords: Array.isArray(extraction.keywords) ? extraction.keywords : [],
    suggestedCategoryId: extraction.suggestedCategoryId || null,
    suggestedCategoryName: extraction.suggestedCategoryName || extraction.suggestedCategory || null,
    suggestedCategory: extraction.suggestedCategoryName || extraction.suggestedCategory || null,
    categoryConfidence: extraction.categoryConfidence ?? null,
    categoryReason: extraction.categoryReason || "",
    merchantConfidence: extraction.merchantConfidence ?? null,
    dateConfidence: extraction.dateConfidence ?? null,
    amountConfidence: extraction.amountConfidence ?? null,
    overallConfidence: extraction.overallConfidence ?? null,
  };
}

export async function parseReceiptWithVision(req, res, config) {
  const traceId = getTraceId(req);
  const startedAt = Date.now();
  const origin = String(req.get("origin") || "").trim();

  console.info("scanner:start", {
    traceId,
    method: req.method,
    origin,
  });

  if (req.method === "OPTIONS") {
    if (origin && isAllowedOrigin(origin, config.allowedOrigins)) {
      res.set("Access-Control-Allow-Origin", origin);
    }
    res.set("Vary", "Origin");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.status(204).send("");
    return;
  }

  if (!isAllowedOrigin(origin, config.allowedOrigins)) {
    sendError(res, 403, "ORIGIN_NOT_ALLOWED");
    return;
  }

  if (req.method !== "POST") {
    res.set("Allow", "POST");
    sendError(res, 405, "METHOD_NOT_ALLOWED");
    return;
  }

  const mimeType = String(req.body?.mimeType || "").toLowerCase();
  const imageBase64 = normalizeBase64(req.body?.imageBase64);
  const availableCategories = normalizeAvailableCategories(req.body?.availableCategories);
  const imageBytes = estimateBytesFromBase64(imageBase64 || "");

  console.info("scanner:image_received", {
    traceId,
    mimeType,
    imageBytes,
    categoriesCount: availableCategories.length,
  });

  if (!imageBase64) {
    sendError(res, 400, "IMAGE_BASE64_REQUIRED");
    return;
  }

  if (!mimeType || !ALLOWED_MIME_TYPES.has(mimeType)) {
    sendError(res, 400, "MIME_TYPE_INVALID");
    return;
  }

  const maxImageBytes = Number(config.maxImageBytes || 8 * 1024 * 1024);
  if (Number.isFinite(maxImageBytes) && imageBytes > maxImageBytes) {
    sendError(res, 413, "IMAGE_TOO_LARGE");
    return;
  }

  if (!config.openAiApiKey) {
    sendError(res, 500, "OPENAI_API_KEY_NOT_CONFIGURED");
    return;
  }

  try {
    console.info("scanner:openai_request", {
      traceId,
      model: config.openAiModel,
      mimeType,
      imageBytes,
    });

    const extraction = await extractReceiptFieldsWithVision({
      apiKey: config.openAiApiKey,
      model: config.openAiModel,
      imageBase64,
      mimeType,
      availableCategories,
    });

    console.info("scanner:openai_response", {
      traceId,
      model: config.openAiModel,
      status: 200,
      hasAmount: extraction?.amount !== null && extraction?.amount !== undefined,
      hasDate: Boolean(extraction?.date),
      hasMerchant: Boolean(extraction?.merchant),
    });

    const draft = mapExtractionToDraft(extraction);
    console.info("scanner:draft_created", {
      traceId,
      hasAmount: Boolean(draft.montant),
      hasDate: Boolean(draft.date),
      hasDescription: Boolean(draft.description),
      durationMs: Date.now() - startedAt,
      memoryMb: getMemoryUsageMb(),
    });

    res.status(200).json(draft);
    console.info("scanner:response_sent", {
      traceId,
      status: 200,
      durationMs: Date.now() - startedAt,
      memoryMb: getMemoryUsageMb(),
    });
  } catch (error) {
    console.error("scanner:error", {
      traceId,
      message: error?.message,
      name: error?.name,
      status: error?.status,
      code: error?.code,
      type: error?.type,
      stack: error?.stack,
      durationMs: Date.now() - startedAt,
      memoryMb: getMemoryUsageMb(),
    });

    const status = Number(error?.status || 0);
    const code = String(error?.code || "").toLowerCase();
    const message = String(error?.message || "").toLowerCase();
    const type = String(error?.type || "").toLowerCase();

    if (status === 429 || code.includes("insufficient_quota") || message.includes("quota") || message.includes("insufficient") || message.includes("billing") || type.includes("insufficient_quota")) {
      sendError(res, 503, "OPENAI_QUOTA_UNAVAILABLE");
      return;
    }

    if (status === 401) {
      sendError(res, 401, "OPENAI_AUTH_INVALID");
      return;
    }

    if (status === 403) {
      sendError(res, 403, "OPENAI_FORBIDDEN");
      return;
    }

    if (status === 404) {
      sendError(res, 500, "OPENAI_MODEL_NOT_FOUND");
      return;
    }

    if (status === 400) {
      if (message.includes("unsupported image") || message.includes("invalid base64") || message.includes("image_url")) {
        sendError(res, 400, "OPENAI_IMAGE_INVALID");
        return;
      }

      sendError(res, 400, "OPENAI_BAD_REQUEST");
      return;
    }

    if (status >= 500) {
      sendError(res, 502, "OPENAI_UPSTREAM_ERROR");
      return;
    }

    sendError(res, 500, "RECEIPT_PARSING_FAILED");
  }
}
