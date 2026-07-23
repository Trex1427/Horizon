import { Box, Typography } from "@mui/material";
import { PILOTAGE_CARD_SX, PILOTAGE_COLORS, PILOTAGE_PROGRESS_SX } from "../PilotagePageLayout";

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

export default function BudgetComparisonChart({ data = [] }) {
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  const maxValue = data.reduce((max, row) => Math.max(max, row.planned, row.spent), 0) || 1;

  return (
    <Box sx={{ ...PILOTAGE_CARD_SX, p: 1.5 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1, color: PILOTAGE_COLORS.ink }}>
        Budget prévu vs consommé
      </Typography>

      <Box sx={{ display: "grid", gap: 1 }}>
        {data.map((row) => {
          const plannedWidth = Math.max(4, (row.planned / maxValue) * 100);
          const spentWidth = Math.max(4, (row.spent / maxValue) * 100);

          return (
            <Box key={row.id || row.name}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.name}
                </Typography>
                <Typography variant="caption" color={row.overrun ? "error.main" : "text.secondary"}>
                  {formatCurrency(row.spent)} / {formatCurrency(row.planned)}
                </Typography>
              </Box>

              <Box sx={{ ...PILOTAGE_PROGRESS_SX, mt: 0.45, position: "relative" }}>
                <Box sx={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${plannedWidth}%`, bgcolor: PILOTAGE_COLORS.blue, opacity: 0.16 }} title={`Prevu: ${formatCurrency(row.planned)}`} />
                <Box sx={{ position: "absolute", top: 0, left: 0, bottom: 0, width: `${spentWidth}%`, bgcolor: row.overrun ? PILOTAGE_COLORS.red : PILOTAGE_COLORS.green, borderRadius: 999 }} title={`Consomme: ${formatCurrency(row.spent)}`} />
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
