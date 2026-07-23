import { Alert, Box, Button, Chip, Stack, TextField, Typography } from "@mui/material";
import Add from "@mui/icons-material/Add";

export const PILOTAGE_COLORS = {
  green: "#147d64",
  blue: "#0f5f8f",
  orange: "#d97706",
  red: "#c24135",
  ink: "#172a2f",
  muted: "#61777b",
  light: "#f6f8f4",
  line: "rgba(23, 42, 47, 0.12)",
};

export const PILOTAGE_CARD_SX = {
  border: "1px solid",
  borderColor: PILOTAGE_COLORS.line,
  borderRadius: 2,
  background: "rgba(255,255,255,0.95)",
  boxShadow: "0 10px 24px rgba(20, 41, 43, 0.07)",
};

export const PILOTAGE_PROGRESS_SX = {
  height: 8,
  borderRadius: 999,
  bgcolor: "rgba(23, 42, 47, 0.08)",
  overflow: "hidden",
  "& .MuiLinearProgress-bar": {
    borderRadius: 999,
    transition: "transform 240ms ease",
  },
};

export function PilotagePageShell({ children }) {
  return (
    <Box sx={{ display: "grid", gap: { xs: 1.5, sm: 2 }, color: PILOTAGE_COLORS.ink }}>
      {children}
    </Box>
  );
}

export function PilotageHeader({
  title,
  countLabel,
  actionLabel = "Ajouter",
  onAdd = null,
  searchValue = "",
  onSearchChange = null,
  searchPlaceholder = "Rechercher",
}) {
  const hasSearch = typeof onSearchChange === "function";
  const hasAction = typeof onAdd === "function";

  return (
    <Box
      component="header"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: hasSearch ? "minmax(0, 1fr) minmax(220px, 320px) auto" : "minmax(0, 1fr) auto" },
        gap: 1,
        alignItems: "center",
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "flex-start", sm: "center" }}
          useFlexGap
          flexWrap="wrap"
          sx={{ minWidth: 0, width: "100%" }}
        >
          <Typography
            variant="h5"
            sx={{
              fontWeight: 900,
              lineHeight: 1.15,
              color: PILOTAGE_COLORS.ink,
              minWidth: 0,
              maxWidth: "100%",
            }}
          >
            {title}
          </Typography>
          {countLabel && (
            <Chip
              size="small"
              label={countLabel}
              sx={{
                bgcolor: PILOTAGE_COLORS.light,
                color: PILOTAGE_COLORS.muted,
                fontWeight: 800,
                minWidth: 0,
                width: { xs: "100%", sm: "auto" },
                maxWidth: { xs: "100%", sm: "none" },
                flexBasis: { xs: "100%", sm: "auto" },
                justifyContent: { xs: "flex-start", sm: "center" },
                "& .MuiChip-label": {
                  display: "block",
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                },
              }}
            />
          )}
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
          Pilotage financier
        </Typography>
      </Box>

      {hasSearch && (
        <TextField
          size="small"
          value={searchValue}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          fullWidth
        />
      )}

      {hasAction && (
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={onAdd}
          sx={{ minHeight: 40, justifySelf: { xs: "stretch", md: "end" } }}
        >
          {actionLabel}
        </Button>
      )}
    </Box>
  );
}

export function PilotageSummary({ items = [] }) {
  return (
    <Box
      component="section"
      aria-label="Resume du pilotage financier"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
        gap: 1,
      }}
    >
      {items.map((item) => (
        <Box
          key={item.label}
          sx={{
            ...PILOTAGE_CARD_SX,
            p: { xs: 1.25, sm: 1.5 },
            minHeight: 92,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
            {item.label}
          </Typography>
          <Typography
            sx={{
              mt: 0.35,
              fontWeight: 900,
              color: item.color || PILOTAGE_COLORS.ink,
              fontSize: { xs: "1.45rem", sm: "1.65rem" },
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {item.value}
          </Typography>
          {item.caption && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.6 }}>
              {item.caption}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

export function PilotageSection({ title, subtitle = "", action = null, children }) {
  return (
    <Box component="section">
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        sx={{ mb: 1 }}
      >
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 900, color: PILOTAGE_COLORS.ink }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        {action}
      </Stack>
      {children}
    </Box>
  );
}

export function PilotageEmptyState({ children }) {
  return (
    <Alert
      severity="info"
      sx={{
        border: "1px solid",
        borderColor: "rgba(15, 95, 143, 0.18)",
        bgcolor: "rgba(15, 95, 143, 0.06)",
      }}
    >
      {children}
    </Alert>
  );
}
