import { Box, Chip, Stack, Typography } from "@mui/material";

const APP_COLORS = {
  ink: "#172a2f",
  muted: "#61777b",
  line: "rgba(23, 42, 47, 0.12)",
  light: "#f6f8f4",
};

export function ToolbarSearchShell({ children, utilityAction = null, className = "transactions-toolbar-search-shell", sx = {} }) {
  return (
    <Box className={className} sx={{ display: "flex", alignItems: "center", gap: 0.5, width: "100%", ...sx }}>
      {children}
      {utilityAction}
    </Box>
  );
}

export function AppSearchBar(props) {
  return <ToolbarSearchShell {...props} />;
}

export function AppSearch({ children }) {
  return (
    <Box sx={{
      "& .MuiOutlinedInput-root": {
        borderRadius: 1.75,
        bgcolor: "rgba(255,255,255,0.9)",
      },
    }}>
      {children}
    </Box>
  );
}

export function AppActions({ children }) {
  if (!children) return null;
  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={0.8} alignItems={{ xs: "stretch", sm: "center" }}>
      {children}
    </Stack>
  );
}

export function AppToolbar({
  title,
  subtitle,
  countLabel,
  search = null,
  actions = null,
  sticky = true,
}) {
  return (
    <Box
      component="header"
      sx={{
        position: sticky ? "sticky" : "static",
        top: { xs: 0, md: 4 },
        zIndex: 10,
        display: "grid",
        gap: 1.5,
        p: { xs: 1.35, sm: 1.7, lg: 1.9 },
        border: "1px solid",
        borderColor: APP_COLORS.line,
        borderRadius: 3,
        background: "linear-gradient(132deg, rgba(255,255,255,0.97), rgba(246,248,244,0.94))",
        backdropFilter: "blur(8px)",
        boxShadow: "0 14px 34px rgba(20, 41, 43, 0.1)",
      }}
    >
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems={{ xs: "flex-start", md: "center" }} justifyContent="space-between">
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 900, lineHeight: 1.15, fontSize: { xs: "1.5rem", sm: "1.75rem" } }}>
            {title}
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mt: 0.25 }}>
            {subtitle ? <Typography variant="body2" color="text.secondary">{subtitle}</Typography> : null}
            {countLabel ? <Chip size="small" label={countLabel} sx={{ fontWeight: 800, bgcolor: APP_COLORS.light, color: APP_COLORS.muted }} /> : null}
          </Stack>
        </Box>
        <AppActions>{actions}</AppActions>
      </Stack>
      {search ? <AppSearch>{search}</AppSearch> : null}
    </Box>
  );
}