import { useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Grid, InputAdornment,
  Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TableSortLabel, TextField, Typography,
} from "@mui/material";
import Search from "@mui/icons-material/Search";
import WarningAmber from "@mui/icons-material/WarningAmber";
import { useProfessionalActivities } from "../hooks/useProfessionalActivities.js";
import { useThirdParties } from "../hooks/useThirdParties.js";
import { useWorkInvoices } from "../hooks/useWorkInvoices.js";
import { useWorkProjectTransactions } from "../hooks/useWorkProjectTransactions.js";
import { useWorkProjects } from "../hooks/useWorkProjects.js";
import { useWorkQuotes } from "../hooks/useWorkQuotes.js";
import {
  calculateProfessionalDashboard,
  filterAndSortDashboardProjects,
} from "../services/professionalDashboardService.js";

const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const percent = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const numericColumns = new Set(["quoteAmount", "billed", "received", "expenses", "margin", "profitabilityRate"]);
const columns = [
  ["name", "Nom"], ["client", "Client"], ["activity", "Activité"], ["quoteAmount", "Devis"],
  ["billed", "Facturé HT"], ["received", "Encaissé"], ["expenses", "Dépenses"],
  ["margin", "Marge"], ["profitabilityRate", "Rentabilité"], ["statusLabel", "Statut"],
];

function SectionTitle({ eyebrow, children }) {
  return <Box><Typography variant="overline" color="primary.main" fontWeight={800}>{eyebrow}</Typography><Typography variant="h5" fontWeight={800}>{children}</Typography></Box>;
}

function Kpi({ label, value, detail, tone }) {
  return <Card variant="outlined" sx={{ height: "100%", borderColor: "rgba(15,82,87,.16)" }}><CardContent>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="h5" fontWeight={800} color={tone === "good" ? "success.main" : tone === "warning" ? "warning.dark" : "text.primary"} sx={{ mt: .5 }}>{value}</Typography>
    {detail && <Typography variant="caption" color="text.secondary">{detail}</Typography>}
  </CardContent></Card>;
}

function ProjectTable({ rows, search, setSearch, sort, setSort }) {
  const toggleSort = (key) => setSort((current) => ({ key, direction: current.key === key && current.direction === "asc" ? "desc" : "asc" }));
  return <Paper variant="outlined" sx={{ overflow: "hidden", borderColor: "rgba(15,82,87,.16)" }}>
    <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}><TextField fullWidth size="small" value={search}
      onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un dossier, un client, une activité…"
      inputProps={{ "aria-label": "Rechercher dans les dossiers" }}
      InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment> }} /></Box>
    <TableContainer><Table size="small" aria-label="Rentabilité des dossiers" sx={{ minWidth: 1180 }}>
      <TableHead><TableRow>{columns.map(([key, label]) => <TableCell key={key} align={numericColumns.has(key) ? "right" : "left"}>
        <TableSortLabel active={sort.key === key} direction={sort.key === key ? sort.direction : "asc"} onClick={() => toggleSort(key)}>{label}</TableSortLabel>
      </TableCell>)}</TableRow></TableHead>
      <TableBody>{rows.map((row) => <TableRow key={row.id} hover>
        <TableCell><Typography variant="body2" fontWeight={800}>{row.name}</Typography></TableCell>
        <TableCell>{row.client}</TableCell><TableCell>{row.activity}</TableCell>
        <TableCell align="right">{currency.format(row.quoteAmount)}</TableCell>
        <TableCell align="right">{currency.format(row.billed)}</TableCell>
        <TableCell align="right">{currency.format(row.received)}</TableCell>
        <TableCell align="right">{currency.format(row.expenses)}</TableCell>
        <TableCell align="right"><Typography variant="body2" fontWeight={800} color={row.margin >= 0 ? "success.main" : "error.main"}>{currency.format(row.margin)}</Typography><Typography variant="caption" color="text.secondary">{row.profitabilityKind === "actual" ? "Réelle" : "Prévisionnelle"}</Typography></TableCell>
        <TableCell align="right"><Typography fontWeight={800} color={row.profitabilityRate >= 0 ? "success.main" : "error.main"}>{percent.format(row.profitabilityRate)} %</Typography></TableCell>
        <TableCell><Chip size="small" variant="outlined" label={row.statusLabel} /></TableCell>
      </TableRow>)}
      {!rows.length && <TableRow><TableCell colSpan={columns.length} align="center" sx={{ py: 5, color: "text.secondary" }}>Aucun dossier ne correspond à la recherche.</TableCell></TableRow>}
      </TableBody>
    </Table></TableContainer>
  </Paper>;
}

export default function ProfessionalDashboard({ onOpenTransactions, onOpenAnalysisMonth, onOpenOpportunities }) {
  const quotesApi = useWorkQuotes();
  const projectsApi = useWorkProjects();
  const invoicesApi = useWorkInvoices();
  const transactionsApi = useWorkProjectTransactions();
  const activitiesApi = useProfessionalActivities();
  const thirdPartiesApi = useThirdParties({ includeInactive: true });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ key: "name", direction: "asc" });
  const dashboard = useMemo(() => calculateProfessionalDashboard({
    quotes: quotesApi.quotes, projects: projectsApi.projects, invoices: invoicesApi.invoices,
    transactions: transactionsApi.transactions, activities: activitiesApi.professionalActivities,
    thirdParties: thirdPartiesApi.thirdParties,
  }), [quotesApi.quotes, projectsApi.projects, invoicesApi.invoices, transactionsApi.transactions, activitiesApi.professionalActivities, thirdPartiesApi.thirdParties]);
  const rows = useMemo(() => filterAndSortDashboardProjects(dashboard.projects, { search, sort }), [dashboard.projects, search, sort]);
  const loading = quotesApi.loading || projectsApi.loading || invoicesApi.loading || transactionsApi.loading || activitiesApi.loading || thirdPartiesApi.loading;
  const error = quotesApi.error || projectsApi.error || invoicesApi.error || transactionsApi.error || activitiesApi.error || thirdPartiesApi.error;
  if (loading) return <Stack alignItems="center" spacing={2} sx={{ py: 8 }}><CircularProgress /><Typography>Préparation du tableau de bord…</Typography></Stack>;
  if (error) return <Alert severity="error">Impossible de charger le tableau de bord professionnel. {error}</Alert>;
  const { kpis } = dashboard;
  return <Stack spacing={4} sx={{ maxWidth: 1180, mx: "auto" }}>
    <Box><Typography variant="overline" color="primary.main" fontWeight={800}>Vue professionnelle</Typography>
      <Typography variant="h3" sx={{ fontFamily: "var(--heading)", fontWeight: 700, fontSize: { xs: "2rem", md: "2.7rem" } }}>Bonjour, voici l’essentiel.</Typography>
      <Typography color="text.secondary">Chiffre d’affaires, encaissements et rentabilité de vos dossiers.</Typography></Box>
    {(dashboard.alerts.overdueInvoices.length > 0 || dashboard.alerts.quotesToFollowUp.length > 0) && <Alert severity={dashboard.alerts.overdueInvoices.length ? "warning" : "info"} icon={<WarningAmber />}>
      <strong>{dashboard.alerts.overdueInvoices.length} facture(s) en retard</strong> · {dashboard.alerts.quotesToFollowUp.length} devis à relancer
    </Alert>}
    <Stack spacing={2}><SectionTitle eyebrow="Chiffre d’affaires">Ce que vous avez généré et encaissé</SectionTitle><Grid container spacing={2}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="CA HT" value={currency.format(kpis.revenue.ht)} /></Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="CA TTC" value={currency.format(kpis.revenue.ttc)} /></Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Encaissé TTC" value={currency.format(kpis.revenue.received)} tone="good" /></Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}><Kpi label="Restant à encaisser" value={currency.format(kpis.revenue.outstanding)} tone={kpis.revenue.outstanding ? "warning" : ""} /></Grid>
    </Grid></Stack>
    <Stack spacing={2}><SectionTitle eyebrow="Rentabilité">La santé économique de l’activité</SectionTitle><Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 4 }}><Kpi label="Marge prévisionnelle" value={currency.format(kpis.profitability.plannedMargin)} detail="Recettes prévues − dépenses prévues" /></Grid>
      <Grid size={{ xs: 12, md: 4 }}><Kpi label="Marge réelle HT" value={currency.format(kpis.profitability.actualMargin)} detail="CA facturé HT − dépenses réelles" tone={kpis.profitability.actualMargin >= 0 ? "good" : "warning"} /></Grid>
      <Grid size={{ xs: 12, md: 4 }}><Kpi label="Taux de marge" value={`${percent.format(kpis.profitability.marginRate)} %`} detail="Marge réelle / CA HT" tone={kpis.profitability.marginRate >= 0 ? "good" : "warning"} /></Grid>
    </Grid></Stack>
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 6 }}><Stack spacing={2}><SectionTitle eyebrow="Activité">Le portefeuille professionnel</SectionTitle><Grid container spacing={2}>
        <Grid size={{ xs: 4 }}><Kpi label="Devis" value={kpis.activity.quotes} /></Grid><Grid size={{ xs: 4 }}><Kpi label="Dossiers" value={kpis.activity.projects} /></Grid><Grid size={{ xs: 4 }}><Kpi label="Factures" value={kpis.activity.invoices} /></Grid>
      </Grid></Stack></Grid>
      <Grid size={{ xs: 12, md: 6 }}><Stack spacing={2}><SectionTitle eyebrow="Encaissements">Le suivi des factures</SectionTitle><Grid container spacing={2}>
        <Grid size={{ xs: 4 }}><Kpi label="Payées" value={kpis.collections.paid} tone="good" /></Grid><Grid size={{ xs: 4 }}><Kpi label="En attente" value={kpis.collections.pending} /></Grid><Grid size={{ xs: 4 }}><Kpi label="En retard" value={kpis.collections.overdue} tone={kpis.collections.overdue ? "warning" : ""} /></Grid>
      </Grid></Stack></Grid>
    </Grid>
    <Stack spacing={2}><SectionTitle eyebrow="Dossiers">Où se crée — ou se perd — la marge</SectionTitle>
      <ProjectTable rows={rows} search={search} setSearch={setSearch} sort={sort} setSort={setSort} />
    </Stack>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
      <Button variant="contained" onClick={onOpenTransactions}>Ouvrir les transactions</Button>
      <Button variant="outlined" onClick={() => onOpenAnalysisMonth?.(new Date().toISOString().slice(0, 7), new Date())}>Analyser le mois</Button>
      <Button variant="text" onClick={onOpenOpportunities}>Voir les opportunités</Button>
    </Stack>
  </Stack>;
}
