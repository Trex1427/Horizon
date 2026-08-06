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
  borderRadius: 2.5,
  background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,248,244,0.96))",
  boxShadow: "0 12px 28px rgba(20, 41, 43, 0.08)",
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
    <Box sx={{ display: "grid", gap: { xs: 2, sm: 2.5, lg: 3 }, color: PILOTAGE_COLORS.ink }}>
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
        gap: 1.25,
        alignItems: "center",
        p: { xs: 1.25, sm: 1.5 },
        border: "1px solid",
        borderColor: PILOTAGE_COLORS.line,
        borderRadius: 2.5,
        background: "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(246,248,244,0.92))",
        boxShadow: "0 12px 28px rgba(20, 41, 43, 0.08)",
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
              fontSize: { xs: "1.5rem", sm: "1.75rem" },
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
          Horizon V2 · Pilotage financier
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
          sx={{
            "& .MuiOutlinedInput-root": {
              borderRadius: 1.75,
              bgcolor: "rgba(255,255,255,0.9)",
            },
          }}
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
        gap: 1.15,
      }}
    >
      {items.map((item) => (
        <Box
          key={item.label}
          sx={{
            ...PILOTAGE_CARD_SX,
            p: { xs: 1.4, sm: 1.7 },
            minHeight: 104,
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
        sx={{ mb: 1.15 }}
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
