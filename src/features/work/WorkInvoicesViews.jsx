import { useRef, useState } from "react";
import { Alert, Box, Button, Card, CardActions, CardContent, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import UploadFile from "@mui/icons-material/UploadFile";
import Description from "@mui/icons-material/Description";
import Paid from "@mui/icons-material/Paid";
import { matchThirdParties, sortWorkInvoices, suggestWorkProject, WORK_INVOICE_STATUS_LABELS } from "./workModels.js";
const currency = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const EMPTY = { invoiceNumber: "", invoiceDate: "", dueDate: "", thirdPartyId: "", workProjectId: "", amountHT: "", amountVAT: "", amountTTC: "", status: "pending_payment" };

function InvoiceDialog({ draft, extraction, file, thirdParties, projects, activities, addThirdParty, createProject, onClose, onSave }) {
  const [form, setForm] = useState(draft), [error, setError] = useState(""), [saving, setSaving] = useState(false); const guard = useRef(false);
  const [quickClient, setQuickClient] = useState(null), [quickProject, setQuickProject] = useState(null);
  const projectMatch = suggestWorkProject(form.thirdPartyId, projects);
  const activeProjects = projects.filter((project) => project.thirdPartyId === form.thirdPartyId && !project.deletedAt && !["completed", "cancelled"].includes(project.status));
  const changeClient = (thirdPartyId) => { if (thirdPartyId === "__create__") { setQuickClient({ name: extraction?.customerName || "", email: "", phone: "" }); return; } const suggestion = suggestWorkProject(thirdPartyId, projects); setForm({ ...form, thirdPartyId, workProjectId: suggestion.workProjectId }); };
  const submit = async () => { if (guard.current) return; guard.current = true; setSaving(true); const result = await onSave(form, file); if (!result.success) setError(result.error); setSaving(false); guard.current = false; };
  return <Dialog open fullWidth maxWidth="sm" onClose={onClose}><DialogTitle>Valider la facture Tiiime</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
    <Alert severity="info">Pré-remplissage OCR terminé. Tous les champs restent modifiables et un champ absent peut rester vide.</Alert>{error && <Alert severity="error">{error}</Alert>}
    <TextField label="Numéro de facture" value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}/>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}><TextField fullWidth type="date" label="Date de facture" InputLabelProps={{ shrink: true }} value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}/><TextField fullWidth type="date" label="Échéance" InputLabelProps={{ shrink: true }} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })}/></Stack>
    <TextField select label="Client" value={form.thirdPartyId} onChange={(e) => changeClient(e.target.value)}><MenuItem value="">Client non identifié</MenuItem>{thirdParties.filter((entry) => entry.isActive !== false).map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.name}</MenuItem>)}<MenuItem value="__create__">+ Nouveau client</MenuItem></TextField>
    <TextField select label="Dossier" value={form.workProjectId} onChange={(e) => e.target.value === "__create__" ? setQuickProject({ name: "", professionalActivityId: activities[0]?.id || "", plannedRevenue: "" }) : setForm({ ...form, workProjectId: e.target.value })}><MenuItem value="">Aucun dossier</MenuItem>{activeProjects.map((project) => <MenuItem key={project.id} value={project.id}>{project.name}</MenuItem>)}{form.thirdPartyId && <MenuItem value="__create__">+ Nouveau dossier</MenuItem>}</TextField>
    {form.thirdPartyId && <Alert severity={projectMatch.state === "found" ? "success" : projectMatch.state === "multiple" ? "warning" : "info"}>{projectMatch.state === "found" ? "Le dossier actif unique a été associé automatiquement." : projectMatch.state === "multiple" ? "Plusieurs dossiers actifs correspondent : choisissez dans la liste." : "Aucun dossier actif correspondant : le rattachement reste vide."}</Alert>}
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>{[["amountHT","HT"],["amountVAT","TVA"],["amountTTC","TTC"]].map(([key,label]) => <TextField key={key} fullWidth type="number" label={label} inputProps={{ min: 0, step: "0.01" }} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}/>)}</Stack>
    <Typography variant="body2" color="text.secondary">PDF sélectionné : {file.name}{extraction?.customerName ? ` · Client détecté : ${extraction.customerName}` : ""}</Typography>
  </Stack></DialogContent><DialogActions><Button onClick={onClose} disabled={saving}>Annuler</Button><Button variant="contained" onClick={submit} disabled={saving}>{saving ? <CircularProgress size={20}/> : "Importer"}</Button></DialogActions>
    <Dialog open={Boolean(quickClient)} onClose={() => setQuickClient(null)} fullWidth maxWidth="xs"><DialogTitle>Nouveau client</DialogTitle><DialogContent><Stack spacing={2} sx={{pt:1}}><TextField required label="Nom" value={quickClient?.name || ""} onChange={(e)=>setQuickClient({...quickClient,name:e.target.value})}/><TextField label="E-mail" value={quickClient?.email || ""} onChange={(e)=>setQuickClient({...quickClient,email:e.target.value})}/><TextField label="Téléphone" value={quickClient?.phone || ""} onChange={(e)=>setQuickClient({...quickClient,phone:e.target.value})}/></Stack></DialogContent><DialogActions><Button onClick={()=>setQuickClient(null)}>Annuler</Button><Button variant="contained" onClick={async()=>{if(!quickClient.name.trim()){setError("Le nom du client est obligatoire.");return;} const result=await addThirdParty({...quickClient,type:"customer",notes:""}); if(result.success){setForm({...form,thirdPartyId:result.id,workProjectId:""});setQuickClient(null);}else setError("Impossible de créer le client. Réessayez.");}}>Créer et sélectionner</Button></DialogActions></Dialog>
    <Dialog open={Boolean(quickProject)} onClose={() => setQuickProject(null)} fullWidth maxWidth="xs"><DialogTitle>Nouveau dossier</DialogTitle><DialogContent><Stack spacing={2} sx={{pt:1}}><TextField required label="Nom du dossier" value={quickProject?.name || ""} onChange={(e)=>setQuickProject({...quickProject,name:e.target.value})}/><TextField select required label="Activité professionnelle" value={quickProject?.professionalActivityId || ""} onChange={(e)=>setQuickProject({...quickProject,professionalActivityId:e.target.value})}>{activities.filter(a=>a.isActive!==false).map(a=><MenuItem key={a.id} value={a.id}>{a.name}</MenuItem>)}</TextField><TextField type="number" label="Montant prévisionnel (facultatif)" value={quickProject?.plannedRevenue || ""} onChange={(e)=>setQuickProject({...quickProject,plannedRevenue:e.target.value})}/></Stack></DialogContent><DialogActions><Button onClick={()=>setQuickProject(null)}>Annuler</Button><Button variant="contained" onClick={async()=>{const result=await createProject({...quickProject,thirdPartyId:form.thirdPartyId});if(result.success){setForm({...form,workProjectId:result.value.id});setQuickProject(null);}else setError(result.error);}}>Créer et sélectionner</Button></DialogActions></Dialog>
  </Dialog>;
}

export function WorkInvoicesSection({ invoices, projects, thirdParties, activities, accounts, addThirdParty, createProject, thirdPartyMap, projectMap, loading, error, parsePdf, importInvoice, markPaid, markPaidWithTransaction, markPending, inspectDelete, deleteInvoice, openPdf }) {
  const [draft, setDraft] = useState(null), [file, setFile] = useState(null), [extraction, setExtraction] = useState(null), [importing, setImporting] = useState(false), [notice, setNotice] = useState("");
  const [paymentInvoice, setPaymentInvoice] = useState(null), [pendingInvoice, setPendingInvoice] = useState(null), [paymentForm, setPaymentForm] = useState({ accountId: "", date: new Date().toISOString().slice(0, 10), categoryId: "" });
  const [paymentError, setPaymentError] = useState(""), [paymentSubmitting, setPaymentSubmitting] = useState(false); const paymentGuard = useRef(false);
  const [deletionInvoice, setDeletionInvoice] = useState(null), [deletionError, setDeletionError] = useState(""), [deletionSubmitting, setDeletionSubmitting] = useState(false);
  const [filters, setFilters] = useState({ project: "all", client: "all", status: "all" }); const inputRef = useRef(null);
  const selectPdf = async (selected) => { if (!selected) return; setImporting(true); setNotice(""); try { const detected = await parsePdf(selected); const clientMatch = matchThirdParties(detected.customerName, thirdParties); const thirdPartyId = clientMatch.state === "found" ? clientMatch.candidates[0].id : ""; const projectMatch = suggestWorkProject(thirdPartyId, projects); setFile(selected); setExtraction(detected); setDraft({ ...EMPTY, ...detected, thirdPartyId, workProjectId: projectMatch.workProjectId }); } catch (err) { setNotice(err?.message || "Import impossible."); } finally { setImporting(false); if (inputRef.current) inputRef.current.value = ""; } };
  const save = async (form, pdf) => { const result = await importInvoice(form, pdf); if (result.success) { setDraft(null); setFile(null); setExtraction(null); setNotice("Facture importée."); } return result; };
  const filtered = sortWorkInvoices(invoices.filter((invoice) => (filters.project === "all" || invoice.workProjectId === filters.project) && (filters.client === "all" || invoice.thirdPartyId === filters.client) && (filters.status === "all" || invoice.status === filters.status)));
  return <>{notice && <Alert sx={{ mb: 2 }} severity="info" onClose={() => setNotice("")}>{notice}</Alert>}<Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1} sx={{ mb: 2 }}><Typography variant="h6">Factures</Typography><Button component="label" variant="contained" startIcon={importing ? <CircularProgress size={18}/> : <UploadFile/>} disabled={importing}>Importer une facture PDF<input ref={inputRef} hidden type="file" accept="application/pdf" onChange={(e) => selectPdf(e.target.files?.[0])}/></Button></Stack>
    <Stack direction={{ xs: "column", md: "row" }} spacing={1} sx={{ mb: 2 }}><TextField select size="small" label="Dossier" value={filters.project} onChange={(e) => setFilters({ ...filters, project: e.target.value })}><MenuItem value="all">Tous</MenuItem>{projects.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.name}</MenuItem>)}</TextField><TextField select size="small" label="Client" value={filters.client} onChange={(e) => setFilters({ ...filters, client: e.target.value })}><MenuItem value="all">Tous</MenuItem>{thirdParties.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.name}</MenuItem>)}</TextField><TextField select size="small" label="Statut" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><MenuItem value="all">Tous</MenuItem>{Object.entries(WORK_INVOICE_STATUS_LABELS).map(([value,label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField></Stack>
    {loading ? <CircularProgress/> : error ? <Alert severity="error">{error}</Alert> : <Stack spacing={1}>{filtered.map((invoice) => <Card key={invoice.id} variant="outlined" role="button" tabIndex={0} onClick={() => openPdf(invoice)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openPdf(invoice); } }} sx={{ cursor: "pointer" }}><CardContent><Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr auto", md: "1.2fr 1fr 1fr 1fr auto" }, gap: 1 }}><Typography fontWeight={700}>{invoice.invoiceNumber || "Sans numéro"}</Typography><Typography>{invoice.invoiceDate || "Date absente"}</Typography><Typography>{thirdPartyMap.get(invoice.thirdPartyId)?.name || "Client indisponible"}</Typography><Typography>{projectMap.get(invoice.workProjectId)?.name || "Sans dossier"}</Typography><Stack direction="row" spacing={1}><Typography fontWeight={700}>{currency.format(Number(invoice.amountTTC || 0))}</Typography><Chip size="small" label={WORK_INVOICE_STATUS_LABELS[invoice.status] || invoice.status}/></Stack></Box></CardContent><CardActions><Button startIcon={<Description/>} onClick={(e) => { e.stopPropagation(); openPdf(invoice); }}>PDF</Button>{invoice.status === "pending_payment" && <Button startIcon={<Paid/>} disabled={paymentSubmitting} onClick={async (e) => {
  e.stopPropagation(); setPaymentError("");
  if (invoice.paymentTransactionId) {
    if (paymentGuard.current) return;
    paymentGuard.current = true; setPaymentSubmitting(true);
    const result = await markPaid(invoice);
    paymentGuard.current = false; setPaymentSubmitting(false);
    setNotice(result.success ? "Facture payée. La transaction bancaire liée a été conservée." : result.error);
    return;
  }
  setPaymentInvoice(invoice); setPaymentForm({ accountId: "", date: new Date().toISOString().slice(0, 10), categoryId: "" });
}}>Marquer payée</Button>}{invoice.status === "paid" && <Button onClick={(e) => { e.stopPropagation(); setPaymentError(""); setPendingInvoice(invoice); }}>Repasser non payée</Button>}<Button color="error" disabled={deletionSubmitting} onClick={async (event) => {
  event.stopPropagation(); setDeletionError(""); setDeletionSubmitting(true);
  const context = await inspectDelete(invoice);
  setDeletionSubmitting(false);
  if (!context.success) { setNotice(context.error); return; }
  if (context.value.hasLinkedTransaction) { setDeletionInvoice(invoice); return; }
  if (!window.confirm("Supprimer cette facture ?")) return;
  const result = await deleteInvoice(invoice, { deleteLinkedTransaction: false });
  setNotice(result.success ? "Facture supprimée. Le PDF est conservé." : result.error);
}}>Supprimer</Button></CardActions></Card>)}{!filtered.length && <Typography color="text.secondary">Aucune facture ne correspond aux filtres.</Typography>}</Stack>}
    <Dialog open={Boolean(deletionInvoice)} onClose={() => { if (!deletionSubmitting) setDeletionInvoice(null); }} fullWidth maxWidth="sm">
      <DialogTitle>Supprimer la facture</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        {deletionError && <Alert severity="error">{deletionError}</Alert>}
        <Typography>Cette facture est liée à une transaction de paiement. Que souhaitez-vous supprimer ?</Typography>
      </Stack></DialogContent>
      <DialogActions sx={{ flexWrap: "wrap" }}>
        <Button disabled={deletionSubmitting} onClick={() => setDeletionInvoice(null)}>Annuler</Button>
        <Button disabled={deletionSubmitting} onClick={async () => {
          setDeletionSubmitting(true); setDeletionError("");
          const result = await deleteInvoice(deletionInvoice, { deleteLinkedTransaction: false });
          setDeletionSubmitting(false);
          if (result.success) { setNotice("Facture supprimée. La transaction est conservée comme recette indépendante."); setDeletionInvoice(null); }
          else setDeletionError(result.error);
        }}>Supprimer uniquement la facture</Button>
        <Button disabled={deletionSubmitting} color="error" variant="contained" onClick={async () => {
          setDeletionSubmitting(true); setDeletionError("");
          const result = await deleteInvoice(deletionInvoice, { deleteLinkedTransaction: true });
          setDeletionSubmitting(false);
          if (result.success) { setNotice("Facture et transaction supprimées."); setDeletionInvoice(null); }
          else setDeletionError(result.error);
        }}>Supprimer la facture et la transaction</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={Boolean(paymentInvoice)} onClose={() => { if (!paymentSubmitting) setPaymentInvoice(null); }} fullWidth maxWidth="xs">
      <DialogTitle>Paiement de la facture</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        {paymentError && <Alert severity="error">{paymentError}</Alert>}
        <Typography>Créer une transaction de revenu correspondant à cette facture ?</Typography>
        <TextField type="date" label="Date" InputLabelProps={{ shrink: true }} value={paymentForm.date} onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })} />
        <TextField select required error={Boolean(paymentError) && !paymentForm.accountId} label="Compte" value={paymentForm.accountId} onChange={(e) => { setPaymentError(""); setPaymentForm({ ...paymentForm, accountId: e.target.value }); }}>
          <MenuItem value="">Choisir un compte</MenuItem>{accounts.filter((account) => account.isActive !== false).map((account) => <MenuItem key={account.id} value={account.id}>{account.name}</MenuItem>)}
        </TextField>
      </Stack></DialogContent>
      <DialogActions>
        <Button disabled={paymentSubmitting} onClick={() => setPaymentInvoice(null)}>Annuler</Button>
        <Button disabled={paymentSubmitting} onClick={async () => {
          if (paymentGuard.current) return;
          paymentGuard.current = true; setPaymentSubmitting(true); setPaymentError("");
          const result = await markPaid(paymentInvoice);
          paymentGuard.current = false; setPaymentSubmitting(false);
          if (result.success) { setNotice("Facture payée sans mouvement bancaire."); setPaymentInvoice(null); }
          else setPaymentError(result.error);
        }}>Marquer payée sans transaction</Button>
        <Button disabled={paymentSubmitting} variant="contained" onClick={async () => {
          if (paymentGuard.current) return;
          if (!paymentForm.accountId) { setPaymentError("Sélectionnez un compte pour créer la transaction."); return; }
          paymentGuard.current = true; setPaymentSubmitting(true); setPaymentError("");
          const project = projectMap.get(paymentInvoice?.workProjectId);
          const result = await markPaidWithTransaction(paymentInvoice, { accountId: paymentForm.accountId, date: paymentForm.date, description: `Paiement facture ${paymentInvoice.invoiceNumber || "sans numéro"}`, categoryId: paymentForm.categoryId || null, thirdPartyName: thirdPartyMap.get(paymentInvoice.thirdPartyId)?.name || null, projectName: project?.name || null });
          paymentGuard.current = false; setPaymentSubmitting(false);
          if (result.success) { setNotice("Transaction de revenu créée et facture marquée payée."); setPaymentInvoice(null); }
          else setPaymentError(result.error);
        }}>Créer la transaction</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={Boolean(pendingInvoice)} onClose={() => { if (!paymentSubmitting) setPendingInvoice(null); }} fullWidth maxWidth="xs">
      <DialogTitle>Repasser la facture en non payée</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        {paymentError && <Alert severity="error">{paymentError}</Alert>}
        {pendingInvoice?.paymentTransactionId ? <><Typography>Cette facture est liée à une transaction.</Typography><Typography>Que souhaitez-vous faire ?</Typography></> : <Typography>Cette facture n’est liée à aucune transaction. Elle sera simplement repassée en non payée.</Typography>}
      </Stack></DialogContent>
      <DialogActions sx={{ flexWrap: "wrap" }}>
        <Button disabled={paymentSubmitting} onClick={() => setPendingInvoice(null)}>Annuler</Button>
        {pendingInvoice?.paymentTransactionId && <Button disabled={paymentSubmitting} onClick={async () => {
          if (paymentGuard.current) return;
          paymentGuard.current = true; setPaymentSubmitting(true); setPaymentError("");
          const result = await markPending(pendingInvoice, { deleteLinkedTransaction: false });
          paymentGuard.current = false; setPaymentSubmitting(false);
          if (result.success) { setNotice("Facture repassée en non payée. La transaction bancaire est toujours enregistrée."); setPendingInvoice(null); }
          else setPaymentError(result.error);
        }}>Conserver la transaction</Button>}
        <Button disabled={paymentSubmitting} color={pendingInvoice?.paymentTransactionId ? "error" : "primary"} variant="contained" onClick={async () => {
          if (paymentGuard.current) return;
          paymentGuard.current = true; setPaymentSubmitting(true); setPaymentError("");
          const result = await markPending(pendingInvoice, { deleteLinkedTransaction: Boolean(pendingInvoice?.paymentTransactionId) });
          paymentGuard.current = false; setPaymentSubmitting(false);
          if (result.success) { setNotice(pendingInvoice?.paymentTransactionId ? "Facture repassée en non payée et transaction supprimée." : "Facture repassée en non payée."); setPendingInvoice(null); }
          else setPaymentError(result.error);
        }}>{pendingInvoice?.paymentTransactionId ? "Repasser non payée et supprimer la transaction" : "Repasser non payée"}</Button>
      </DialogActions>
    </Dialog>
    {draft && <InvoiceDialog key={file?.name} draft={draft} extraction={extraction} file={file} thirdParties={thirdParties} projects={projects} activities={activities} addThirdParty={addThirdParty} createProject={createProject} onClose={() => { setDraft(null); setFile(null); setExtraction(null); }} onSave={save}/>}</>;
}
