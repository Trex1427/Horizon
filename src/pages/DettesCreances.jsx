import { useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardActions, CardContent, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import DebtReceivableForm from "../components/DebtReceivableForm.jsx";
import DebtReceivablePaymentsDialog from "../components/DebtReceivablePaymentsDialog.jsx";
import { PilotageEmptyState, PilotageHeader, PilotagePageShell, PilotageSection, PilotageSummary, PILOTAGE_COLORS } from "../components/PilotagePageLayout.jsx";
import { useDebtsReceivables } from "../hooks/useDebtsReceivables.js";
import { useThirdParties } from "../hooks/useThirdParties.js";
import { calculateDebtsReceivablesSummary } from "../services/debtsReceivablesModel.js";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
function formatCurrency(value) { return currency.format(Number.isFinite(value) ? value : 0); }
function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T00:00:00`));
}

export default function DettesCreances() {
  const { items, loading, error, create, update, remove } = useDebtsReceivables();
  const { thirdParties, addThirdParty } = useThirdParties({ includeInactive: true });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [paymentsTarget, setPaymentsTarget] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const summary = useMemo(() => calculateDebtsReceivablesSummary(items), [items]);
  const thirdPartyMap = useMemo(
    () => new Map((thirdParties || []).map((thirdParty) => [thirdParty.id, thirdParty])),
    [thirdParties],
  );

  function getThirdPartyDisplay(item) {
    if (item?.thirdPartyId) {
      const linkedThirdParty = thirdPartyMap.get(item.thirdPartyId);
      if (linkedThirdParty) {
        return `Tiers: ${linkedThirdParty.name}${linkedThirdParty.isActive === false ? " (Archive)" : ""}`;
      }
      return "Tiers: introuvable ou supprimé";
    }

    const legacyCounterparty = String(item?.counterparty || "").trim();
    if (legacyCounterparty) {
      return `Tiers (compatibilité legacy): ${legacyCounterparty}`;
    }

    return "Tiers à renseigner";
  }

  async function confirmDelete() {
    const result = await remove(deleting.id);
    if (result.success) setDeleting(null);
    else setDeleteError(result.error);
  }

  return (
    <PilotagePageShell>
      <PilotageHeader title="Dettes et créances" countLabel={`${items.length} élément${items.length > 1 ? "s" : ""}`}
        actionLabel="Ajouter" onAdd={() => { setEditing(null); setFormOpen(true); }} />
      <PilotageSummary items={[
        { label: "Dettes ouvertes", value: formatCurrency(summary.debts), color: PILOTAGE_COLORS.red },
        { label: "Créances ouvertes", value: formatCurrency(summary.receivables), color: PILOTAGE_COLORS.green },
        { label: "Solde net indicatif", value: `${summary.net > 0 ? "+" : ""}${formatCurrency(summary.net)}`, color: summary.net >= 0 ? PILOTAGE_COLORS.green : PILOTAGE_COLORS.red },
      ]} />
      {error ? <Alert severity="error">{error}</Alert> : null}
      <PilotageSection title="Éléments ouverts">
        {loading ? <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}><CircularProgress /></Box> : null}
        {!loading && items.length === 0 ? <PilotageEmptyState>Aucune dette ni créance ouverte. Ajoutez votre premier élément pour commencer.</PilotageEmptyState> : null}
        <Stack spacing={1}>
          {items.map((item) => (
            <Card key={item.id} variant="outlined">
              <CardContent>
                <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                  <Box>
                    <Typography variant="overline" color={item.type === "debt" ? "error" : "success.main"}>{item.type === "debt" ? "Dette" : "Créance"}</Typography>
                    <Typography variant="h6">{item.label}</Typography>
                    <Typography color="text.secondary">{getThirdPartyDisplay(item)}{item.dueDate ? ` · Échéance ${formatDate(item.dueDate)}` : ""}</Typography>
                    <Typography color="text.secondary">Payé: {formatCurrency(Number(item.paidAmount || 0))} · Restant: {formatCurrency(Number(item.remainingAmount || 0))}</Typography>
                    <Typography color="text.secondary">Statut: {item.functionalStatus === "paid" ? "Soldé" : item.functionalStatus === "partial" ? "Partiellement payé" : "Non payé"}</Typography>
                  </Box>
                  <Typography variant="h6" sx={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(Number(item.amount))}</Typography>
                </Stack>
              </CardContent>
              <CardActions>
                <Button onClick={() => { setPaymentsTarget(item); }}>Gérer paiements</Button>
                <Button onClick={() => { setEditing(item); setFormOpen(true); }}>Modifier</Button>
                <Button color="error" onClick={() => { setDeleteError(""); setDeleting(item); }}>Supprimer</Button>
              </CardActions>
            </Card>
          ))}
        </Stack>
      </PilotageSection>
      <DebtReceivableForm key={`${editing?.id || "new"}-${formOpen}`} open={formOpen} initialItem={editing} thirdParties={thirdParties}
        onRequestCreateThirdParty={addThirdParty} onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={(payload) => editing ? update(editing.id, payload) : create(payload)} />
      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Supprimer cet élément ?</DialogTitle>
        <DialogContent><Typography>Cette suppression est logique et n’affectera ni transaction ni budget.</Typography>{deleteError ? <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert> : null}</DialogContent>
        <DialogActions><Button onClick={() => setDeleting(null)}>Annuler</Button><Button color="error" variant="contained" onClick={confirmDelete}>Supprimer</Button></DialogActions>
      </Dialog>
      <DebtReceivablePaymentsDialog open={Boolean(paymentsTarget)} debtReceivable={paymentsTarget}
        onClose={() => setPaymentsTarget(null)} />
    </PilotagePageShell>
  );
}
