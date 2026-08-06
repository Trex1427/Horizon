import { Alert, Box, MenuItem, TextField, Typography } from "@mui/material";

const MAPPING_FIELDS = [
  { key: "operationDate", label: "Date operation" },
  { key: "valueDate", label: "Date valeur" },
  { key: "label", label: "Libelle" },
  { key: "debit", label: "Debit" },
  { key: "credit", label: "Credit" },
  { key: "amount", label: "Montant signe" },
  { key: "reference", label: "Reference" },
  { key: "balance", label: "Solde final (optionnel)" },
];

export default function ImportMappingStep({
  accounts = [],
  accountId = "",
  format = "csv",
  headers = [],
  mapping = {},
  requiresMapping = false,
  onAccountChange,
  onMappingChange,
}) {
  const selectedAccountId = accountId;

  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Typography variant="body2" color="text.secondary">
        {accounts.length >= 2 ? "Choisissez le compte Horizon, puis verifiez que les colonnes du releve sont bien reconnues." : "Le compte Horizon disponible est selectionne automatiquement. Verifiez les colonnes du releve."}
      </Typography>

      {accounts.length >= 2 && (
        <TextField
          select
          fullWidth
          label="Compte Horizon"
          value={accountId}
          onChange={(event) => onAccountChange?.(event.target.value)}
          size="small"
        >
          {accounts.map((account) => (
            <MenuItem key={account.id} value={account.id}>{account.name}</MenuItem>
          ))}
        </TextField>
      )}
      {format === "pdf" ? (
        <Alert severity="info">
          PDF Revolut reconnu. Les operations peuvent etre verifiees directement.
        </Alert>
      ) : requiresMapping ? (
        <Alert severity="warning">
          Certaines colonnes n'ont pas ete reconnues. Selectionnez au minimum la date, le libelle et le montant ou debit/credit.
        </Alert>
      ) : (
        <Alert severity="info">Colonnes reconnues automatiquement. Vous pouvez les corriger avant de continuer.</Alert>
      )}

      {format !== "pdf" && (
        <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" } }}>
          {MAPPING_FIELDS.map((field) => (
            <TextField
              key={field.key}
              select
              fullWidth
              label={field.label}
              value={mapping[field.key] || ""}
              onChange={(event) => onMappingChange?.(field.key, event.target.value)}
              size="small"
            >
              <MenuItem value="">Aucune</MenuItem>
              {headers.map((header) => (
                <MenuItem key={`${field.key}-${header}`} value={header}>{header}</MenuItem>
              ))}
            </TextField>
          ))}
        </Box>
      )}
    </Box>
  );
}
