import { Alert, Box, Button, Stack, Typography } from "@mui/material";

export default function ImportSummaryStep({ result = null, recurringCandidates = [], reconciliation = null, onClose, onViewTransactions, onViewHistory }) {
  if (!result) {
    return <Alert severity="info">Aucun resume d'import disponible.</Alert>;
  }

  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Alert severity={result.errorCount > 0 ? "warning" : "success"}>
        Import termine
      </Alert>

      <Typography variant="body2">{result.importedCount} operations importees</Typography>
      <Typography variant="body2">{result.importedTransferCount || 0} transfert(s) créé(s)</Typography>
      <Typography variant="body2">{result.duplicateCount} doublons ignores ou revus</Typography>
      <Typography variant="body2">{result.skippedCount} lignes non importees</Typography>
      <Typography variant="body2">{result.errorCount} erreur(s)</Typography>

      {reconciliation && (
        <Alert severity="info">
          Solde Horizon apres import : {reconciliation.horizonBalance.toFixed(2)} € • Solde releve : {reconciliation.statementBalance.toFixed(2)} € • Ecart : {reconciliation.delta.toFixed(2)} €
        </Alert>
      )}

      {recurringCandidates.length > 0 && (
        <Box sx={{ display: "grid", gap: 0.75 }}>
          <Typography variant="subtitle2">Candidats récurrents</Typography>
          {recurringCandidates.map((candidate) => (
            <Typography key={`${candidate.label}-${candidate.amount}`} variant="body2">
              {candidate.label} • {candidate.amount.toFixed(2)} € • {candidate.count} occurrence(s)
            </Typography>
          ))}
        </Box>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button variant="contained" onClick={onViewTransactions}>Voir les transactions importees</Button>
        <Button variant="outlined" onClick={onViewHistory}>Voir l'historique des imports</Button>
        <Button onClick={onClose}>Fermer</Button>
      </Stack>
    </Box>
  );
}