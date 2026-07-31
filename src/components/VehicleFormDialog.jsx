import { useEffect, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from "@mui/material";

export default function VehicleFormDialog({ open, title = "Ajouter un véhicule", initialName = "", onClose, onSave }) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) { setName(initialName); setError(""); } }, [open, initialName]);
  const normalizedName = name.trim();
  const submit = async (event) => {
    event?.preventDefault();
    if (!normalizedName || saving) return;
    setSaving(true); setError("");
    const result = await onSave(normalizedName);
    setSaving(false);
    if (result.success) onClose(); else setError(result.error || "Enregistrement impossible.");
  };
  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="xs">
    <DialogTitle>{title}</DialogTitle>
    <DialogContent><form id="vehicle-form" onSubmit={submit}><Stack spacing={2} sx={{ pt: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField autoFocus required label="Nom du véhicule" value={name} onChange={(event) => setName(event.target.value)} fullWidth />
    </Stack></form></DialogContent>
    <DialogActions sx={{ p: 2 }}><Button disabled={saving} onClick={onClose}>Annuler</Button><Button type="submit" form="vehicle-form" disabled={!normalizedName || saving} variant="contained">{saving ? "Enregistrement…" : "Enregistrer"}</Button></DialogActions>
  </Dialog>;
}
