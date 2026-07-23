import { Box, Typography } from "@mui/material";

const CHART_CARD_SX = {
  border: "1px solid",
  borderColor: "rgba(23, 42, 47, 0.12)",
  borderRadius: 2,
  p: { xs: 1.25, sm: 1.5 },
  background: "rgba(255,255,255,0.96)",
  boxShadow: "0 10px 24px rgba(20, 41, 43, 0.07)",
};

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function IncomeExpenseTrendChart({
  data = [],
  title = "Évolution revenus / dépenses",
  subtitle = "",
  emptyMessage = "Aucune donnée de tendance sur cette période.",
  revenueLabel = "Revenus",
  expenseLabel = "Dépenses",
  hideRevenue = false,
  hideExpense = false,
}) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <Box sx={CHART_CARD_SX}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: subtitle ? 0.25 : 1 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            {subtitle}
          </Typography>
        ) : null}
        <Typography variant="body2" color="text.secondary">{emptyMessage}</Typography>
      </Box>
    );
  }

  const maxValue = data.reduce(
    (max, row) => {
      const values = [];
      if (!hideRevenue) {
        values.push(row.revenu || 0);
      }
      if (!hideExpense) {
        values.push(row.depense || 0);
      }
      return Math.max(max, ...values, 0);
    },
    0
  ) || 1;

  return (
    <Box sx={CHART_CARD_SX}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          {subtitle}
        </Typography>
      ) : null}

      <Box sx={{ overflowX: "auto", pb: 0.5 }}>
        <Box
          role="img"
          aria-label={title}
          sx={{ display: "grid", gridTemplateColumns: `repeat(${data.length}, minmax(44px, 1fr))`, gap: 1, alignItems: "end", height: { xs: 184, sm: 198 }, minWidth: Math.max(240, data.length * 54) }}
        >
          {data.map((row) => {
            const revenueHeight = Math.max(2, ((row.revenu || 0) / maxValue) * 132);
            const expenseHeight = Math.max(2, ((row.depense || 0) / maxValue) * 132);

            return (
              <Box key={row.label} sx={{ display: "grid", justifyItems: "center", gap: 0.4 }}>
                <Box sx={{ display: "flex", alignItems: "end", gap: 0.35, height: 142 }}>
                  {!hideRevenue && (
                    <Box
                      title={`${revenueLabel} ${row.label}: ${formatCurrency(row.revenu)}`}
                      sx={{ width: { xs: 11, sm: 12 }, height: revenueHeight, bgcolor: "#147d64", borderRadius: "6px 6px 0 0" }}
                    />
                  )}
                  {!hideExpense && (
                    <Box
                      title={`${expenseLabel} ${row.label}: ${formatCurrency(row.depense)}`}
                      sx={{ width: { xs: 11, sm: 12 }, height: expenseHeight, bgcolor: "#c24135", borderRadius: "6px 6px 0 0" }}
                    />
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 48, textAlign: "center", overflowWrap: "anywhere" }}>
                  {row.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, mt: 0.75 }}>
        {!hideRevenue && (
          <Typography variant="caption" color="text.secondary">
            <Box component="span" sx={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", bgcolor: "#147d64", mr: 0.5 }} />
            {revenueLabel}
          </Typography>
        )}
        {!hideExpense && (
          <Typography variant="caption" color="text.secondary">
            <Box component="span" sx={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", bgcolor: "#c24135", mr: 0.5 }} />
            {expenseLabel}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
