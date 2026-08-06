import { Typography } from "@mui/material";
import { AppCard } from "../cards/AppCards";

export function AppEmptyState({ children }) {
  return (
    <AppCard sx={{ p: 1.2 }}>
      <Typography variant="body2" color="text.secondary">{children}</Typography>
    </AppCard>
  );
}