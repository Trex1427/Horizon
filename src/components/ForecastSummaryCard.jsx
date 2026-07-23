import { Box, Card, CardContent, Divider, LinearProgress, Stack, Typography } from "@mui/material";
import { PILOTAGE_CARD_SX, PILOTAGE_COLORS, PILOTAGE_PROGRESS_SX } from "./PilotagePageLayout";

function formatAmount(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function getAmountColor(value, fallback = PILOTAGE_COLORS.ink) {
  const amount = Number(value || 0);
  if (amount > 0) return PILOTAGE_COLORS.green;
  if (amount < 0) return PILOTAGE_COLORS.red;
  return fallback;
}

export default function ForecastSummaryCard({ forecast, compact = false }) {
  const expectedIncome = Number(forecast?.expectedRecurringIncome || 0);
  const expectedExpenses = Number(forecast?.expectedFixedExpenses || 0) + Number(forecast?.remainingBudgets || 0);
  const totalFlow = Math.max(Math.abs(expectedIncome) + Math.abs(expectedExpenses), 1);
  const incomeProgress = Math.min(100, Math.round((Math.abs(expectedIncome) / totalFlow) * 100));
  const forecastEndOfMonth = Number(forecast?.forecastEndOfMonth || 0);
  const detailItems = [
    { label: "Solde actuel", value: forecast?.currentBalance, color: getAmountColor(forecast?.currentBalance) },
    { label: "Revenus attendus", value: forecast?.expectedRecurringIncome, color: PILOTAGE_COLORS.green },
    { label: "Frais fixes attendus", value: forecast?.expectedFixedExpenses, color: PILOTAGE_COLORS.red },
    { label: "Budgets restants", value: forecast?.remainingBudgets, color: PILOTAGE_COLORS.orange },
  ];

  return (
    <Card sx={{ ...PILOTAGE_CARD_SX, mb: 0.75 }}>
      <CardContent
        sx={{
          py: compact ? 0.9 : 1.15,
          px: { xs: 1.1, sm: 1.35 },
          "&:last-child": { pb: compact ? 0.9 : 1.15 },
        }}
      >
        {!compact && (
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography fontWeight={900} noWrap sx={{ fontSize: { xs: "1rem", sm: "1.08rem" }, lineHeight: 1.2, color: PILOTAGE_COLORS.ink }}>
                Prévision fin de mois
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.15, fontSize: { xs: "0.75rem", sm: "0.8rem" } }}>
                Vue synthetique des flux attendus
              </Typography>
            </Box>

            <Typography
              fontWeight={900}
              color={getAmountColor(forecastEndOfMonth)}
              sx={{ fontSize: { xs: "1.12rem", sm: "1.28rem" }, lineHeight: 1.1, textAlign: "right", flexShrink: 0 }}
            >
              {formatAmount(forecastEndOfMonth)}
            </Typography>
          </Box>
        )}

        {!compact && (
          <Box sx={{ mt: 1.2 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 0.55 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                Revenus / sorties
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 800, color: expectedIncome >= expectedExpenses ? PILOTAGE_COLORS.green : PILOTAGE_COLORS.orange }}>
                {incomeProgress}%
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={incomeProgress}
              aria-label="Progression des revenus attendus dans la prevision"
              sx={PILOTAGE_PROGRESS_SX}
            />
          </Box>
        )}

        <Stack
          sx={{
            mt: compact ? 0 : 1.15,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
            gap: 0.75,
          }}
        >
          {detailItems.map((item) => (
            <Box
              key={item.label}
              sx={{
                border: "1px solid",
                borderColor: PILOTAGE_COLORS.line,
                borderRadius: 2,
                px: 1,
                py: 0.75,
                bgcolor: PILOTAGE_COLORS.light,
                minWidth: 0,
              }}
            >
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.1, fontWeight: 800 }}>
                {item.label}
              </Typography>
              <Typography fontWeight={900} color={item.color} sx={{ mt: 0.2, fontSize: { xs: "0.94rem", sm: "1rem" }, lineHeight: 1.15 }}>
                {formatAmount(item.value)}
              </Typography>
            </Box>
          ))}
        </Stack>

        {!compact && (
          <>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Solde previsionnel
              </Typography>
              <Typography
                fontWeight={900}
                color={getAmountColor(forecastEndOfMonth)}
                sx={{ fontSize: { xs: "1.05rem", sm: "1.15rem" }, lineHeight: 1.15 }}
              >
                {formatAmount(forecastEndOfMonth)}
              </Typography>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  );
}
