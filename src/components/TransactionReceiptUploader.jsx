import { useEffect, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { parseReceiptImage } from "../services/receiptParserService";
import { runReceiptUploadLifecycle } from "./transactionReceiptUploadLogic.js";

export default function TransactionReceiptUploader({
  onDraftReady,
  onError,
  autoOpenTrigger = 0,
  availableCategories = [],
}) {
  const [isParsing, setIsParsing] = useState(false);
  const [uploaderError, setUploaderError] = useState("");
  const inputRef = useRef(null);
  const lastFileRef = useRef(null);

  useEffect(() => {
    if (!autoOpenTrigger || isParsing) {
      return;
    }

    inputRef.current?.click();
  }, [autoOpenTrigger, isParsing]);

  async function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    lastFileRef.current = file;

    await runReceiptUploadLifecycle({
      file,
      availableCategories,
      parseReceipt: parseReceiptImage,
      onDraftReady,
      onError,
      setUploaderError,
      setIsParsing,
    });

    event.target.value = "";
  }

  async function handleRetry() {
    const lastFile = lastFileRef.current;
    if (!lastFile || isParsing) {
      return;
    }

    await runReceiptUploadLifecycle({
      file: lastFile,
      availableCategories,
      parseReceipt: parseReceiptImage,
      onDraftReady,
      onError,
      setUploaderError,
      setIsParsing,
    });
  }

  return (
    <Box sx={{ mb: 1.25 }}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />

      <Button
        type="button"
        variant="outlined"
        onClick={() => inputRef.current?.click()}
        disabled={isParsing}
        fullWidth
        size="small"
        sx={{ minHeight: 40 }}
      >
        Ajouter depuis ticket
      </Button>

      {isParsing && (
        <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Analyse du ticket en cours...
          </Typography>
        </Box>
      )}

      {!isParsing && uploaderError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>{uploaderError}</Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={handleRetry}>Reessayer</Button>
            <Button size="small" onClick={() => setUploaderError("")}>Fermer</Button>
          </Stack>
        </Alert>
      )}
    </Box>
  );
}
