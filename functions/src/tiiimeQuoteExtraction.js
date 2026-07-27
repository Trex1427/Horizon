export const TIIIME_QUOTE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["quoteNumber", "issueDate", "amount", "customerName"],
  properties: {
    quoteNumber: { type: ["string", "null"] },
    issueDate: { type: ["string", "null"] },
    amount: { type: ["number", "null"] },
    customerName: { type: ["string", "null"] },
  },
};

export function normalizeTiiimeQuoteExtraction(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_EXTRACTION");
  const amount = value.amount === null ? null : Number(value.amount);
  return {
    quoteNumber: typeof value.quoteNumber === "string" ? value.quoteNumber.trim() : "",
    issueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(value.issueDate || "")) ? String(value.issueDate) : "",
    amount: Number.isFinite(amount) && amount >= 0 ? amount : null,
    customerName: typeof value.customerName === "string" ? value.customerName.trim() : "",
  };
}

export function parseOpenAiJson(response) {
  const text = response?.output_text;
  if (typeof text !== "string" || !text.trim()) throw new Error("INVALID_OPENAI_RESPONSE");
  return normalizeTiiimeQuoteExtraction(JSON.parse(text));
}
