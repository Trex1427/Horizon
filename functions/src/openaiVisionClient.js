import OpenAI from "openai";
import {
  EXTRACTION_SCHEMA,
  extractJsonObject,
  normalizeAvailableCategories,
  validateAndNormalizeExtraction,
} from "./receiptExtractionSchema.js";

export async function extractReceiptFieldsWithVision({ apiKey, model, imageBase64, mimeType, availableCategories = [] }) {
  const startedAt = Date.now();
  const client = new OpenAI({ apiKey });
  const normalizedAvailableCategories = normalizeAvailableCategories(availableCategories);
  const availableCategoriesPrompt = normalizedAvailableCategories.length
    ? `Available Horizon categories by id: ${JSON.stringify(normalizedAvailableCategories)}. suggestedCategoryId must be one of these ids or null.`
    : "No Horizon category catalog with ids is available. suggestedCategoryId must be null and suggestedCategoryName may be a plain text suggestion.";

  const systemPrompt = [
    "You extract structured data from a single receipt or invoice image.",
    "Return only one JSON object that strictly matches the required schema.",
    "Use amounts as decimal numbers.",
    "Use type=depense by default when uncertain.",
    "For date, prefer ISO YYYY-MM-DD. If uncertain, return null.",
    "Items may be empty when receipt lines are unreadable.",
    "Item labels must keep complete readable receipt text, never replace labels by keywords.",
    "keywords must be meaningful, lowercase, deduplicated, and limited to around 10 entries.",
    "merchantConfidence, dateConfidence, amountConfidence, categoryConfidence and overallConfidence must be between 0 and 1 or null.",
    "Never determine a category from the merchant name alone. Merchant is only a weak hint.",
    "Base suggestedCategoryId and suggestedCategoryName on detected items, keywords, and receipt content.",
    "Examples: Leroy Merlin + terreau or secateur => Jardin. Leroy Merlin + disjoncteur or gaine => Electricite. Carrefour + produits alimentaires => Alimentation. Carrefour + huile moteur or lave-glace => Automobile.",
    "categoryReason must be a short French explanation understandable by an end user.",
    "If Horizon categories are provided, suggestedCategoryId must be an existing id from the list, never invented. If no category is good enough, return suggestedCategoryId=null.",
    availableCategoriesPrompt,
  ].join(" ");

  const userPrompt = [
    "Analyse this receipt/invoice image and return the JSON payload.",
    "Schema keys: type, amount, date, merchant, items, keywords, suggestedCategoryId, suggestedCategoryName, categoryConfidence, categoryReason, merchantConfidence, dateConfidence, amountConfidence, overallConfidence.",
  ].join(" ");

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.1,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "receipt_extraction",
          strict: true,
          schema: EXTRACTION_SCHEMA,
        },
      },
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
    });

    const rawContent = completion.choices?.[0]?.message?.content || "";
    const extraction = extractJsonObject(rawContent);

    console.info("scanner:openai_client_success", {
      model,
      durationMs: Date.now() - startedAt,
      completionId: completion?.id || null,
      usage: completion?.usage || null,
    });

    return validateAndNormalizeExtraction(extraction, normalizedAvailableCategories);
  } catch (error) {
    console.error("scanner:openai_client_error", {
      model,
      durationMs: Date.now() - startedAt,
      status: error?.status,
      code: error?.code,
      type: error?.type,
      message: error?.message,
      stack: error?.stack,
    });

    throw error;
  }
}
