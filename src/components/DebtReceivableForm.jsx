import { useRef, useState } from "react";
import { MenuItem, Stack, TextField } from "@mui/material";
import EntityDialog from "./EntityDialog.jsx";
import { validateDebtReceivable } from "../services/debtsReceivablesModel.js";

const emptyForm = { type: "debt", label: "", amount: "", counterparty: "", dueDate: "", notes: "" };

export default function DebtReceivableForm({ open, initialItem, onClose, onSubmit }) {
  const [form, setForm] = useState(() => initialItem ? {
    type: initialItem.type || "debt", label: initialItem.label || "", amount: String(initialItem.amount ?? ""),
    counterparty: initialItem.counterparty || "", dueDate: initialItem.dueDate || "", notes: initialItem.notes || "",
  } : emptyForm);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  function change(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: null }));
  }

  async function submit() {
    if (submittingRef.current) return;
    const nextErrors = validateDebtReceivable(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError("");
    const result = await onSubmit(form);
    if (result.success) onClose();
    else setSubmitError(result.error || "Impossible d’enregistrer cet élément.");
    submittingRef.current = false;
    setSubmitting(false);
  }

  return (
    <EntityDialog open={open} title={initialItem ? "Modifier l’élément" : "Ajouter une dette ou créance"} onClose={onClose}
      onSubmit={submit} submitting={submitting} errorMessage={submitError} maxWidth="sm">
      <Stack spacing={2} sx={{ mt: 1 }}>
        <TextField select label="Type" name="type" value={form.type} onChange={change} error={Boolean(errors.type)} helperText={errors.type}>
          <MenuItem value="debt">Dette</MenuItem><MenuItem value="receivable">Créance</MenuItem>
        </TextField>
        <TextField label="Libellé" name="label" value={form.label} onChange={change} error={Boolean(errors.label)} helperText={errors.label} />
        <TextField label="Montant (€)" name="amount" type="number" inputProps={{ min: "0.01", step: "0.01" }} value={form.amount} onChange={change} error={Boolean(errors.amount)} helperText={errors.amount} />
        <TextField label="Contrepartie" name="counterparty" value={form.counterparty} onChange={change} error={Boolean(errors.counterparty)} helperText={errors.counterparty} />
        <TextField label="Date d’échéance (facultative)" name="dueDate" type="date" InputLabelProps={{ shrink: true }} value={form.dueDate} onChange={change} error={Boolean(errors.dueDate)} helperText={errors.dueDate} />
        <TextField label="Notes (facultatives)" name="notes" multiline minRows={3} value={form.notes} onChange={change} />
      </Stack>
    </EntityDialog>
  );
}
