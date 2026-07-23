import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { PILOTAGE_CARD_SX, PILOTAGE_COLORS } from "../PilotagePageLayout";

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function ObjectivesProgressRings({ objectives = [] }) {
  if (!Array.isArray(objectives) || objectives.length === 0) {
    return null;
  }

  return (
    <Box sx={{ ...PILOTAGE_CARD_SX, p: 1.5 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 900, mb: 1, color: PILOTAGE_COLORS.ink }}>
        Progression des objectifs
      </Typography>

      <Stack direction="row" spacing={1.25} useFlexGap flexWrap="wrap">
        {objectives.slice(0, 6).map((objective) => {
          const currentAmount = Number(objective.currentAmount || 0);
          const targetAmount = Number(objective.targetAmount || 0);
          const progress = targetAmount > 0 ? Math.min(100, Math.round((currentAmount / targetAmount) * 100)) : 0;
          const label = objective.name || "Objectif";

          return (
            <Box key={objective.id || label} sx={{ width: { xs: "calc(50% - 6px)", sm: "calc(33.333% - 8px)", md: "calc(25% - 10px)" }, minWidth: 130, border: "1px solid", borderColor: PILOTAGE_COLORS.line, borderRadius: 2, p: 1, textAlign: "center", bgcolor: PILOTAGE_COLORS.light }}>
              <Box sx={{ position: "relative", display: "inline-flex", mb: 0.5 }}>
                <CircularProgress variant="determinate" value={100} size={52} thickness={4} sx={{ color: "action.hover" }} />
                <CircularProgress variant="determinate" value={progress} size={52} thickness={4} sx={{ color: progress >= 100 ? PILOTAGE_COLORS.green : PILOTAGE_COLORS.blue, position: "absolute", left: 0 }} />
                <Box sx={{ inset: 0, position: "absolute", display: "grid", placeItems: "center" }}>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    {progress}%
                  </Typography>
                </Box>
              </Box>
              <Typography variant="caption" sx={{ display: "block", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {label}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {formatCurrency(currentAmount)} / {formatCurrency(targetAmount)}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
