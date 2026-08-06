import { Stack } from "@mui/material";
import { AppCard } from "../cards/AppCards";

export function AppFilterBar({ children }) {
  return (
    <AppCard sx={{ p: 1 }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "stretch", md: "center" }} useFlexGap flexWrap="wrap">
        {children}
      </Stack>
    </AppCard>
  );
}