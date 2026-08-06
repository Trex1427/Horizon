import { detectCsvMapping } from "../detectors/detectCsvMapping.js";
import { normalizeImportedTransaction } from "../normalizers/normalizeImportedTransaction.js";
import { parseLocalizedNumber } from "../normalizers/normalizeAmount.js";

function detectDelimiter(content = "") {
  const candidates = [";", ",", "\t"];
  let bestDelimiter = ";";
  let bestScore = -1;

  candidates.forEach((delimiter) => {
    const rows = parseDelimitedRows(content, delimiter).slice(0, 30);
    const headerRowIndex = pickHeaderRow(rows);
    const headers = rows[headerRowIndex] || [];
    const sampleRows = rows.slice(headerRowIndex + 1, headerRowIndex + 6);
    const detected = detectCsvMapping(headers, sampleRows);
    const mappedCoreFields = [
      detected.mapping.operationDate,
      detected.mapping.label,
      detected.mapping.amount || detected.mapping.debit || detected.mapping.credit,
    ].filter(Boolean).length;
    const consistentRows = sampleRows.filter((row) => row.length === headers.length).length;
    const score = (mappedCoreFields * 1000) + (consistentRows * 10) + headers.length;

    if (score > bestScore) {
      bestScore = score;
      bestDelimiter = delimiter;
    }
  });

  return bestDelimiter;
}
function parseDelimitedRows(content = "", delimiter = ";") {
  const rows = [];
  let row = [];
  let current = "";
  let inQuotes = false;

  const pushCell = () => {
    row.push(current.trim());
    current = "";
  };

  const pushRow = () => {
    pushCell();
    if (row.some((cell) => String(cell || "").trim().length > 0)) {
      rows.push(row);
    }
    row = [];
  };

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      pushCell();
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      pushRow();
      continue;
    }

    current += char;
  }

  if (current.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}

function pickHeaderRow(rows = []) {
  let bestIndex = 0;
  let bestScore = -1;

  rows.slice(0, 30).forEach((headers, index) => {
    const sampleRows = rows.slice(index + 1, index + 6);
    const detected = detectCsvMapping(headers, sampleRows);
    const mappedCoreFields = [
      detected.mapping.operationDate,
      detected.mapping.label,
      detected.mapping.amount || detected.mapping.debit || detected.mapping.credit,
    ].filter(Boolean).length;
    const score = (mappedCoreFields * 10) + headers.filter((header) => String(header || "").trim().length > 0).length;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function parseCsvRows(content = "") {
  const sanitized = String(content || "")
    .replace(/^\uFEFF/, "")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/[\r\n]+$/g, "");
  const delimiter = detectDelimiter(sanitized);
  const rows = parseDelimitedRows(sanitized, delimiter);
  const headerRowIndex = pickHeaderRow(rows);

  return {
    delimiter,
    rows,
    headerRowIndex,
  };
}

function detectRowWarnings(row = [], expectedLength = 0) {
  const warnings = [];

  if (expectedLength > 0 && row.length !== expectedLength) {
    warnings.push("ligne_corrompue");
  }

  return warnings;
}

function indexByHeader(headers = []) {
  return headers.reduce((accumulator, header, index) => ({
    ...accumulator,
    [header]: index,
  }), {});
}

function mapRowToRawImport(row = [], headerIndexes = {}, mapping = {}, sourceRowIndex = 0) {
  const getValue = (field) => {
    const header = mapping[field];
    if (!header && header !== "") {
      return "";
    }

    const index = headerIndexes[header];
    return index === undefined ? "" : row[index] || "";
  };

  return {
    sourceRowIndex,
    operationDate: getValue("operationDate"),
    valueDate: getValue("valueDate"),
    rawLabel: getValue("label"),
    debit: getValue("debit"),
    credit: getValue("credit"),
    amount: getValue("amount"),
    bankReference: getValue("reference"),
    balance: getValue("balance"),
    currency: "EUR",
  };
}

export function analyzeCsvContent(content = "") {
  const { delimiter, rows, headerRowIndex } = parseCsvRows(content);
  const headers = rows[headerRowIndex] || [];
  const sampleRows = rows.slice(headerRowIndex + 1, headerRowIndex + 6);
  const detected = detectCsvMapping(headers, sampleRows);

  return {
    delimiter,
    headers,
    sampleRows,
    headerRowIndex,
    rowCount: Math.max(0, rows.length - (headerRowIndex + 1)),
    ...detected,
  };
}

export function parseCsvContent(content = "", options = {}) {
  const { delimiter, rows, headerRowIndex } = parseCsvRows(content);
  const headers = rows[headerRowIndex] || [];
  if (headers.length === 0) {
    return {
      format: "csv",
      delimiter,
      headers: [],
      mapping: {},
      requiresMapping: true,
      transactions: [],
      rawRows: [],
    };
  }

  const autoDetected = detectCsvMapping(headers, rows.slice(headerRowIndex + 1, headerRowIndex + 6));
  const mapping = {
    ...autoDetected.mapping,
    ...(options.mapping || {}),
  };
  const headerIndexes = indexByHeader(headers);
  const rawRows = rows.slice(headerRowIndex + 1).map((row, index) => ({
    ...mapRowToRawImport(row, headerIndexes, mapping, headerRowIndex + index + 2),
    rowWarnings: detectRowWarnings(row, headers.length),
  }));
  const transactions = rawRows.map((row) => {
    const normalized = normalizeImportedTransaction(row, {
      sourceFormat: "csv",
      sourceFileName: options.sourceFileName || "",
      sourceBank: options.sourceBank || null,
      accountId: options.accountId || null,
    });

    if (!row.rowWarnings?.length) {
      return normalized;
    }

    return {
      ...normalized,
      importStatus: "review_required",
      warnings: [...new Set([...(normalized.warnings || []), ...row.rowWarnings])],
    };
  });

  const statementBalance = (() => {
    const candidates = rawRows
      .map((row) => parseLocalizedNumber(row.balance))
      .filter((value) => value !== null && Number.isFinite(value));
    return candidates.length > 0 ? candidates[candidates.length - 1] : null;
  })();

  return {
    format: "csv",
    delimiter,
    headers,
    mapping,
    requiresMapping: !mapping.operationDate || !mapping.label || (!mapping.amount && !mapping.debit && !mapping.credit),
    statementBalance,
    transactions,
    rawRows,
  };
}