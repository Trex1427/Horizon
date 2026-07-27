import { Alert, Box, Card, CardContent, Chip, CircularProgress, Grid, Stack, Typography } from "@mui/material";
import { calculateWorkProjectMetrics, WORK_PROJECT_STATUS_LABELS } from "./workProjectModel.js";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function StatePanel({ children }) {
  return <Card variant="outlined"><CardContent><Typography color="text.secondary">{children}</Typography></CardContent></Card>;
}

export function WorkDashboard({ projects, loading, error }) {
  if (loading) return <CircularProgress aria-label="Chargement du tableau de bord" />;
  if (error) return <Alert severity="error">{error}</Alert>;
  const metrics = calculateWorkProjectMetrics(projects);
  const cards = [
    ["Dossiers actifs", metrics.active],
    ["Dossiers en cours", metrics.inProgress],
    ["Dossiers terminés", metrics.completed],
    ["Chiffre d’affaires prévu", currency.format(metrics.plannedRevenue)],
  ];
  return <Grid container spacing={2}>{cards.map(([label, value]) =>
    <Grid key={label} size={{ xs: 12, sm: 6, md: 3 }}><Card variant="outlined"><CardContent>
      <Typography color="text.secondary" variant="body2">{label}</Typography>
      <Typography variant="h5" fontWeight={700}>{value}</Typography>
    </CardContent></Card></Grid>)}</Grid>;
}

export function WorkProjectsSection({ projects, loading, error, activityMap, thirdPartyMap, selectedProjectId }) {
  if (loading) return <CircularProgress aria-label="Chargement des dossiers" />;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!projects.length) return <StatePanel>Aucun dossier. Acceptez un devis puis créez son dossier.</StatePanel>;
  return <Stack spacing={1.5}>{projects.map((project) =>
    <Card key={project.id} variant="outlined" sx={project.id === selectedProjectId ? { borderColor: "primary.main", borderWidth: 2 } : undefined}>
      <CardContent><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
        <Box>
          <Typography fontWeight={700}>{project.name}</Typography>
          <Typography variant="body2">{thirdPartyMap.get(project.thirdPartyId)?.name || "Client indisponible"}</Typography>
          <Typography variant="body2" color="text.secondary">
            {activityMap.get(project.professionalActivityId)?.name || "Activité indisponible"} · {currency.format(Number(project.plannedRevenue || 0))}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Début : {project.startDate || "Non défini"} · Fin : {project.endDate || "Non définie"}
          </Typography>
        </Box>
        <Chip size="small" label={WORK_PROJECT_STATUS_LABELS[project.status] || project.status} />
      </Stack></CardContent>
    </Card>)}</Stack>;
}
