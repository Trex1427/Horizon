import { Chip } from "@mui/material";

const APP_COLORS = {
  muted: "#61777b",
  safe: "#147d64",
  warn: "#d97706",
  danger: "#c24135",
  accent: "#0f5f8f",
};

export function AppStatusBadge({ label, tone = "safe" }) {
  const palette = {
    safe: { color: APP_COLORS.safe, bg: "rgba(20, 125, 100, 0.12)" },
    warning: { color: APP_COLORS.warn, bg: "rgba(217, 119, 6, 0.14)" },
    danger: { color: APP_COLORS.danger, bg: "rgba(194, 65, 53, 0.13)" },
    accent: { color: APP_COLORS.accent, bg: "rgba(15, 95, 143, 0.12)" },
    muted: { color: APP_COLORS.muted, bg: "rgba(97, 119, 123, 0.14)" },
  };
  const selected = palette[tone] || palette.safe;
  return <Chip size="small" label={label} sx={{ fontWeight: 800, color: selected.color, bgcolor: selected.bg }} />;
}