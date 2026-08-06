import { Stack, Typography } from "@mui/material";
import { AppCard } from "../cards/AppCards";

export function AppFormSection({ title, subtitle, children, defaultOpen = true }) {
  if (defaultOpen) {
    return (
      <AppCard sx={{ p: 1.2 }}>
        <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
        {subtitle ? <Typography variant="body2" color="text.secondary" sx={{ mb: 0.9 }}>{subtitle}</Typography> : null}
        <Stack spacing={1}>{children}</Stack>
      </AppCard>
    );
  }

  return (
    <AppCard sx={{ p: 1.2 }}>
      <details>
        <summary style={{ cursor: "pointer", fontWeight: 800 }}>{title}</summary>
        {subtitle ? <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>{subtitle}</Typography> : null}
        <Stack spacing={1} sx={{ mt: 0.9 }}>{children}</Stack>
      </details>
    </AppCard>
  );
}