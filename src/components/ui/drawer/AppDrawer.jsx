import { Box, Stack, Typography, useMediaQuery } from "@mui/material";
import { SecondaryButton } from "../buttons/Buttons";
import { AppCard, AppInfoList } from "../cards/AppCards";
import { BottomSheet, Drawer } from "../dialogs/Dialogs";
import { AppSection } from "../layout/AppLayout";
import { AppActions } from "../toolbar/AppToolbar";

export function AppDrawer({
  open,
  onClose,
  title,
  subtitle,
  kpis = [],
  sections = [],
  actions = null,
}) {
  const isMobile = useMediaQuery("(max-width:899px)");

  const content = (
    <Stack spacing={1.35}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 900 }}>{title}</Typography>
        {subtitle ? <Typography variant="body2" color="text.secondary">{subtitle}</Typography> : null}
      </Box>
      {kpis.length > 0 ? (
        <AppCard sx={{ p: 1.1 }}>
          <AppInfoList items={kpis} />
        </AppCard>
      ) : null}
      {sections.map((section) => (
        <AppSection key={section.title} title={section.title} subtitle={section.subtitle}>
          {section.content}
        </AppSection>
      ))}
      {actions ? (
        <AppSection title="Actions">
          <AppActions>{actions}</AppActions>
        </AppSection>
      ) : null}
    </Stack>
  );

  const footer = (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={0.8} justifyContent="flex-end">
      <SecondaryButton onClick={onClose}>Fermer</SecondaryButton>
    </Stack>
  );

  if (isMobile) {
    return (
      <BottomSheet open={open} title={title || "Détail"} onClose={onClose} footer={footer}>
        {content}
      </BottomSheet>
    );
  }

  return (
    <Drawer open={open} title={title || "Détail"} onClose={onClose} side="right" footer={footer}>
      {content}
    </Drawer>
  );
}