import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  CASH_ADJUSTMENT_KINDS,
} from "../constants/cashBalanceConstants.js";
import {
  calculateCashAdjustmentDelta,
  parseCashAmount,
  toIsoDateString,
} from "../utils/cashBalanceAdjustment.js";

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function formatSignedCurrency(value) {
  const amount = Number(value || 0);
  const sign = amount > 0 ? "+" : "";
  return `${sign}${formatCurrency(amount)}`;
}

export default function CashBalanceAdjustmentDialog({
  open,
  mode = CASH_ADJUSTMENT_KINDS.balance,
  account,
  currentBalance = 0,
  hasHistory = false,
  onClose,
  onSubmit,
}) {
  const [date, setDate] = useState(toIsoDateString());
  const [targetBalance, setTargetBalance] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const targetAmount = useMemo(() => parseCashAmount(targetBalance), [targetBalance]);
  const delta = useMemo(
    () => calculateCashAdjustmentDelta(currentBalance, targetBalance),
    [currentBalance, targetBalance]
  );
  const isOpening = mode === CASH_ADJUSTMENT_KINDS.opening;
  const initializationBlocked = isOpening && hasHistory;
  const hasValidTarget = targetAmount !== null;
  const hasZeroDelta = hasValidTarget && delta === 0;
  const canSubmit = Boolean(account?.id)
    && hasValidTarget
    && !hasZeroDelta
    && !initializationBlocked
    && !submitting;

  function handleClose() {
    if (submitting) return;
    setTargetBalance("");
    setReason("");
    setMessage("");
    setError("");
    setDate(toIsoDateString());
    onClose?.();
  }

  async function handleSubmit() {
    if (!canSubmit) return;

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const result = await onSubmit?.({
        accountId: account.id,
        currentBalance,
        targetBalance: targetAmount,
        date,
        reason,
        kind: mode,
      });

      if (result?.success === false) {
        throw new Error(result.error || "Erreur lors de l'ajustement.");
      }

      setTargetBalance("");
      setReason("");
      setMessage("");
      setError("");
      setDate(toIsoDateString());
      onClose?.();
    } catch (err) {
      setError(err?.message || "Erreur lors de l'ajustement.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle>{isOpening ? "Initialiser le solde Espèces" : "Ajuster le solde Espèces"}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.5} sx={{ pt: 0.5 }}>
          {initializationBlocked && (
            <Alert severity="warning">
              Le compte Espèces possède déjà un historique. Utilisez plutôt Ajuster le solde.
            </Alert>
          )}

          <Box>
            <Typography variant="body2" color="text.secondary">
              Solde Horizon actuel
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {formatCurrency(currentBalance)}
            </Typography>
          </Box>

          <TextField
            label="Date du comptage"
            type="date"
            size="small"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          <TextField
            label="Solde réel compté"
            size="small"
            value={targetBalance}
            onChange={(event) => setTargetBalance(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            fullWidth
          />

          <Box>
            <Typography variant="body2" color="text.secondary">
              Ajustement calcule
            </Typography>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                color: Number(delta || 0) < 0 ? "warning.main" : "success.main",
              }}
            >
              {hasValidTarget ? formatSignedCurrency(delta) : "--"}
            </Typography>
          </Box>

          <TextField
            label="Motif facultatif"
            size="small"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            multiline
            minRows={2}
            fullWidth
          />

          {hasZeroDelta && (
            <Alert severity="info">
              Le solde Horizon correspond déjà au solde réel.
            </Alert>
          )}

          {hasValidTarget && !hasZeroDelta && !initializationBlocked && (
            <Alert severity="info">
              Une écriture d'ajustement de {formatSignedCurrency(delta)} sera créée pour porter le solde Espèces à {formatCurrency(targetAmount)}.
            </Alert>
          )}

          {message && <Alert severity="success">{message}</Alert>}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>Annuler</Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!canSubmit}>
          {submitting ? "Enregistrement..." : isOpening ? "Confirmer l'initialisation" : "Confirmer l'ajustement"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
