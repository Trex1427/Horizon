function normalizeHeader(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const HEADER_PATTERNS = {
  operationDate: [/date operation/, /^date$/, /operation date/, /booking date/],
  valueDate: [/date valeur/, /value date/],
  label: [/libelle/, /description/, /label/, /memo/, /intitule/],
  debit: [/debit/, /depense/, /sortie/],
  credit: [/credit/, /entree/, /revenu/],
  amount: [/montant/, /^amount$/, /solde operation/, /net amount/],
  reference: [/reference/, /ref/, /id operation/, /fitid/],
  balance: [/solde/, /balance/],
};

function matchField(header) {
  const normalized = normalizeHeader(header);
  const entries = Object.entries(HEADER_PATTERNS);
  for (const [field, patterns] of entries) {
    if (patterns.some((pattern) => pattern.test(normalized))) {
      return field;
    }
  }

  return null;
}

export function buildCsvStructureKey(headers = [], delimiter = ";") {
  return [delimiter, ...headers.map((header) => normalizeHeader(header))].join("|");
}

export function detectCsvMapping(headers = [], sampleRows = []) {
  const mapping = {
    operationDate: "",
    valueDate: "",
    label: "",
    debit: "",
    credit: "",
    amount: "",
    reference: "",
    balance: "",
  };

  headers.forEach((header) => {
    const matchedField = matchField(header);
    if (matchedField && !mapping[matchedField]) {
      mapping[matchedField] = header;
    }
  });

  const requiresAmountColumns = !mapping.amount && !(mapping.debit || mapping.credit);
  const requiresCoreColumns = !mapping.operationDate || !mapping.label || requiresAmountColumns;

  return {
    mapping,
    requiresMapping: requiresCoreColumns,
    sampleRowCount: Array.isArray(sampleRows) ? sampleRows.length : 0,
  };
}