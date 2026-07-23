import { Alert, Box, Typography } from "@mui/material";
import { useAccounts } from "../hooks/useAccounts";
import { useTransactions } from "../hooks/useTransactions";
import ImportHistorySection from "../features/bankingImport/components/ImportHistorySection";

export default function ImportHistory() {
  const { accounts = [], loading: accountsLoading, error: accountsError } = useAccounts();
  const { transactions = [], loading: transactionsLoading, error: transactionsError } = useTransactions();
  const loading = accountsLoading || transactionsLoading;
  const error = accountsError || transactionsError;

  return (
    <Box sx={{ display: "grid", gap: 1.5 }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Historique des imports
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Annulation sécurisée des lots d'import bancaire.
        </Typography>
      </Box>
      {loading && <Alert severity="info">Chargement de l'historique…</Alert>}
      {error && <Alert severity="error">{error}</Alert>}
      {!error && <ImportHistorySection accounts={accounts} transactions={transactions} />}
    </Box>
  );
}
