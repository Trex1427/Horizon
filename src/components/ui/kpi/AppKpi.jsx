import { Box, Typography } from "@mui/material";
import { AppCard } from "../cards/AppCards";

const APP_COLORS = {
  ink: "#172a2f",
  muted: "#61777b",
};

export function CompactKpiGrid({ items = [], wrapperSx = {}, ariaHidden = undefined }) {
  return (
    <Box aria-hidden={ariaHidden} sx={{ mb: 0.8, ...wrapperSx }}>
      <Box sx={{ display: "grid", gap: 0.75, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" } }}>
        {items.map((item) => (
          <Box
            key={item.label}
            sx={{
              minWidth: 0,
              border: "1px solid",
              borderColor: "rgba(20, 41, 43, 0.08)",
              borderRadius: 1.5,
              px: 0.9,
              py: 0.65,
              bgcolor: "rgba(246, 248, 244, 0.72)",
            }}
          >
            <Typography variant="caption" sx={{ color: APP_COLORS.muted, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0 }}>
              {item.label}
            </Typography>
            <Typography sx={{ color: item.tone || APP_COLORS.ink, fontWeight: 900, fontSize: { xs: "1rem", sm: "1.12rem" }, lineHeight: 1.12, fontVariantNumeric: "tabular-nums" }}>
              {item.value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function AppKpiGrid(props) {
  return <CompactKpiGrid {...props} />;
}

export function AppStatCard({ label, value, caption, color = APP_COLORS.ink }) {
  return (
    <AppCard sx={{ p: { xs: 1.4, sm: 1.7 }, minHeight: 104 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>{label}</Typography>
      <Typography sx={{ mt: 0.35, fontWeight: 900, color, fontSize: { xs: "1.45rem", sm: "1.65rem" }, lineHeight: 1 }}>
        {value}
      </Typography>
      {caption ? <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>{caption}</Typography> : null}
    </AppCard>
  );
}