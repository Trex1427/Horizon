export const EXTRACTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "type",
    "amount",
    "date",
    "merchant",
    "items",
    "keywords",
    "suggestedCategoryId",
    "suggestedCategoryName",
    "categoryConfidence",
    "categoryReason",
    "merchantConfidence",
    "dateConfidence",
    "amountConfidence",
    "overallConfidence",
  ],
  properties: {
    type: {
      type: "string",
      enum: ["depense", "revenu"],
    },
    amount: {
      type: ["number", "null"],
    },
    date: {
      type: ["string", "null"],
    },
    merchant: {
      type: ["string", "null"],
    },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "quantity", "unitAmount", "amount"],
        properties: {
          label: {
            type: "string",
          },
          quantity: {
            type: ["number", "null"],
          },
          unitAmount: {
            type: ["number", "null"],
          },
          amount: {
            type: ["number", "null"],
          },
        },
      },
    },
    keywords: {
      type: "array",
      items: {
        type: "string",
      },
    },
    suggestedCategoryId: {
      type: ["string", "null"],
    },
    suggestedCategoryName: {
      type: ["string", "null"],
    },
    categoryConfidence: {
      type: ["number", "null"],
      minimum: 0,
      maximum: 1,
    },
    categoryReason: {
      type: ["string", "null"],
    },
    merchantConfidence: {
      type: ["number", "null"],
      minimum: 0,
      maximum: 1,
    },
    dateConfidence: {
      type: ["number", "null"],
      minimum: 0,
      maximum: 1,
    },
    amountConfidence: {
      type: ["number", "null"],
      minimum: 0,
      maximum: 1,
    },
    overallConfidence: {
      type: ["number", "null"],
      minimum: 0,
      maximum: 1,
    },
  },
};

const MAX_ITEMS = 40;

function sanitizeString(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export function normalizeDate(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const isoMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return normalized;
  }

  const frMatch = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (frMatch) {
    const [, day, month, year] = frMatch;
    return `${year}-${month}-${day}`;
  }

  return null;
}

export function extractJsonObject(rawText) {
  if (!rawText || typeof rawText !== "string") {
    throw new Error("OpenAI response is empty");
  }

  const firstCurly = rawText.indexOf("{");
  const lastCurly = rawText.lastIndexOf("}");

  if (firstCurly < 0 || lastCurly <= firstCurly) {
    throw new Error("OpenAI did not return a JSON object");
  }

  const candidate = rawText.slice(firstCurly, lastCurly + 1);
  return JSON.parse(candidate);
}

function normalizeConfidence(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0 || normalized > 1) {
    return null;
  }

  return normalized;
}

function normalizeItems(items) {
  if (!Array.isArray(items)) {
    throw new Error("OpenAI JSON field 'items' must be an array");
  }

  return items
    .slice(0, MAX_ITEMS)
    .map((item) => {
      const label = sanitizeString(item?.label);

      if (!label) {
        return null;
      }

      const quantity = item?.quantity === null ? null : Number(item?.quantity);
      const unitAmount = item?.unitAmount === null ? null : Number(item?.unitAmount);
      const amount = item?.amount === null ? null : Number(item?.amount);

      if (!(quantity === null || Number.isFinite(quantity))) {
        throw new Error("OpenAI JSON item field 'quantity' must be number or null");
      }

      if (!(unitAmount === null || Number.isFinite(unitAmount))) {
        throw new Error("OpenAI JSON item field 'unitAmount' must be number or null");
      }

      if (!(amount === null || Number.isFinite(amount))) {
        throw new Error("OpenAI JSON item field 'amount' must be number or null");
      }

      return {
        label,
        quantity,
        unitAmount,
        amount,
      };
    })
    .filter(Boolean);
}

function normalizeKeywords(keywords) {
  if (!Array.isArray(keywords)) {
    throw new Error("OpenAI JSON field 'keywords' must be an array");
  }

  const seen = new Set();
  const normalized = [];

  for (const keyword of keywords) {
    const cleaned = sanitizeString(keyword).toLowerCase();
    if (!cleaned || seen.has(cleaned)) {
      continue;
    }

    seen.add(cleaned);
    normalized.push(cleaned);

    if (normalized.length >= 10) {
      break;
    }
  }

  return normalized;
}

export function normalizeAvailableCategories(availableCategories = []) {
  if (!Array.isArray(availableCategories)) {
    return [];
  }

  const seen = new Set();
  const normalized = [];

  availableCategories.forEach((category) => {
    const id = sanitizeString(category?.id);
    const name = sanitizeString(category?.name);
    const type = sanitizeString(category?.type) || "depense";
    const key = `${id}:${type}:${name.toLowerCase()}`;

    if (!id || !name || seen.has(key)) {
      return;
    }

    seen.add(key);
    normalized.push({ id, name, type });
  });

  return normalized;
}

export function validateAndNormalizeExtraction(extraction, availableCategories = []) {
  const required = [
    "type",
    "amount",
    "date",
    "merchant",
    "items",
    "keywords",
    "categoryConfidence",
    "categoryReason",
    "overallConfidence",
  ];

  for (const key of required) {
    if (!(key in extraction)) {
      throw new Error(`OpenAI JSON missing field: ${key}`);
    }
  }

  if (!["depense", "revenu"].includes(extraction.type)) {
    throw new Error("OpenAI JSON field 'type' is invalid");
  }

  if (!(extraction.amount === null || typeof extraction.amount === "number")) {
    throw new Error("OpenAI JSON field 'amount' must be number or null");
  }

  if (!(extraction.date === null || typeof extraction.date === "string")) {
    throw new Error("OpenAI JSON field 'date' must be string or null");
  }

  if (!(extraction.merchant === null || typeof extraction.merchant === "string")) {
    throw new Error("OpenAI JSON field 'merchant' must be string or null");
  }

  if (
    !(
      extraction.suggestedCategoryId === undefined ||
      extraction.suggestedCategoryId === null ||
      typeof extraction.suggestedCategoryId === "string"
    )
  ) {
    throw new Error("OpenAI JSON field 'suggestedCategoryId' must be string or null");
  }

  if (
    !(
      extraction.suggestedCategoryName === undefined ||
      extraction.suggestedCategoryName === null ||
      typeof extraction.suggestedCategoryName === "string"
    )
  ) {
    throw new Error("OpenAI JSON field 'suggestedCategoryName' must be string or null");
  }

  if (
    !(extraction.suggestedCategory === undefined || extraction.suggestedCategory === null || typeof extraction.suggestedCategory === "string")
  ) {
    throw new Error("OpenAI JSON field 'suggestedCategory' must be string or null");
  }

  if (!(extraction.categoryReason === null || typeof extraction.categoryReason === "string")) {
    throw new Error("OpenAI JSON field 'categoryReason' must be string or null");
  }

  const normalizedAvailableCategories = normalizeAvailableCategories(availableCategories);
  const normalizedSuggestedCategoryId = sanitizeString(extraction.suggestedCategoryId) || null;
  const normalizedSuggestedCategoryName =
    sanitizeString(extraction.suggestedCategoryName) || sanitizeString(extraction.suggestedCategory) || null;
  const hasCategoryCatalog = normalizedAvailableCategories.length > 0;
  const matchedSuggestedCategory = hasCategoryCatalog
    ? normalizedAvailableCategories.find(
        (category) => category.id === normalizedSuggestedCategoryId && category.type === extraction.type
      )
    : null;

  return {
    type: extraction.type,
    amount: extraction.amount,
    date: normalizeDate(extraction.date),
    merchant: sanitizeString(extraction.merchant) || null,
    items: normalizeItems(extraction.items),
    keywords: normalizeKeywords(extraction.keywords),
    suggestedCategoryId: hasCategoryCatalog ? matchedSuggestedCategory?.id || null : null,
    suggestedCategoryName: hasCategoryCatalog
      ? matchedSuggestedCategory?.name || normalizedSuggestedCategoryName
      : normalizedSuggestedCategoryName,
    suggestedCategory: hasCategoryCatalog
      ? matchedSuggestedCategory?.name || normalizedSuggestedCategoryName
      : normalizedSuggestedCategoryName,
    categoryConfidence: normalizeConfidence(extraction.categoryConfidence),
    categoryReason: sanitizeString(extraction.categoryReason),
    merchantConfidence: normalizeConfidence(extraction.merchantConfidence),
    dateConfidence: normalizeConfidence(extraction.dateConfidence),
    amountConfidence: normalizeConfidence(extraction.amountConfidence),
    overallConfidence: normalizeConfidence(extraction.overallConfidence),
  };
}