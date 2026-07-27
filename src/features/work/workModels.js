export const WORK_QUOTE_STATUSES = Object.freeze(["pending", "accepted"]);
export const WORK_QUOTE_SOURCES = Object.freeze(["manual", "tiiime_pdf"]);
export const WORK_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

function requiredText(value, message) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(message);
  return normalized;
}

function nonNegativeNumber(value, message) {
  if (value === "" || value === null || value === undefined) throw new Error(message);
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized < 0) throw new Error(message);
  return normalized;
}

export function normalizeProfessionalActivity(payload = {}, { now = new Date() } = {}) {
  return {
    name: requiredText(payload.name, "Le nom de l'activité professionnelle est obligatoire."),
    color: String(payload.color || "#2e7d6f").trim() || "#2e7d6f",
    icon: String(payload.icon || "work").trim() || "work",
    urssafRate: nonNegativeNumber(payload.urssafRate ?? 0, "Le taux URSSAF doit être supérieur ou égal à 0."),
    isActive: payload.isActive !== false,
    updatedAt: now,
  };
}

export function normalizeProfessionalActivityForCreate(payload = {}, options = {}) {
  const normalized = normalizeProfessionalActivity(payload, options);
  return { ...normalized, createdAt: normalized.updatedAt };
}

export function normalizeQuote(payload = {}, { now = new Date() } = {}) {
  const status = String(payload.status || "pending");
  const source = String(payload.source || "manual");
  if (!WORK_QUOTE_STATUSES.includes(status)) throw new Error("Statut de devis inconnu.");
  if (!WORK_QUOTE_SOURCES.includes(source)) throw new Error("Source de devis inconnue.");
  if (source === "tiiime_pdf" && !String(payload.documentId || "").trim()) {
    throw new Error("Le PDF est obligatoire pour un devis importé depuis Tiiime.");
  }
  return {
    professionalActivityId: requiredText(payload.professionalActivityId, "L'activité professionnelle est obligatoire."),
    thirdPartyId: requiredText(payload.thirdPartyId, "Le tiers est obligatoire."),
    quoteNumber: String(payload.quoteNumber || "").trim(),
    issueDate: requiredText(payload.issueDate, "La date du devis est obligatoire."),
    amount: nonNegativeNumber(payload.amount, "Le montant doit être supérieur ou égal à 0."),
    status,
    documentId: String(payload.documentId || "").trim() || null,
    source,
    updatedAt: now,
    deletedAt: payload.deletedAt || null,
  };
}

export function normalizeQuoteForCreate(payload = {}, options = {}) {
  const normalized = normalizeQuote(payload, options);
  return { ...normalized, createdAt: normalized.updatedAt };
}

export function validatePdfFile(file, maxBytes = WORK_DOCUMENT_MAX_BYTES) {
  if (!file || String(file.type || "").toLowerCase() !== "application/pdf") {
    throw new Error("Le document doit être un fichier PDF.");
  }
  if (!Number.isFinite(Number(file.size)) || Number(file.size) > maxBytes) {
    throw new Error(`Le PDF dépasse la taille maximale autorisée de ${Math.round(maxBytes / 1024 / 1024)} Mo.`);
  }
  return file;
}

export function normalizeForMatch(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function matchThirdParties(customerName, thirdParties = []) {
  const needle = normalizeForMatch(customerName);
  if (!needle) return { state: "none", candidates: [] };
  const candidates = thirdParties
    .filter((entry) => entry?.isActive !== false)
    .map((entry) => {
      const name = normalizeForMatch(entry.name);
      const exact = name === needle;
      const contained = name.includes(needle) || needle.includes(name);
      const needleTokens = new Set(needle.split(" "));
      const overlap = name.split(" ").filter((token) => needleTokens.has(token)).length;
      return { ...entry, matchScore: exact ? 100 : contained ? 80 : overlap };
    })
    .filter((entry) => entry.matchScore > 0)
    .sort((left, right) => right.matchScore - left.matchScore);
  if (!candidates.length) return { state: "none", candidates: [] };
  const best = candidates[0].matchScore;
  const bestCandidates = candidates.filter((entry) => entry.matchScore === best);
  return { state: bestCandidates.length === 1 ? "found" : "multiple", candidates: bestCandidates };
}

export function normalizeQuoteExtraction(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Réponse serveur invalide.");
  return {
    quoteNumber: String(value.quoteNumber || "").trim(),
    issueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(value.issueDate || "")) ? String(value.issueDate) : "",
    amount: value.amount === null || value.amount === undefined || value.amount === "" ? "" : String(value.amount),
    customerName: String(value.customerName || "").trim(),
  };
}
