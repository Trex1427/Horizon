import { useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useDebtReceivablePayments } from "../hooks/useDebtReceivablePayments.js";
import AccountSelector from "./AccountSelector.jsx";
import { isValidDateString } from "../services/debtsReceivablesModel.js";
import { parsePaymentAmountInput } from "../utils/paymentInput.js";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function formatCurrency(value) {
  return currency.format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T00:00:00`));
}

function toInputDate(value) {
  const today = new Date();
  const yyyy = String(today.getFullYear());
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  if (value && isValidDateString(value)) return value;
  return `${yyyy}-${mm}-${dd}`;
}

function buildEmptyForm({ accountId = "", label = "" } = {}) {
  return {
    amount: "",
    paymentDate: toInputDate(""),
    note: "",
    accountId,
    label,
  };
}
export default function DebtReceivablePaymentsDialog({
  open,
  debtReceivable,
  accounts = [],
  defaultAccount = null,
  accountsLoading = false,
  accountsError = "",
  onClose,
}) {
  const debtReceivableId = debtReceivable?.id || "";
  const { payments, loading, error, create, update, remove } = useDebtReceivablePayments(debtReceivableId);
  const [form, setForm] = useState(() => buildEmptyForm());
  const [editingId, setEditingId] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const deletingRef = useRef(false);
  const [formErrors, setFormErrors] = useState({});

  function resetLocalState() {
    setForm(buildEmptyForm());
    setEditingId("");
    setEditorOpen(false);
    setSubmitError("");
    setFormErrors({});
  }


  function startCreate() {
    setForm(buildEmptyForm({ accountId: defaultAccount?.id || "", label: debtReceivable?.label || "" }));
    setEditingId("");
    setEditorOpen(true);
    setSubmitError("");
    setFormErrors({});
  }
  function handleClose() {
    resetLocalState();
    onClose?.();
  }

  const activePayments = useMemo(
    () => (payments || []).filter((payment) => payment?.isDeleted !== true),
    [payments],
  );

  function validate() {
    const nextErrors = {};
    const amount = parsePaymentAmountInput(form.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      nextErrors.amount = "Le montant doit etre strictement superieur a zero.";
    }

    if (!form.paymentDate || !isValidDateString(form.paymentDate)) {
      nextErrors.paymentDate = "Date invalide (YYYY-MM-DD).";
    }

    if (!String(form.accountId || defaultAccount?.id || "").trim()) {
      nextErrors.accountId = "Le compte bancaire est obligatoire.";
    }

    return nextErrors;
  }

  async function handleSubmit() {
    if (submittingRef.current) return;
    const nextErrors = validate();
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError("");
    const payload = {
      amount: parsePaymentAmountInput(form.amount),
      paymentDate: form.paymentDate,
      note: String(form.note || "").trim() || null,
      accountId: form.accountId || defaultAccount?.id || "",
      label: String(form.label || "").trim(),
    };

    const result = editingId
      ? await update(editingId, payload)
      : await create(payload);

    submittingRef.current = false;
    setSubmitting(false);

    if (!result.success) {
      setSubmitError(result.error || "Impossible d'enregistrer ce paiement.");
      return;
    }

    setForm(buildEmptyForm({ accountId: defaultAccount?.id || "", label: debtReceivable?.label || "" }));
    setEditingId("");
    setEditorOpen(false);
    setFormErrors({});
  }

  function startEdit(payment) {
    if (!payment || payment.isDeleted === true) {
      return;
    }
    setEditingId(payment.id);
    setEditorOpen(true);
    setSubmitError("");
    setFormErrors({});
    setForm({
      amount: String(payment.amount ?? ""),
      paymentDate: toInputDate(payment.paymentDate),
      note: payment.note || "",
      accountId: payment.accountId || defaultAccount?.id || "",
      label: payment.label || debtReceivable?.label || "",
    });
  }

  async function handleLogicalDelete(payment) {
    if (!payment || payment.isDeleted === true || deletingRef.current) {
      return;
    }
    if (!window.confirm("Supprimer ce paiement et sa transaction liée ?")) return;
    deletingRef.current = true;
    setSubmitError("");
    const result = await remove(payment.id);
    deletingRef.current = false;
    if (!result.success) {
      setSubmitError(result.error || "Impossible de supprimer ce paiement.");
      return;
    }
    if (editingId === payment.id) {
      setEditingId("");
      setEditorOpen(false);
      setForm(buildEmptyForm({ accountId: defaultAccount?.id || "", label: debtReceivable?.label || "" }));
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Paiements partiels</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {debtReceivable?.label || "Element"}
            </Typography>
            <Typography color="text.secondary">
              Montant initial: {formatCurrency(Number(debtReceivable?.amount || 0))}
            </Typography>
            <Typography color="text.secondary">
              Montant paye: {formatCurrency(Number(debtReceivable?.paidAmount || 0))}
            </Typography>
            <Typography color="text.secondary">
              Solde restant: {formatCurrency(Number(debtReceivable?.remainingAmount || 0))}
            </Typography>
          </Box>

          {error ? <Alert severity="error">{error}</Alert> : null}
          {submitError ? <Alert severity="error">{submitError}</Alert> : null}
          {accountsError ? <Alert severity="error">Impossible de charger les comptes: {accountsError}</Alert> : null}
          {!accountsLoading && accounts.length === 0 ? (
            <Alert severity="warning">Aucun compte bancaire actif. Creez ou reactivez un compte avant d'ajouter un paiement.</Alert>
          ) : null}

          {!editorOpen ? (
            <Button variant="contained" onClick={startCreate} disabled={!debtReceivableId} sx={{ alignSelf: "flex-start" }}>
              Ajouter un paiement
            </Button>
          ) : null}

          {editorOpen ? (

          <Box sx={{ display: "grid", gap: 1 }}>
            <Typography variant="subtitle2">{editingId ? "Modifier un paiement" : "Ajouter un paiement"}</Typography>
            <TextField
              label="Montant (EUR)"
              type="text"
              inputProps={{ inputMode: "decimal" }}
              value={form.amount}
              onChange={(event) => {
                setForm((previous) => ({ ...previous, amount: event.target.value }));
                setFormErrors((previous) => ({ ...previous, amount: null }));
              }}
              error={Boolean(formErrors.amount)}
              helperText={formErrors.amount}
              size="small"
            />
            <TextField
              label="Date de paiement"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={form.paymentDate}
              onChange={(event) => {
                setForm((previous) => ({ ...previous, paymentDate: event.target.value }));
                setFormErrors((previous) => ({ ...previous, paymentDate: null }));
              }}
              error={Boolean(formErrors.paymentDate)}
              helperText={formErrors.paymentDate}
              size="small"
            />
            <TextField
              label="Libelle de la transaction"
              value={form.label}
              onChange={(event) => setForm((previous) => ({ ...previous, label: event.target.value }))}
              placeholder={debtReceivable?.label || ""}
              size="small"
            />
            <AccountSelector
              value={form.accountId || defaultAccount?.id || ""}
              accounts={accounts}
              onChange={(event) => {
                setForm((previous) => ({ ...previous, accountId: event.target.value }));
                setFormErrors((previous) => ({ ...previous, accountId: null }));
              }}
              size="small"
              sx={{ mb: 0 }}
            />
            {formErrors.accountId ? <Typography color="error" variant="caption">{formErrors.accountId}</Typography> : null}
            <TextField
              label="Note (facultative)"
              value={form.note}
              onChange={(event) => setForm((previous) => ({ ...previous, note: event.target.value }))}
              size="small"
            />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={handleSubmit} disabled={submitting || accountsLoading || accounts.length === 0 || !debtReceivableId}>
                {editingId ? "Enregistrer les modifications" : "Enregistrer le paiement"}
              </Button>
              {editingId ? (
                <Button
                  onClick={() => {
                    setEditingId("");
                    setEditorOpen(false);
                    setForm(buildEmptyForm({ accountId: defaultAccount?.id || "", label: debtReceivable?.label || "" }));
                    setFormErrors({});
                    setSubmitError("");
                  }}
                >
                  Annuler la modification
                </Button>
              ) : null}
            </Stack>
          </Box>
          ) : null}

          <Divider />

          <Typography variant="subtitle2">Historique des paiements</Typography>
          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}><CircularProgress size={24} /></Box>
          ) : null}
          {!loading && payments.length === 0 ? (
            <Typography color="text.secondary">Aucun paiement enregistre pour cet element.</Typography>
          ) : null}
          <List dense disablePadding>
            {payments.map((payment) => {
              const isDeleted = payment.isDeleted === true;
              return (
                <ListItem
                  key={payment.id}
                  divider
                  secondaryAction={
                    isDeleted
                      ? null
                      : (
                        <Stack direction="row" spacing={1}>
                          <Button size="small" onClick={() => startEdit(payment)}>Modifier</Button>
                          <Button size="small" color="error" onClick={() => handleLogicalDelete(payment)}>Supprimer</Button>
                        </Stack>
                      )
                  }
                >
                  <ListItemText
                    primary={`${formatDate(payment.paymentDate)} - ${formatCurrency(Number(payment.amount || 0))}${isDeleted ? " (supprime)" : ""}`}
                    secondary={payment.note || (isDeleted ? "Suppression logique" : "")}
                    sx={{ textDecoration: isDeleted ? "line-through" : "none", opacity: isDeleted ? 0.65 : 1 }}
                  />
                </ListItem>
              );
            })}
          </List>
          <Typography variant="caption" color="text.secondary">
            Paiements actifs: {activePayments.length}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Fermer</Button>
      </DialogActions>
    </Dialog>
  );
}
