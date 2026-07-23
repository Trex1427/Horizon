const FORMAT_EXTENSION_MAP = {
  ".csv": "csv",
  ".ofx": "ofx",
  ".qif": "qif",
  ".xlsx": "xlsx",
  ".xls": "xlsx",
  ".pdf": "pdf",
  ".xml": "camt053",
  ".camt": "camt053",
  ".sta": "mt940",
  ".mt940": "mt940",
};

function getExtension(fileName = "") {
  const normalized = String(fileName || "").trim().toLowerCase();
  const lastDot = normalized.lastIndexOf(".");
  return lastDot >= 0 ? normalized.slice(lastDot) : "";
}

function normalizeSignatureText(content = "") {
  return String(content || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function detectPdfSignature(content = "") {
  const normalized = String(content || "").trim();
  const upper = normalizeSignatureText(normalized);

  const revolutSignals = [
    "REVOLUT",
    "REVOLUT FRANCE",
    "RELEVE EUR",
    "RESUME DU SOLDE",
    "TRANSACTIONS DU COMPTE",
    "ARGENT SORTANT",
    "ARGENT ENTRANT",
  ];

  const matchedSignals = revolutSignals.filter((signal) => upper.includes(signal));
  if (matchedSignals.length >= 2) {
    return "revolut-pdf";
  }

  return upper.startsWith("%PDF-") ? "pdf" : null;
}

function detectCsvSignature(content = "") {
  const normalized = String(content || "").trim().toLowerCase();
  if (!normalized) return null;

  const firstLines = normalized.split(/\r?\n/).slice(0, 5).join("\n");
  const hasDelimitedHeader = /[,;]\s*(amount|montant|debit|d.bit|credit|cr.dit|description|libelle|libell.)/i.test(firstLines);
  const hasDateHeader = /(date|completed date|started date|date operation|date d.operation)/i.test(firstLines);
  const hasRevolutHeader = firstLines.includes("completed date")
    && firstLines.includes("description")
    && firstLines.includes("amount")
    && firstLines.includes("currency");

  return (hasRevolutHeader || (hasDelimitedHeader && hasDateHeader)) ? "csv" : null;
}

function detectQifSignature(content = "") {
  const normalized = String(content || "").trim();
  if (!/^!TYPE:(BANK|CCARD|CASH|INVST|OTH A|OTH L)\b/i.test(normalized)) {
    return false;
  }
  if (!normalized.includes("^")) {
    return false;
  }

  const records = normalized
    .split(/\r?\n\^\s*(?:\r?\n|$)/)
    .map((record) => record.trim())
    .filter(Boolean);

  return records.some((record) => (
    /^D.+$/im.test(record)
    && /^T-?\d+(?:[.,]\d+)?$/im.test(record)
    && (/^P.+$/im.test(record) || /^M.+$/im.test(record) || /^L.+$/im.test(record))
  ));
}

function detectFromContent(content = "") {
  const normalized = String(content || "").trim();
  const upper = normalized.toUpperCase();

  if (upper.startsWith("OFXHEADER:") || upper.includes("<OFX>")) {
    return "ofx";
  }

  if (upper.startsWith("<?XML") && (upper.includes("CAMT.053") || upper.includes("BKTOCSTMRSTMT"))) {
    return "camt053";
  }

  if (upper.includes(":20:") && upper.includes(":61:")) {
    return "mt940";
  }

  if (detectQifSignature(normalized)) {
    return "qif";
  }

  return null;
}

function buildPdfResult({ detectionSource = "pdf", normalizedMimeType = "", extension = "" } = {}) {
  const isRevolut = detectionSource === "revolut-pdf";
  return {
    format: "pdf",
    supported: isRevolut,
    detectionSource,
    displayLabel: isRevolut ? "PDF Revolut" : "PDF",
    sourceBank: isRevolut ? "revolut" : null,
    mimeType: normalizedMimeType,
    extension,
  };
}

export function detectFileFormat({ fileName = "", mimeType = "", content = "" } = {}) {
  const extension = getExtension(fileName);
  const byExtension = FORMAT_EXTENSION_MAP[extension] || null;
  const normalizedMimeType = String(mimeType || "").toLowerCase();

  if (byExtension) {
    if (byExtension === "pdf") {
      return buildPdfResult({
        detectionSource: detectPdfSignature(content) || "extension",
        normalizedMimeType,
        extension,
      });
    }

    return {
      format: byExtension,
      supported: byExtension === "csv",
      detectionSource: "extension",
      mimeType: normalizedMimeType,
      extension,
    };
  }

  if (normalizedMimeType.includes("pdf")) {
    return buildPdfResult({
      detectionSource: detectPdfSignature(content) || "mime",
      normalizedMimeType,
      extension,
    });
  }

  if (normalizedMimeType.includes("csv")) {
    return {
      format: "csv",
      supported: true,
      detectionSource: "mime",
      mimeType: normalizedMimeType,
      extension,
    };
  }

  const byPdfSignature = detectPdfSignature(content);
  if (byPdfSignature) {
    return buildPdfResult({
      detectionSource: byPdfSignature,
      normalizedMimeType,
      extension,
    });
  }

  const byContent = detectFromContent(content);
  if (byContent) {
    return {
      format: byContent,
      supported: byContent === "csv",
      detectionSource: "content",
      mimeType: normalizedMimeType,
      extension,
    };
  }

  const byCsvSignature = detectCsvSignature(content);
  if (byCsvSignature) {
    return {
      format: byCsvSignature,
      supported: true,
      detectionSource: "content",
      mimeType: normalizedMimeType,
      extension,
    };
  }

  return {
    format: "unknown",
    supported: false,
    detectionSource: "unknown",
    mimeType: normalizedMimeType,
    extension,
  };
}
