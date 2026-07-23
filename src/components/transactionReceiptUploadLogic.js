import { parseReceiptImage } from "../services/receiptParserService.js";

export async function processReceiptUpload({
  file,
  availableCategories = [],
  parseReceipt = parseReceiptImage,
  onDraftReady,
  onError,
  setUploaderError,
}) {
  if (!file) {
    return;
  }

  try {
    const parsed = await parseReceipt(file, { availableCategories });
    setUploaderError("");
    onDraftReady?.(parsed);

    if (parsed?.warning) {
      onError?.(parsed.warning);
    }
  } catch (error) {
    const errorMessage = error?.message || "Erreur lors de l'analyse du ticket";
    setUploaderError(errorMessage);
    onError?.(errorMessage);
  }
}

export async function runReceiptUploadLifecycle({
  file,
  availableCategories = [],
  parseReceipt = parseReceiptImage,
  onDraftReady,
  onError,
  setUploaderError,
  setIsParsing,
}) {
  setIsParsing(true);
  try {
    await processReceiptUpload({
      file,
      availableCategories,
      parseReceipt,
      onDraftReady,
      onError,
      setUploaderError,
    });
  } finally {
    setIsParsing(false);
  }
}
