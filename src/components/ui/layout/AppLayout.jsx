import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";

const APP_COLORS = {
  ink: "#172a2f",
  line: "rgba(23, 42, 47, 0.12)",
};

export function AppPage({ children }) {
  return (
    <Box
      sx={{
        display: "grid",
        gap: { xs: 2.25, sm: 3, lg: 3.5 },
        color: APP_COLORS.ink,
        "@keyframes appFadeIn": {
          from: { opacity: 0, transform: "translateY(6px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        animation: "appFadeIn 240ms ease-out",
      }}
    >
      {children}
    </Box>
  );
}

export function CompactPageHeader({
  title,
  mobileCountLabel = null,
  mobilePrimaryActionLabel = "Ajouter",
  onMobilePrimaryAction = null,
  className,
  sx = {},
}) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" className={className} sx={{ mb: { xs: 1, sm: 2 }, ...sx }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>{title}</Typography>
        {mobileCountLabel ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "block", sm: "none" } }}>
            {mobileCountLabel}
          </Typography>
        ) : null}
      </Box>
      {typeof onMobilePrimaryAction === "function" ? (
        <Button
          type="button"
          variant="contained"
          onClick={onMobilePrimaryAction}
          sx={{
            display: { xs: "inline-flex", sm: "none" },
            minHeight: 44,
            borderRadius: 999,
            px: 2,
            bgcolor: "#0F766E",
            "&:hover": {
              bgcolor: "#115E59",
            },
          }}
        >
          {mobilePrimaryActionLabel}
        </Button>
      ) : null}
    </Stack>
  );
}

export function AppHeader(props) {
  return <CompactPageHeader {...props} />;
}

export function StickySummaryPanel({
  ariaLabel,
  summary = null,
  toolbar,
  footer = null,
  className,
  stickySx = {},
  cardSx = {},
  contentSx = {},
}) {
  return (
    <Box
      sx={{
        mb: 1,
        position: "sticky",
        top: { xs: 6, sm: 10 },
        zIndex: 14,
        ...stickySx,
      }}
    >
      <Card
        className={className}
        sx={{
          border: "1px solid",
          borderColor: "rgba(20, 41, 43, 0.1)",
          borderRadius: 2,
          boxShadow: "0 10px 28px rgba(23, 42, 47, 0.12)",
          bgcolor: "rgba(255,255,255,0.96)",
          backdropFilter: "blur(8px)",
          overflow: "hidden",
          ...cardSx,
        }}
        role="region"
        aria-label={ariaLabel}
      >
        <CardContent sx={{ p: { xs: 0.85, sm: 1 }, "&:last-child": { pb: { xs: 0.85, sm: 1 } }, ...contentSx }}>
          {summary}
          {toolbar}
          {footer}
        </CardContent>
      </Card>
    </Box>
  );
}

export function AppStickyPanel(props) {
  return <StickySummaryPanel {...props} />;
}

export function AppSection({ title, subtitle, action = null, children }) {
  return (
    <Box component="section" sx={{ display: "grid", gap: 1.35 }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.15 }}>{title}</Typography>
          {subtitle ? <Typography variant="body2" color="text.secondary">{subtitle}</Typography> : null}
        </Box>
        {action}
      </Stack>
      {children}
    </Box>
  );
}