export function parsePaymentAmountInput(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : Number.NaN;
  const normalized = String(value ?? "").trim().replace(/[\s\u00a0]/g, "").replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  return Number(normalized);
}