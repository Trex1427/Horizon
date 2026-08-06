import { Box, Stack, Typography } from "@mui/material";

const APP_COLORS = {
  ink: "#172a2f",
  line: "rgba(23, 42, 47, 0.12)",
};

export function AppCard({ children, className, sx = {} }) {
  return (
    <Box
      className={className}
      sx={{
        border: "1px solid",
        borderColor: APP_COLORS.line,
        borderRadius: 3,
        background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,248,244,0.96))",
        boxShadow: "0 12px 28px rgba(20, 41, 43, 0.08)",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export function AppTimeline({ items = [] }) {
  if (!items.length) return null;
  return (
    <Stack spacing={0.75}>
      {items.map((item) => (
        <AppCard key={item.id} sx={{ p: 0.95 }}>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>{item.title}</Typography>
          {item.subtitle ? <Typography variant="caption" color="text.secondary">{item.subtitle}</Typography> : null}
        </AppCard>
      ))}
    </Stack>
  );
}

export function AppInfoList({ items = [] }) {
  if (!items.length) return null;
  return (
    <Stack spacing={0.55}>
      {items.map((item) => (
        <Stack key={item.label} direction="row" justifyContent="space-between" spacing={1}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{item.label}</Typography>
          <Typography variant="body2" sx={{ fontWeight: 800 }}>{item.value}</Typography>
        </Stack>
      ))}
    </Stack>
  );
}