import { Box, Grid, Stack, Typography } from "@mui/material";
import SummaryCard from "./SummaryCard";
import TransactionList from "./TransactionList";
import CategorySummary from "./CategorySummary";
import { getSafeCategoryLabel } from "../utils/displayTextUtils";

function formatCurrency(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}

export default function FinancialDashboard({ metrics }) {
  const {
    balance,
    remaining,
    totalRevenue,
    totalExpense,
    transactionCount,
    recentTransactions,
    categorySummary,
    largestExpense,
    largestRevenue,
    mostExpensiveCategory,
  } = metrics;

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <SummaryCard title="Trésorerie" value={formatCurrency(balance)} color={balance >= 0 ? "success.main" : "error.main"} subtitle="Solde actuel" />
        </Grid>
        <Grid item xs={12} md={6}>
          <SummaryCard title="Reste à vivre" value={formatCurrency(remaining)} color={remaining >= 0 ? "success.main" : "error.main"} subtitle="Sur le mois" />
        </Grid>
        <Grid item xs={12} md={4}>
          <SummaryCard title="Revenus du mois" value={formatCurrency(totalRevenue)} color="success.main" />
        </Grid>
        <Grid item xs={12} md={4}>
          <SummaryCard title="Dépenses du mois" value={formatCurrency(totalExpense)} color="error.main" />
        </Grid>
        <Grid item xs={12} md={4}>
          <SummaryCard title="Transactions du mois" value={transactionCount} color="primary.main" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
              5 dernières transactions
            </Typography>
            <TransactionList transactions={recentTransactions} />
          </Box>
        </Grid>

        <Grid item xs={12} md={5}>
          <Stack spacing={2}>
            <Box>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
                Résumé par catégorie
              </Typography>
              <CategorySummary categories={categorySummary} />
            </Box>

            <SummaryCard title="Plus grosse dépense" value={largestExpense ? `${largestExpense.montant} €` : "Aucune"} color="error.main" subtitle={largestExpense ? largestExpense.description : ""} />
            <SummaryCard title="Plus gros revenu" value={largestRevenue ? `${largestRevenue.montant} €` : "Aucun"} color="success.main" subtitle={largestRevenue ? largestRevenue.description : ""} />
            <SummaryCard
              title="Catégorie la plus dépensière"
              value={mostExpensiveCategory ? getSafeCategoryLabel(mostExpensiveCategory.name) : "Aucune"}
              color="primary.main"
              subtitle={mostExpensiveCategory ? `${mostExpensiveCategory.amount} €` : ""}
            />
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
