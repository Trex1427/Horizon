import { Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { validateTransferPayload } from "../utils/transferValidation";

function getInitialForm(defaultSourceAccountId = "") {
  return {
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    sourceAccountId: defaultSourceAccountId,
    destinationAccountId: "",
    description: "",
    notes: "",
  };
}

export default function TransferForm({
  accounts = [],
  defaultSourceAccountId = "",
  initialValues = null,
  onSubmit,
  submitting = false,
  title = "Transfert interne",
  submitLabel = "Enregistrer le transfert",
}) {
  const [form, setForm] = useState(() => ({
    ...getInitialForm(defaultSourceAccountId),
    ...(initialValues || {}),
    amount: initialValues?.amount !== undefined ? String(initialValues.amount) : "",
  }));
  const validationMessage = useMemo(() => validateTransferPayload(form), [form]);

  useEffect(() => {
    setForm({
      ...getInitialForm(defaultSourceAccountId),
      ...(initialValues || {}),
      amount: initialValues?.amount !== undefined ? String(initialValues.amount) : "",
    });
  }, [defaultSourceAccountId, initialValues]);

  function handleChange(event) {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (validationMessage || !onSubmit) {
      return;
    }

    await onSubmit({
      ...form,
      amount: Number(form.amount),
    });

    setForm(getInitialForm(defaultSourceAccountId));
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 1.5 }}>{title}</Typography>

        <Stack component="form" spacing={1.25} onSubmit={handleSubmit}>
          <TextField label="Date" name="date" type="date" value={form.date} onChange={handleChange} InputLabelProps={{ shrink: true }} size="small" />
          <TextField label="Montant" name="amount" type="number" value={form.amount} onChange={handleChange} size="small" />
          <TextField label="Compte source" name="sourceAccountId" value={form.sourceAccountId} onChange={handleChange} select size="small">
            <MenuItem value="">Selectionner</MenuItem>
            {accounts.map((account) => (
              <MenuItem key={account.id} value={account.id}>{account.name}</MenuItem>
            ))}
          </TextField>
          <TextField label="Compte destination" name="destinationAccountId" value={form.destinationAccountId} onChange={handleChange} select size="small">
            <MenuItem value="">Selectionner</MenuItem>
            {accounts.map((account) => (
              <MenuItem key={account.id} value={account.id}>{account.name}</MenuItem>
            ))}
          </TextField>
          <TextField label="Description" name="description" value={form.description} onChange={handleChange} size="small" />
          <TextField label="Notes" name="notes" value={form.notes} onChange={handleChange} size="small" multiline minRows={2} />

          {validationMessage && (
            <Typography variant="caption" color="error.main">{validationMessage}</Typography>
          )}

          <Button type="submit" variant="contained" disabled={Boolean(validationMessage) || submitting}>
            {submitLabel}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}
