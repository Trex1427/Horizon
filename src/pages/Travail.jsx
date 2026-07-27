import { useMemo, useRef, useState } from "react";
import {
  Alert, Box, Button, Card, CardActions, CardContent, Chip, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, MenuItem,
  Stack, Switch, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import Archive from "@mui/icons-material/Archive";
import Description from "@mui/icons-material/Description";
import Edit from "@mui/icons-material/Edit";
import FolderOpen from "@mui/icons-material/FolderOpen";
import UploadFile from "@mui/icons-material/UploadFile";
import { useProfessionalActivities } from "../hooks/useProfessionalActivities.js";
import { useWorkProjects } from "../hooks/useWorkProjects.js";
import { useWorkQuotes } from "../hooks/useWorkQuotes.js";
import { useThirdParties } from "../hooks/useThirdParties.js";
import { parseTiiimeQuotePdf } from "../services/tiiimeQuoteParserService.js";
import { matchThirdParties } from "../features/work/workModels.js";
import { openWorkQuoteDocument } from "../services/workQuotesService.js";
import { WorkDashboard, WorkProjectsSection } from "../features/work/WorkProjectsViews.jsx";

const SECTIONS = [
  ["dashboard", "Tableau de bord"], ["quotes", "Devis"], ["sites", "Dossiers"],
  ["invoices", "Factures"], ["activities", "Activités professionnelles"], ["settings", "Paramètres"],
];
const EMPTY_QUOTE = {
  professionalActivityId: "", thirdPartyId: "", quoteNumber: "",
  issueDate: new Date().toISOString().slice(0, 10), amount: "", status: "pending",
  source: "manual", documentId: null,
};

function WaitingPanel({ children }) {
  return <Card variant="outlined"><CardContent><Typography color="text.secondary">{children}</Typography></CardContent></Card>;
}

function QuoteDialog({ open, quote, file, activities, thirdParties, extraction, onFileChange, onClose, onSave, addThirdParty }) {
  const [form, setForm] = useState(quote);
  const [error, setError] = useState("");
  const [quickThirdParty, setQuickThirdParty] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  if (!open) return null;
  const matching = extraction ? matchThirdParties(extraction.customerName, thirdParties) : null;
  const activeActivities = activities.filter((entry) => entry.isActive !== false || entry.id === form.professionalActivityId);
  const submit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await onSave(form);
      if (!result.success) setError(result.error);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };
  return (
    <Dialog open fullWidth maxWidth="sm" onClose={onClose} fullScreen={false}>
      <DialogTitle>{quote.id ? "Modifier le devis" : quote.source === "tiiime_pdf" ? "Valider le devis Tiiime" : "Nouveau devis"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {extraction && (
            <Alert severity={matching.state === "found" ? "success" : matching.state === "multiple" ? "warning" : "info"}>
              Données détectées : {["numéro", "date", "montant", "tiers"].filter((_, index) =>
                [extraction.quoteNumber, extraction.issueDate, extraction.amount, extraction.customerName][index]).join(", ") || "aucun champ reconnu"}.
              {" "}{matching.state === "found" ? `Tiers probable : ${matching.candidates[0].name}. Confirmez la sélection.` :
                matching.state === "multiple" ? "Plusieurs tiers sont possibles. Choisissez explicitement." : "Aucune correspondance de tiers."}
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}
          <TextField select required label="Activité professionnelle" value={form.professionalActivityId}
            onChange={(e) => setForm({ ...form, professionalActivityId: e.target.value })}>
            {activeActivities.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.name}{entry.isActive === false ? " (inactive)" : ""}</MenuItem>)}
          </TextField>
          <TextField select required label="Tiers" value={form.thirdPartyId}
            onChange={(e) => e.target.value === "__create__" ? setQuickThirdParty(extraction?.customerName || "Nouveau tiers") : setForm({ ...form, thirdPartyId: e.target.value })}>
            {thirdParties.filter((entry) => entry.isActive !== false || entry.id === form.thirdPartyId)
              .map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.name}</MenuItem>)}
            <MenuItem value="__create__">+ Créer un nouveau tiers</MenuItem>
          </TextField>
          <TextField label="Numéro du devis" value={form.quoteNumber} onChange={(e) => setForm({ ...form, quoteNumber: e.target.value })} />
          <TextField required type="date" label="Date" value={form.issueDate} InputLabelProps={{ shrink: true }}
            onChange={(e) => setForm({ ...form, issueDate: e.target.value })} />
          <TextField required type="number" label="Montant" inputProps={{ min: 0, step: "0.01" }} value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <TextField select label="Statut" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <MenuItem value="pending">En attente</MenuItem><MenuItem value="accepted">Accepté</MenuItem>
          </TextField>
          {!quote.id && <Button component="label" variant="outlined" startIcon={<UploadFile />}>
            {file ? `PDF : ${file.name}` : quote.source === "tiiime_pdf" ? "Remplacer le PDF" : "Joindre un PDF (facultatif)"}
            <input hidden type="file" accept="application/pdf" onChange={(e) => onFileChange(e.target.files?.[0] || null)} />
          </Button>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Annuler</Button>
        <Button variant="contained" onClick={submit} disabled={submitting}>{submitting ? <CircularProgress size={20} /> : "Enregistrer"}</Button>
      </DialogActions>
      <Dialog open={quickThirdParty !== ""} onClose={() => setQuickThirdParty("")} fullWidth maxWidth="xs">
        <DialogTitle>Nouveau tiers</DialogTitle>
        <DialogContent sx={{ pt: "12px !important" }}><TextField autoFocus fullWidth required label="Nom du tiers" value={quickThirdParty} onChange={(e) => setQuickThirdParty(e.target.value)} /></DialogContent>
        <DialogActions><Button onClick={() => setQuickThirdParty("")}>Annuler</Button><Button variant="contained" onClick={async () => {
          const result = await addThirdParty({ name: quickThirdParty, type: "customer", notes: "" });
          if (result.success) { setForm({ ...form, thirdPartyId: result.id }); setQuickThirdParty(""); }
          else setError(result.error);
        }}>Créer et sélectionner</Button></DialogActions>
      </Dialog>
    </Dialog>
  );
}

function ActivitiesSection({ activitiesApi }) {
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", color: "#2e7d6f", icon: "work", urssafRate: "0", isActive: true });
  const [error, setError] = useState("");
  const open = (entry = null) => { setEditing(entry || {}); setForm(entry || { name: "", color: "#2e7d6f", icon: "work", urssafRate: "0", isActive: true }); setError(""); };
  const save = async () => {
    const result = editing.id
      ? await activitiesApi.editProfessionalActivity(editing.id, form)
      : await activitiesApi.addProfessionalActivity(form);
    if (result.success) setEditing(null); else setError(result.error);
  };
  return <>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
      <Typography variant="h6">Activités professionnelles</Typography>
      <Button startIcon={<Add />} variant="contained" onClick={() => open()}>Ajouter</Button>
    </Stack>
    <Stack spacing={1.5}>{activitiesApi.professionalActivities.map((entry) =>
      <Card variant="outlined" key={entry.id}><CardContent sx={{ pb: 1 }}>
        <Stack direction="row" justifyContent="space-between"><Box><Typography fontWeight={700}>{entry.name}</Typography>
          <Typography variant="body2" color="text.secondary">URSSAF : {entry.urssafRate}% · {entry.icon}</Typography></Box>
          <Chip label={entry.isActive === false ? "Inactive" : "Active"} color={entry.isActive === false ? "default" : "success"} size="small" />
        </Stack>
      </CardContent><CardActions><Button startIcon={<Edit />} onClick={() => open(entry)}>Modifier</Button>
        <FormControlLabel control={<Switch checked={entry.isActive !== false} onChange={(e) => activitiesApi.toggleProfessionalActivity(entry.id, e.target.checked)} />} label="Active" />
      </CardActions></Card>)}
      {!activitiesApi.loading && !activitiesApi.professionalActivities.length && <WaitingPanel>Aucune activité professionnelle. Créez-en une pour enregistrer un devis.</WaitingPanel>}
    </Stack>
    <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth maxWidth="xs"><DialogTitle>{editing?.id ? "Modifier l’activité" : "Nouvelle activité"}</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>{error && <Alert severity="error">{error}</Alert>}
        <TextField required label="Nom" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <TextField type="number" label="Taux URSSAF (%)" inputProps={{ min: 0, step: "0.01" }} value={form.urssafRate} onChange={(e) => setForm({ ...form, urssafRate: e.target.value })} />
        <TextField label="Couleur" type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        <TextField label="Icône" value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
      </Stack></DialogContent><DialogActions><Button onClick={() => setEditing(null)}>Annuler</Button><Button variant="contained" onClick={save}>Enregistrer</Button></DialogActions>
    </Dialog>
  </>;
}

export default function Travail() {
  const [section, setSection] = useState("dashboard");
  const activitiesApi = useProfessionalActivities();
  const quotesApi = useWorkQuotes();
  const projectsApi = useWorkProjects();
  const { thirdParties, addThirdParty } = useThirdParties({ includeInactive: true });
  const [dialog, setDialog] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [extraction, setExtraction] = useState(null);
  const [importing, setImporting] = useState(false);
  const [notice, setNotice] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [creatingProjectId, setCreatingProjectId] = useState("");
  const [filters, setFilters] = useState({ status: "all", activity: "all", thirdParty: "all", search: "" });
  const importRef = useRef(null);
  const activityMap = useMemo(() => new Map(activitiesApi.professionalActivities.map((entry) => [entry.id, entry])), [activitiesApi.professionalActivities]);
  const thirdPartyMap = useMemo(() => new Map(thirdParties.map((entry) => [entry.id, entry])), [thirdParties]);
  const documentMap = useMemo(() => new Map(quotesApi.documents.map((entry) => [entry.id, entry])), [quotesApi.documents]);
  const projectByQuoteId = useMemo(() => new Map(projectsApi.projects.map((entry) => [entry.quoteId, entry])), [projectsApi.projects]);
  const filteredQuotes = quotesApi.quotes.filter((quote) => {
    const text = `${quote.quoteNumber || ""} ${thirdPartyMap.get(quote.thirdPartyId)?.name || ""}`.toLowerCase();
    return (filters.status === "all" || quote.status === filters.status)
      && (filters.activity === "all" || quote.professionalActivityId === filters.activity)
      && (filters.thirdParty === "all" || quote.thirdPartyId === filters.thirdParty)
      && text.includes(filters.search.toLowerCase());
  });
  const openManual = () => { setPdfFile(null); setExtraction(null); setDialog({ ...EMPTY_QUOTE }); };
  const importPdf = async (file) => {
    if (!file) return;
    setImporting(true); setNotice("");
    try {
      const detected = await parseTiiimeQuotePdf(file);
      const match = matchThirdParties(detected.customerName, thirdParties);
      setPdfFile(file); setExtraction(detected);
      setDialog({ ...EMPTY_QUOTE, source: "tiiime_pdf", quoteNumber: detected.quoteNumber, issueDate: detected.issueDate || EMPTY_QUOTE.issueDate,
        amount: detected.amount, thirdPartyId: match.state === "found" ? match.candidates[0].id : "" });
    } catch (error) { setNotice(error?.message || "Import impossible."); }
    finally { setImporting(false); if (importRef.current) importRef.current.value = ""; }
  };
  const saveQuote = async (form) => {
    const result = form.id ? await quotesApi.editQuote(form.id, form) : await quotesApi.addQuote(form, pdfFile);
    if (result.success) {
      setDialog(null); setPdfFile(null); setExtraction(null);
    }
    return result;
  };
  const openPdf = async (quote) => {
    try { window.open(await openWorkQuoteDocument(documentMap.get(quote.documentId)), "_blank", "noopener,noreferrer"); }
    catch (error) { setNotice(error?.message || "PDF inaccessible."); }
  };
  const openProject = (projectId) => {
    setSelectedProjectId(projectId);
    setSection("sites");
  };
  const createProject = async (quote) => {
    if (creatingProjectId) return;
    const existing = projectByQuoteId.get(quote.id);
    if (existing || quote.projectId) {
      openProject(existing?.id || quote.projectId);
      return;
    }
    setCreatingProjectId(quote.id);
    const result = await projectsApi.createFromQuote(quote, {
      thirdPartyName: thirdPartyMap.get(quote.thirdPartyId)?.name || "",
    });
    setCreatingProjectId("");
    if (result.success) {
      setNotice(result.value.created ? "Dossier créé." : "Ce devis possède déjà un dossier.");
      openProject(result.value.id);
    } else {
      setNotice(result.error);
    }
  };
  return <Box sx={{ maxWidth: 1100, mx: "auto", px: { xs: 1, sm: 2 }, py: 2 }}>
    <Typography variant="h4" sx={{ mb: 1 }}>Travail</Typography>
    <Tabs value={section} onChange={(_, value) => setSection(value)} variant="scrollable" scrollButtons="auto" aria-label="Sections du module Travail" sx={{ mb: 2 }}>
      {SECTIONS.map(([value, label]) => <Tab key={value} value={value} label={label} />)}
    </Tabs>
    {notice && <Alert severity="info" onClose={() => setNotice("")} sx={{ mb: 2 }}>{notice}</Alert>}
    {section === "dashboard" && <WorkDashboard projects={projectsApi.projects} loading={projectsApi.loading} error={projectsApi.error} />}
    {section === "sites" && <WorkProjectsSection projects={projectsApi.projects} loading={projectsApi.loading} error={projectsApi.error}
      activityMap={activityMap} thirdPartyMap={thirdPartyMap} selectedProjectId={selectedProjectId} />}
    {section === "invoices" && <WaitingPanel>La gestion des factures sera disponible dans un prochain sprint.</WaitingPanel>}
    {section === "settings" && <WaitingPanel>Les paramètres du module Travail seront ajoutés progressivement.</WaitingPanel>}
    {section === "activities" && <ActivitiesSection activitiesApi={activitiesApi} />}
    {section === "quotes" && <>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h6">Devis</Typography><Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <Button variant="outlined" startIcon={importing ? <CircularProgress size={18} /> : <UploadFile />} component="label" disabled={importing}>
            Importer un devis Tiiime<input ref={importRef} hidden type="file" accept="application/pdf" onChange={(e) => importPdf(e.target.files?.[0])} />
          </Button><Button variant="contained" startIcon={<Add />} onClick={openManual}>Nouveau devis</Button>
        </Stack>
      </Stack>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 2 }}>
        <TextField size="small" label="Recherche" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
        <TextField select size="small" label="Statut" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <MenuItem value="all">Tous</MenuItem><MenuItem value="pending">En attente</MenuItem><MenuItem value="accepted">Accepté</MenuItem>
        </TextField>
        <TextField select size="small" label="Activité" value={filters.activity} onChange={(e) => setFilters({ ...filters, activity: e.target.value })}>
          <MenuItem value="all">Toutes</MenuItem>{activitiesApi.professionalActivities.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.name}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Tiers" value={filters.thirdParty} onChange={(e) => setFilters({ ...filters, thirdParty: e.target.value })}>
          <MenuItem value="all">Tous</MenuItem>{thirdParties.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.name}</MenuItem>)}
        </TextField>
      </Stack>
      <Stack spacing={1.5}>{filteredQuotes.map((quote) => <Card variant="outlined" key={quote.id}>
        <CardContent><Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={1}>
          <Box><Typography fontWeight={700}>{quote.quoteNumber || "Devis sans numéro"}</Typography>
            <Typography variant="body2">{quote.issueDate} · {thirdPartyMap.get(quote.thirdPartyId)?.name || "Tiers indisponible"}</Typography>
            <Typography variant="body2" color="text.secondary">{activityMap.get(quote.professionalActivityId)?.name || "Activité indisponible"} · {Number(quote.amount || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</Typography></Box>
          <Stack direction="row" spacing={1}><Chip size="small" color={quote.status === "accepted" ? "success" : "warning"} label={quote.status === "accepted" ? "Accepté" : "En attente"} />
            {quote.documentId && <Chip size="small" icon={<Description />} label="PDF" />}</Stack>
        </Stack></CardContent>
        <CardActions><IconButton aria-label="Modifier le devis" onClick={() => { setPdfFile(null); setExtraction(null); setDialog({ ...quote }); }}><Edit /></IconButton>
          {quote.documentId && <Button onClick={() => openPdf(quote)} startIcon={<Description />}>PDF</Button>}
          {quote.status === "accepted" && <Button onClick={() => createProject(quote)} startIcon={<FolderOpen />}
            disabled={creatingProjectId === quote.id}>
            {creatingProjectId === quote.id ? "Création…" : (projectByQuoteId.has(quote.id) || quote.projectId) ? "Ouvrir le dossier" : "Créer le dossier"}
          </Button>}
          <Button color="error" onClick={() => quotesApi.archiveQuote(quote.id, quote.documentId)} startIcon={<Archive />}>Archiver</Button></CardActions>
      </Card>)}
      {!quotesApi.loading && !filteredQuotes.length && <WaitingPanel>Aucun devis ne correspond aux filtres.</WaitingPanel>}</Stack>
    </>}
    <QuoteDialog key={dialog ? `${dialog.id || "new"}-${dialog.source}` : "closed"} open={Boolean(dialog)} quote={dialog || EMPTY_QUOTE}
      file={pdfFile} activities={activitiesApi.professionalActivities} thirdParties={thirdParties} extraction={extraction}
      onFileChange={setPdfFile} onClose={() => setDialog(null)} onSave={saveQuote} addThirdParty={addThirdParty} />
  </Box>;
}
