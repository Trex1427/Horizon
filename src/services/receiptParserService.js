import { applyReceiptCategorySuggestion, RECEIPT_INTELLIGENCE_DEFAULTS } from "../utils/receiptDraftIntelligence.js";

const RECEIPT_REQUEST_TIMEOUT_MS = 60_000;

function getFileNameWithoutExtension(fileName = "") {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) {
    return fileName;
  }

  return fileName.slice(0, dotIndex);
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const DEFAULT_MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function estimateBytesFromBase64(base64String) {
  const clean = (base64String || "").replace(/\s+/g, "");
  const padding = (clean.match(/=+$/) || [""])[0].length;
  return Math.floor((clean.length * 3) / 4) - padding;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Impossible de lire le fichier image"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function getFunctionEndpointUrl() {
  const explicitUrl = import.meta.env.VITE_PARSE_RECEIPT_FUNCTION_URL;
  if (explicitUrl) {
    return explicitUrl;
  }

  const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID || "").trim();
  if (!projectId) {
    throw new Error("VITE_FIREBASE_PROJECT_ID is required to resolve parseReceipt endpoint");
  }

  const region = import.meta.env.VITE_PARSE_RECEIPT_FUNCTION_REGION || "europe-west1";
  return `https://${region}-${projectId}.cloudfunctions.net/parseReceipt`;
}

function mapReceiptApiError({ status = 0, serverMessage = "", reason = "" } = {}) {
  const normalizedServerMessage = String(serverMessage || "").toLowerCase();
  const normalizedReason = String(reason || "").toLowerCase();

  if (normalizedServerMessage.includes("openai_auth_invalid")) {
    return "Erreur 401: cle OpenAI invalide ou expiree.";
  }

  if (normalizedServerMessage.includes("openai_forbidden")) {
    return "Erreur 403: acces OpenAI refuse.";
  }

  if (normalizedServerMessage.includes("openai_model_not_found")) {
    return "Erreur modele OpenAI introuvable.";
  }

  if (normalizedServerMessage.includes("openai_image_invalid")) {
    return "Erreur 400: image ticket invalide ou non supportee.";
  }

  if (normalizedServerMessage.includes("openai_bad_request")) {
    return "Erreur 400: requete OpenAI invalide.";
  }

  if (normalizedReason === "timeout") {
    return "L'analyse du ticket a expire. Reessayez avec une photo plus nette.";
  }

  if (status === 403) {
    return "Erreur 403: origine non autorisee pour le scanner ticket.";
  }

  if (status === 413) {
    return "Image trop volumineuse";
  }

  if (status === 400) {
    if (normalizedServerMessage.includes("mime") || normalizedServerMessage.includes("format")) {
      return "Erreur 400: format de ticket non pris en charge.";
    }

    return "Erreur 400: demande scanner invalide.";
  }

  if ([429, 502, 503].includes(status) && (normalizedServerMessage.includes("openai") || normalizedServerMessage.includes("quota") || normalizedServerMessage.includes("credit"))) {
    return "Quota ou credit OpenAI indisponible. Reessayez plus tard.";
  }

  if (status >= 500) {
    return `Erreur ${status}: service scanner indisponible.`;
  }

  if (normalizedServerMessage) {
    return serverMessage;
  }

  return "Impossible de lire le ticket";
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function requestReceiptDraft({ endpointUrl = "", payload = {}, timeoutMs = RECEIPT_REQUEST_TIMEOUT_MS, fetchImpl = fetch } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort("timeout");
  }, timeoutMs);

  const uploadBytesEstimate = estimateBytesFromBase64(payload.imageBase64 || "");
  console.info("[receipt] request:start", {
    endpointUrl,
    mimeType: payload.mimeType,
    uploadBytesEstimate,
    categoriesCount: Array.isArray(payload.availableCategories) ? payload.availableCategories.length : 0,
  });

  try {
    const response = await fetchImpl(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const responseBody = await readJsonSafely(response);
    console.info("[receipt] request:response", {
      status: response.status,
      ok: response.ok,
    });

    if (!response.ok) {
      const serverMessage = responseBody?.error || "";
      throw new Error(mapReceiptApiError({
        status: response.status,
        serverMessage,
      }));
    }

    if (!responseBody || typeof responseBody !== "object") {
      throw new Error("Reponse JSON invalide du scanner ticket.");
    }

    return responseBody;
  } catch (error) {
    if (error?.name === "AbortError" || String(error?.message || "").toLowerCase().includes("timeout")) {
      throw new Error(mapReceiptApiError({ reason: "timeout" }));
    }

    if (error instanceof TypeError) {
      throw new Error("Erreur reseau: impossible de joindre le scanner ticket.");
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    console.info("[receipt] request:end");
  }
}

function normalizeAvailableCategories(availableCategories = []) {
  if (!Array.isArray(availableCategories)) {
    return [];
  }

  const seen = new Set();

  return availableCategories.filter((category) => {
    const id = String(category?.id || "").trim();
    const name = String(category?.name || "").trim();
    const type = String(category?.type || "depense").trim();
    const key = `${id}:${type}:${name.toLowerCase()}`;

    if (!id || !name || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildDraftWithDefaults(draft = {}, availableCategories = []) {
  return applyReceiptCategorySuggestion(
    {
      ...RECEIPT_INTELLIGENCE_DEFAULTS,
      ...getInitialDraftFromMock({ name: "ticket", size: 0 }),
      ...draft,
    },
    availableCategories
  );
}

async function parseReceiptWithFunction(file, options = {}) {
  const mimeType = String(file?.type || "").toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error("Format d'image non supporte pour l'analyse IA");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/i);

  if (!match) {
    throw new Error("Impossible de convertir l'image en base64");
  }

  const [, resolvedMimeType, imageBase64] = match;
  const imageBytes = estimateBytesFromBase64(imageBase64);
  if (imageBytes > DEFAULT_MAX_IMAGE_BYTES) {
    throw new Error("Image trop volumineuse pour l'analyse IA");
  }

  const endpointUrl = getFunctionEndpointUrl();
  if (!endpointUrl) {
    throw new Error("Endpoint parseReceipt non configure");
  }

  console.info("[receipt] parse:start", {
    fileName: file?.name || "",
    fileType: mimeType,
    fileSize: Number(file?.size || 0),
  });

  const draft = await requestReceiptDraft({
    endpointUrl,
    timeoutMs: Number(options.timeoutMs || RECEIPT_REQUEST_TIMEOUT_MS),
    payload: {
      imageBase64,
      mimeType: resolvedMimeType,
      fileName: file.name,
      availableCategories: normalizeAvailableCategories(options.availableCategories),
    },
  });

  if (!draft || typeof draft !== "object") {
    throw new Error("Reponse JSON invalide du scanner ticket.");
  }

  console.info("[receipt] parse:success", {
    fileName: file?.name || "",
  });

  return {
    draft: buildDraftWithDefaults(
      {
        ...getInitialDraftFromMock(file),
        ...draft,
      },
      options.availableCategories
    ),
  };
}

function getInitialDraftFromMock(file) {
  const merchantName = getFileNameWithoutExtension(file.name)
    .replace(/[\-_]+/g, " ")
    .trim();

  return {
    date: new Date().toISOString().slice(0, 10),
    montant: buildMockAmountFromFile(file),
    categorie: "Alimentation",
    categoryId: "",
    categoryName: "Alimentation",
    description: merchantName ? `Ticket ${merchantName}` : "Ticket",
    type: "depense",
    accountId: "",
    destinationAccountId: "",
    ...RECEIPT_INTELLIGENCE_DEFAULTS,
  };
}

function buildMockAmountFromFile(file) {
  const base = `${file?.name || "ticket"}-${file?.size || 0}`;
  const hash = base.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const euros = (hash % 9000) / 100 + 10;
  return euros.toFixed(2);
}

/**
 * Mock parser for step 1 of receipt flow.
 * No OCR is performed; output is intentionally partial and editable by user.
 */
export async function parseReceiptImageMock(file) {
  if (!file) {
    throw new Error("Aucune image fournie");
  }

  return {
    draft: getInitialDraftFromMock(file),
    metadata: {
      source: "mock-parser",
      confidence: 0.72,
      rawText: "MOCK OCR - Aucun texte réel extrait",
      image: {
        name: file.name,
        size: file.size,
        type: file.type,
      },
    },
  };
}

export async function parseReceiptImage(file, options = {}) {
  if (!file) {
    throw new Error("Aucune image fournie");
  }

  try {
    return await parseReceiptWithFunction(file, options);
  } catch (error) {
    const enableMockFallback = import.meta.env.DEV && import.meta.env.VITE_RECEIPT_ALLOW_MOCK_FALLBACK === "true";
    if (!enableMockFallback) {
      throw error;
    }

    const fallback = await parseReceiptImageMock(file);

    return {
      ...fallback,
      draft: buildDraftWithDefaults(fallback.draft, options.availableCategories),
      warning:
        error?.message ||
        "Analyse IA indisponible. Brouillon genere en mode secours.",
    };
  }
}
