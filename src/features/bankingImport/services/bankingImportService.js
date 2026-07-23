import { detectFileFormat } from "../detectors/detectFileFormat.js";
import { extractPdfTextFromBytes } from "../parsers/pdfParser.js";
import {
  buildCsvImportPreview,
  buildImportValidationRows,
  buildPdfImportPreview,
  prepareCsvImportAnalysis,
  preparePdfImportAnalysis,
} from "./importPreviewService.js";

function getExtension(fileName = "") {
  const normalized = String(fileName || "").trim().toLowerCase();
  const lastDot = normalized.lastIndexOf(".");
  return lastDot >= 0 ? normalized.slice(lastDot) : "";
}

function isPdfCandidate({ fileName = "", mimeType = "", content = "" } = {}) {
  return getExtension(fileName) === ".pdf"
    || String(mimeType || "").toLowerCase().includes("pdf")
    || String(content || "").trim().startsWith("%PDF-");
}

function countPdfPages(content = "") {
  const countMatch = String(content || "").match(/\/Count\s+(\d+)/);
  if (countMatch) {
    return Number(countMatch[1]);
  }

  return (String(content || "").match(/\/Type\s*\/Page\b/g) || []).length;
}

function pushBankImportDiagnostic(payload = {}) {
  if (typeof window === "undefined") {
    return;
  }

  window.__horizonBankImportDiagnostics = window.__horizonBankImportDiagnostics || [];
  window.__horizonBankImportDiagnostics.push(payload);
}

function firstExtractedLines(content = "", limit = 100) {
  const text = String(content || "");
  const anchors = ["Releve EUR", "Resume du solde", "Transactions du compte", "Revolut France"];
  const anchorIndexes = anchors
    .map((anchor) => text.indexOf(anchor))
    .filter((index) => index >= 0);
  const meaningfulText = anchorIndexes.length > 0 ? text.slice(Math.min(...anchorIndexes)) : text;

  return meaningfulText
    .split(/\r?\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function logPdfDiagnostic(details = {}) {
  if (typeof console === "undefined") {
    return;
  }

  const payload = {
    stage: details.stage || "pdf-analysis",
    extension: details.extension || "",
    mime: details.mime || "",
    pdfSignature: details.pdfSignature || false,
    detectedFormat: details.detectedFormat || null,
    parserChosen: details.parserChosen || null,
    choiceReason: details.choiceReason || "",
    pageCount: details.pageCount || 0,
    extractedTextLength: details.extractedTextLength || 0,
    firstExtractedLines: details.firstExtractedLines || [],
    transactionCount: details.transactionCount ?? null,
    transactionsKept: details.transactionsKept ?? null,
    transactionsRejected: details.transactionsRejected ?? null,
    rejectionReasons: details.rejectionReasons || [],
    sentToPreview: details.sentToPreview ?? null,
    displayedInPreview: details.displayedInPreview ?? null,
  };

  console.info("[bank-import:pdf-diagnostic]", payload);
  pushBankImportDiagnostic(payload);
}

function logWorkflowDiagnostic(payload = {}) {
  if (typeof console === "undefined") {
    return;
  }

  console.info("[bank-import:workflow-diagnostic]", payload);
  pushBankImportDiagnostic(payload);
}

function summarizeValidationRows(rows = []) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const kept = safeRows.filter((row) => row.userDecision === "import" && !row.validationError);
  const rejected = safeRows.filter((row) => row.userDecision !== "import" || row.validationError);

  return {
    detected: safeRows.length,
    kept: kept.length,
    rejected: rejected.length,
    rejectionReasons: rejected.map((row) => ({
      sourceRowIndex: row.sourceRowIndex,
      date: row.operationDate || "",
      description: row.rawLabel || "",
      amount: row.amount ?? null,
      type: row.type || "",
      status: "rejetee",
      reason: row.validationError || row.duplicateReason || `decision_${row.userDecision}`,
    })),
    transactions: safeRows.map((row) => ({
      sourceRowIndex: row.sourceRowIndex,
      date: row.operationDate || "",
      description: row.rawLabel || "",
      amount: row.amount ?? null,
      type: row.type || "",
      status: row.userDecision === "import" && !row.validationError ? "conservee" : "rejetee",
      rejectionReason: row.userDecision === "import" && !row.validationError
        ? ""
        : (row.validationError || row.duplicateReason || `decision_${row.userDecision}`),
    })),
  };
}

export async function analyzeBankFile(file) {
  const fileBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(fileBuffer);
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  const rawContent = utf8.includes("\uFFFD")
    ? new TextDecoder("windows-1252").decode(bytes)
    : utf8;
  const pdfCandidate = isPdfCandidate({
    fileName: file?.name || "",
    mimeType: file?.type || "",
    content: rawContent,
  });
  const extractedPdfText = pdfCandidate ? await extractPdfTextFromBytes(bytes) : "";
  const detectionContent = pdfCandidate
    ? [rawContent, extractedPdfText].filter(Boolean).join("\n")
    : rawContent;
  const content = pdfCandidate ? extractedPdfText : rawContent;
  const formatInfo = detectFileFormat({
    fileName: file?.name || "",
    mimeType: file?.type || "",
    content: detectionContent,
  });

  if (formatInfo.format === "pdf" && formatInfo.supported && formatInfo.sourceBank === "revolut") {
    const analysis = preparePdfImportAnalysis({ content, fileName: file?.name || "" });
    logPdfDiagnostic({
      extension: getExtension(file?.name || ""),
      mime: file?.type || "",
      pdfSignature: rawContent.trim().startsWith("%PDF-"),
      detectedFormat: formatInfo,
      parserChosen: "pdf-revolut",
      choiceReason: "formatInfo.sourceBank === revolut && formatInfo.supported === true",
      pageCount: countPdfPages(rawContent),
      extractedTextLength: extractedPdfText.length,
      firstExtractedLines: firstExtractedLines(extractedPdfText),
      transactionCount: analysis.rowCount,
    });

    return {
      formatInfo,
      content,
      analysis,
    };
  }

  if (pdfCandidate) {
    logPdfDiagnostic({
      extension: getExtension(file?.name || ""),
      mime: file?.type || "",
      pdfSignature: rawContent.trim().startsWith("%PDF-"),
      detectedFormat: formatInfo,
      parserChosen: null,
      choiceReason: "PDF non reconnu comme Revolut supporte par detectFileFormat",
      pageCount: countPdfPages(rawContent),
      extractedTextLength: extractedPdfText.length,
      firstExtractedLines: firstExtractedLines(extractedPdfText),
      transactionCount: null,
    });
  }

  if (formatInfo.format !== "csv") {
    return {
      formatInfo,
      content,
      analysis: null,
    };
  }

  return {
    formatInfo,
    content,
    analysis: prepareCsvImportAnalysis({ content, fileName: file?.name || "" }),
  };
}

export function buildBankImportPreview({ format = "unknown", content = "", fileName = "", accountId = "", mapping = {}, structureKey = "" } = {}) {
  if (format === "pdf") {
    const preview = buildPdfImportPreview({
      content,
      fileName,
      accountId,
    });
    logWorkflowDiagnostic({
      stage: "preview-built",
      format,
      parserChosen: "pdf-revolut",
      sentToPreview: preview.transactions.length,
      statementPeriod: preview.statementPeriod || null,
      statementSummary: preview.statementSummary || null,
    });
    return preview;
  }

  if (format !== "csv") {
    throw new Error("Format non supporte dans cette premiere fondation.");
  }

  return buildCsvImportPreview({
    content,
    fileName,
    accountId,
    mapping,
    structureKey,
  });
}

export function buildBankImportValidationRows({ preview = null, existingTransactions = [], categories = [], subcategories = [], activities = [], thirdParties = [], projects = [], accounts = [] } = {}) {
  const rows = buildImportValidationRows({
    preview,
    existingTransactions,
    categories,
    subcategories,
    activities,
    thirdParties,
    projects,
    accounts,
  });
  const summary = summarizeValidationRows(rows);
  logWorkflowDiagnostic({
    stage: "validation-built",
    detectedTransactions: summary.detected,
    transactionsKept: summary.kept,
    transactionsRejected: summary.rejected,
    rejectionReasons: summary.rejectionReasons,
    transactions: summary.transactions,
  });
  return rows;
}
