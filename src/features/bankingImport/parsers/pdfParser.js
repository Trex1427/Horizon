import { parseLocalizedNumber } from "../normalizers/normalizeAmount.js";
import { normalizeImportedTransaction } from "../normalizers/normalizeImportedTransaction.js";

const MONTHS = {
  janvier: "01",
  janv: "01",
  fevrier: "02",
  fevr: "02",
  mars: "03",
  avril: "04",
  avr: "04",
  mai: "05",
  juin: "06",
  juillet: "07",
  juil: "07",
  aout: "08",
  septembre: "09",
  sept: "09",
  octobre: "10",
  oct: "10",
  novembre: "11",
  nov: "11",
  decembre: "12",
  dec: "12",
};

function stripDiacritics(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeText(value = "") {
  return stripDiacritics(value)
    .replace(/\u00A0|\u202F/g, " ")
    .replace(/[€]/g, " EUR")
    .replace(/\r/g, "\n");
}

function bytesToBinaryString(bytes) {
  const chunks = [];
  const chunkSize = 8192;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    chunks.push(String.fromCharCode(...bytes.slice(index, index + chunkSize)));
  }
  return chunks.join("");
}

function binaryStringToBytes(value = "") {
  const bytes = new Uint8Array(value.length);
  for (let index = 0; index < value.length; index += 1) {
    bytes[index] = value.charCodeAt(index) & 0xff;
  }
  return bytes;
}

async function inflateBytes(bytes) {
  if (typeof process !== "undefined" && process.versions?.node) {
    const zlib = await import("node:zlib");
    return new Uint8Array(zlib.inflateSync(Buffer.from(bytes)));
  }

  if (typeof DecompressionStream === "undefined") {
    return null;
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

function extractRawStreams(binary = "") {
  const streams = [];
  const regex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match = regex.exec(binary);
  while (match) {
    streams.push(match[1]);
    match = regex.exec(binary);
  }
  return streams;
}

async function inflatePdfStreams(binary = "") {
  const inflated = [];
  for (const stream of extractRawStreams(binary)) {
    try {
      const bytes = binaryStringToBytes(stream);
      const output = await inflateBytes(bytes);
      if (output) {
        inflated.push(bytesToBinaryString(output));
      }
    } catch {
      // Non-Flate streams are ignored by this lightweight extractor.
    }
  }
  return inflated;
}

function parseCMap(inflatedStreams = []) {
  const map = new Map();
  const cmapText = inflatedStreams.filter((stream) => stream.includes("beginbfchar") || stream.includes("beginbfrange")).join("\n");

  for (const match of cmapText.matchAll(/<([0-9A-Fa-f]{4})>\s*<([0-9A-Fa-f]{4})>/g)) {
    const source = parseInt(match[1], 16);
    const target = parseInt(match[2], 16);
    if (Number.isFinite(source) && Number.isFinite(target)) {
      map.set(source, String.fromCharCode(target));
    }
  }

  for (const match of cmapText.matchAll(/<([0-9A-Fa-f]{4})>\s*<([0-9A-Fa-f]{4})>\s*<([0-9A-Fa-f]{4})>/g)) {
    const start = parseInt(match[1], 16);
    const end = parseInt(match[2], 16);
    const targetStart = parseInt(match[3], 16);
    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(targetStart)) {
      continue;
    }
    for (let code = start; code <= end; code += 1) {
      map.set(code, String.fromCharCode(targetStart + (code - start)));
    }
  }

  return map;
}

function decodePdfLiteralWithCMap(value = "", cmap = new Map()) {
  const decoded = decodePdfLiteral(value);
  if (!cmap.size || decoded.length < 2) {
    return decoded;
  }

  let mapped = "";
  let mappedCount = 0;
  for (let index = 0; index + 1 < decoded.length; index += 2) {
    const code = ((decoded.charCodeAt(index) & 0xff) << 8) + (decoded.charCodeAt(index + 1) & 0xff);
    const char = cmap.get(code);
    if (char) {
      mapped += char;
      mappedCount += 1;
    } else {
      mapped += " ";
    }
  }

  return mappedCount > 0 ? mapped : decoded;
}

function extractPdfLiteralsWithCMap(content = "", cmap = new Map()) {
  const literals = [];
  const regex = /\((?:\\.|[^\\)])*\)\s*Tj/g;
  let match = regex.exec(content);
  while (match) {
    const literal = match[0].replace(/\s*Tj$/, "").slice(1, -1);
    literals.push(decodePdfLiteralWithCMap(literal, cmap));
    match = regex.exec(content);
  }
  return literals.join("\n");
}

function decodePdfLiteral(value = "") {
  return value
    .replace(/\\([nrtbf()\\])/g, (_, escaped) => {
      const map = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" };
      return map[escaped] || escaped;
    })
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
}

function extractPdfLiterals(content = "") {
  const literals = [];
  const regex = /\((?:\\.|[^\\)])*\)/g;
  let match = regex.exec(content);
  while (match) {
    literals.push(decodePdfLiteral(match[0].slice(1, -1)));
    match = regex.exec(content);
  }
  return literals.join("\n");
}

export function extractPdfText(content = "") {
  const raw = String(content || "");
  const literalText = extractPdfLiterals(raw);
  return normalizeText([raw, literalText].filter(Boolean).join("\n"));
}

export async function extractPdfTextFromBytes(bytes = new Uint8Array()) {
  const safeBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  const rawBinary = bytesToBinaryString(safeBytes);
  const inflatedStreams = await inflatePdfStreams(rawBinary);
  const cmap = parseCMap(inflatedStreams);
  const inflatedText = inflatedStreams
    .map((stream) => extractPdfLiteralsWithCMap(stream, cmap))
    .filter(Boolean)
    .join("\n");

  if (inflatedText.trim()) {
    return normalizeText(inflatedText);
  }

  return normalizeText(extractPdfLiterals(rawBinary));
}

function parseFrenchDate(value = "") {
  const normalized = stripDiacritics(value).toLowerCase().replace(/[.,]/g, " ").replace(/\s+/g, " ").trim();

  let match = normalized.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${month}-${day}`;
  }

  match = normalized.match(/\b(\d{1,2})(?:er)?\s+([a-z]+)\s+(\d{4})\b/);
  if (!match) {
    return null;
  }

  const month = MONTHS[match[2]];
  return month ? `${match[3]}-${month}-${match[1].padStart(2, "0")}` : null;
}

function isTransactionDateLine(line = "") {
  const normalized = stripDiacritics(line).toLowerCase().trim();
  return /^(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{1,2}(?:er)?\s+[a-z]+)/.test(normalized)
    && Boolean(parseFrenchDate(line));
}

function parseStatementPeriod(text = "") {
  const normalized = stripDiacritics(text).replace(/\s+/g, " ");
  const match = normalized.match(/(\d{1,2}(?:er)?\s+[a-zA-Z]+\s+\d{4})\s+au\s+(\d{1,2}(?:er)?\s+[a-zA-Z]+\s+\d{4})/i);
  if (!match) {
    return null;
  }

  return {
    startDate: parseFrenchDate(match[1]),
    endDate: parseFrenchDate(match[2]),
  };
}

function parseSummaryAmount(text = "", label = "") {
  const normalized = normalizeText(text).replace(/\s+/g, " ");
  const escapedLabel = stripDiacritics(label).replace(/\s+/g, "\\s+");
  const match = normalized.match(new RegExp(`${escapedLabel}\\s*:?[\\s\\S]{0,40}?(-?\\d[\\d\\s.,]*\\s*(?:EUR)?)`, "i"));
  return match ? parseLocalizedNumber(match[1]) : null;
}

function parseStatementSummary(text = "") {
  const normalized = normalizeText(text).replace(/\s+/g, " ");
  const summaryStart = normalized.indexOf("Resume du solde");
  const summaryEnd = normalized.indexOf("Transactions du compte", summaryStart);
  if (summaryStart < 0 || summaryEnd < 0) {
    return {
      openingBalance: parseSummaryAmount(text, "solde d'ouverture"),
      totalOutgoing: parseSummaryAmount(text, "argent sortant"),
      totalIncoming: parseSummaryAmount(text, "argent entrant"),
      closingBalance: parseSummaryAmount(text, "solde de cloture"),
    };
  }

  const summaryBlock = normalized.slice(summaryStart, summaryEnd);
  const totalMatch = summaryBlock.match(/Total\s+(-?\d[\d\s.,]*\s*EUR)\s+(-?\d[\d\s.,]*\s*EUR)\s+(-?\d[\d\s.,]*\s*EUR)\s+(-?\d[\d\s.,]*\s*EUR)/i);
  const accountMatch = summaryBlock.match(/Compte\s*\([^)]*\)\s+(-?\d[\d\s.,]*\s*EUR)\s+(-?\d[\d\s.,]*\s*EUR)\s+(-?\d[\d\s.,]*\s*EUR)\s+(-?\d[\d\s.,]*\s*EUR)/i);
  const match = totalMatch || accountMatch;

  if (!match) {
    return {
      openingBalance: parseSummaryAmount(summaryBlock, "solde d'ouverture"),
      totalOutgoing: parseSummaryAmount(summaryBlock, "argent sortant"),
      totalIncoming: parseSummaryAmount(summaryBlock, "argent entrant"),
      closingBalance: parseSummaryAmount(summaryBlock, "solde de cloture"),
    };
  }

  return {
    openingBalance: parseLocalizedNumber(match[1]),
    totalOutgoing: parseLocalizedNumber(match[2]),
    totalIncoming: parseLocalizedNumber(match[3]),
    closingBalance: parseLocalizedNumber(match[4]),
  };
}

function cleanDescription(lines = []) {
  return lines
    .map((line) => line.replace(/\b(?:Argent sortant|Argent entrant|Solde)\b.*$/i, "").trim())
    .filter(Boolean)
    .filter((line) => !/^(date|description|argent sortant|argent entrant|solde|transactions du compte|page \d+)$/i.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAmounts(lines = []) {
  const joined = lines.join(" ");
  const outgoingMatch = joined.match(/Argent sortant\s*:?\s*(-?\d[\d\s.,]*\s*(?:EUR)?)/i);
  const incomingMatch = joined.match(/Argent entrant\s*:?\s*(-?\d[\d\s.,]*\s*(?:EUR)?)/i);
  const balanceMatch = joined.match(/Solde\s*:?\s*(-?\d[\d\s.,]*\s*(?:EUR)?)/i);

  if (outgoingMatch || incomingMatch) {
    return {
      debit: outgoingMatch ? outgoingMatch[1] : "",
      credit: incomingMatch ? incomingMatch[1] : "",
      balance: balanceMatch ? balanceMatch[1] : "",
    };
  }

  const amountMatches = [...joined.matchAll(/(?<![A-Za-z0-9])-?\d[\d\s]*[,.]\d{2}\s*(?:EUR)?/gi)].map((match) => match[0]);
  if (amountMatches.length < 2) {
    return { debit: "", credit: "", balance: "" };
  }

  const transactionAmount = amountMatches[amountMatches.length - 2];
  const balance = amountMatches[amountMatches.length - 1];
  const isIncoming = /\b(de|remboursement|refund|recu|entrant|virement recu)\b/i.test(joined);
  return {
    debit: isIncoming ? "" : transactionAmount,
    credit: isIncoming ? transactionAmount : "",
    balance,
  };
}

function shouldSkipRow(lines = []) {
  const joined = lines.join(" ").toLowerCase();
  return /resume du solde|solde d.ouverture|solde de cloture|iban|bic/.test(joined);
}

function buildWarnings(lines = []) {
  const joined = stripDiacritics(lines.join(" ")).toLowerCase();
  const warnings = [];
  if (/\brenvoye\b|\bretourne\b|\breturned\b/.test(joined)) {
    warnings.push("operation_renvoyee_a_verifier");
  }
  if (/\bremboursement\b|\brefund\b/.test(joined)) {
    warnings.push("remboursement_a_verifier");
  }
  return warnings;
}

function parseTransactionBlocks(lines = []) {
  const blocks = [];
  let current = null;
  let skippingRepeatedPageHeader = false;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }

    if (current && /^releve eur$/i.test(stripDiacritics(trimmed))) {
      skippingRepeatedPageHeader = true;
      return;
    }

    if (skippingRepeatedPageHeader) {
      if (/^solde$/i.test(stripDiacritics(trimmed))) {
        skippingRepeatedPageHeader = false;
      }
      return;
    }

    if (isTransactionDateLine(trimmed)) {
      if (current) {
        blocks.push(current);
      }
      current = [trimmed];
      return;
    }

    if (current) {
      current.push(trimmed);
    }
  });

  if (current) {
    blocks.push(current);
  }

  return blocks;
}

function getTransactionLines(lines = []) {
  const returnedSectionIndex = lines.findIndex((line) => /^renvoye de\b/i.test(stripDiacritics(line)));
  return returnedSectionIndex >= 0 ? lines.slice(0, returnedSectionIndex) : lines;
}

export function parsePdfContent(content = "", options = {}) {
  const text = extractPdfText(content);
  const statementSummary = parseStatementSummary(text);
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const transactions = parseTransactionBlocks(getTransactionLines(lines))
    .filter((block) => !shouldSkipRow(block))
    .map((block, index) => {
      const { debit, credit, balance } = parseAmounts(block);
      const warnings = buildWarnings(block);
      const normalized = normalizeImportedTransaction({
        sourceRowIndex: index + 1,
        operationDate: parseFrenchDate(block[0]) || block[0],
        rawLabel: cleanDescription(block.slice(1)),
        debit,
        credit,
        balance,
        bankReference: (block.join(" ").match(/\b(?:Reference|Ref)\s*:?\s*([A-Z0-9-]+)/i) || [])[1] || "",
        currency: "EUR",
      }, {
        sourceFormat: "pdf",
        sourceBank: "revolut",
        sourceFileName: options.sourceFileName || "",
        accountId: options.accountId || null,
      });

      if (warnings.length === 0) {
        return normalized;
      }

      return {
        ...normalized,
        importStatus: "review_required",
        warnings: [...new Set([...(normalized.warnings || []), ...warnings])],
      };
    })
    .filter((transaction) => transaction.rawLabel || transaction.amount !== null);

  return {
    format: "pdf",
    sourceBank: "revolut",
    headers: ["Date", "Description", "Argent sortant", "Argent entrant", "Solde"],
    mapping: {},
    requiresMapping: false,
    statementPeriod: parseStatementPeriod(text),
    statementSummary,
    statementBalance: statementSummary.closingBalance,
    transactions,
    rawRows: transactions,
    extractedText: text,
  };
}
