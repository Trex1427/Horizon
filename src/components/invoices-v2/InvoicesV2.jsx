import { useMemo, useRef, useState } from "react";
import {
  Bell,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  MoreVertical,
  Plus,
  Search,
  SlidersHorizontal,
  ChevronDown,
  Clock3,
} from "lucide-react";
import {
  DashboardV2MobileNavigation,
  DashboardV2Sidebar,
} from "../dashboard-v2/DashboardV2Navigation.jsx";
import { useWorkInvoices } from "../../hooks/useWorkInvoices.js";
import { useWorkProjects } from "../../hooks/useWorkProjects.js";
import { useThirdParties } from "../../hooks/useThirdParties.js";
import {
  calculateInvoiceMetrics,
  WORK_INVOICE_STATUS_LABELS,
} from "../../features/work/workModels.js";
import { parseTiiimeInvoicePdf } from "../../services/tiiimeInvoiceParserService.js";
import { formatTargetDate } from "../../utils/dateFormatter.js";
import "../dashboard-v2/DashboardV2.css";
import "../recurring-income-v2/RecurringIncomeV2.css";
import "./InvoicesV2.css";
import { ActionBar, Card, CurrencyInput, DatePicker, Dialog, Input, KpiCard, SearchInput, Select, SectionCard, EmptyState } from "../ui";
import { LoadingState } from "../ui";
import { ErrorState } from "../ui";

const amount = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const money = (value) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount(value));
const EMPTY = {
  invoiceNumber: "",
  invoiceDate: "",
  dueDate: "",
  thirdPartyId: "",
  workProjectId: "",
  amountHT: "",
  amountVAT: "",
  amountTTC: "",
  status: "pending_payment",
};
function PageEmpty({ filtered, onCreate, onReset }) {
  return (
    <EmptyState unstyled as="div" className="v2-card recurring-v2-empty invoices-v2-empty">
      <span>
        <FileCheck2 size={30} />
      </span>
      <h2>{filtered ? "Aucun résultat" : "Aucune facture."}</h2>
      <p>
        {filtered
          ? "Aucune facture ne correspond aux critères sélectionnés."
          : "Créez votre première facture."}
      </p>
      <button
        type="button"
        className="recurring-v2-primary invoices-v2-primary"
        onClick={filtered ? onReset : onCreate}
      >
        {filtered ? "Réinitialiser les filtres" : "Créer une facture"}
      </button>
    </EmptyState>
  );
}
function InvoiceDialog({
  draft,
  file,
  thirdParties,
  projects,
  onClose,
  onSave,
}) {
  const [form, setForm] = useState(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const change = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const result = await onSave(form, file);
    setSaving(false);
    if (result.success) onClose();
    else setError(result.error || "Import impossible.");
  };
  return (
    <Dialog open unstyled overlayClassName="invoices-v2-dialog-backdrop" className="invoices-v2-dialog" ariaLabelledby="invoices-v2-dialog-title" onClose={onClose} closeOnEscape={false} closeOnBackdrop={false}>
        <h2 id="invoices-v2-dialog-title">Nouvelle facture</h2>
        <p className="invoices-v2-file">PDF : {file.name}</p>
        <form onSubmit={submit}>
          {error && <ErrorState unstyled as="p">{error}</ErrorState>}
          <label>
            Numéro
            <Input unstyled
              value={form.invoiceNumber}
              onChange={(e) => change("invoiceNumber", e.target.value)}
            />
          </label>
          <label>
            Date
            <DatePicker unstyled
              type="date"
              value={form.invoiceDate}
              onChange={(e) => change("invoiceDate", e.target.value)}
            />
          </label>
          <label>
            Échéance
            <DatePicker unstyled
              type="date"
              value={form.dueDate}
              onChange={(e) => change("dueDate", e.target.value)}
            />
          </label>
          <label>
            Client
            <Select unstyled
              value={form.thirdPartyId}
              onChange={(e) => change("thirdPartyId", e.target.value)}
            >
              <option value="">Client non identifié</option>
              {thirdParties
                .filter((item) => item.isActive !== false)
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
            </Select>
          </label>
          <label>
            Dossier
            <Select unstyled
              value={form.workProjectId}
              onChange={(e) => change("workProjectId", e.target.value)}
            >
              <option value="">Aucun dossier</option>
              {projects
                .filter((item) => !item.deletedAt)
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
            </Select>
          </label>
          <div className="invoices-v2-amounts">
            <label>
              HT
              <CurrencyInput unstyled
                type="number"
                min="0"
                step="0.01"
                value={form.amountHT}
                onChange={(e) => change("amountHT", e.target.value)}
              />
            </label>
            <label>
              TVA
              <CurrencyInput unstyled
                type="number"
                min="0"
                step="0.01"
                value={form.amountVAT}
                onChange={(e) => change("amountVAT", e.target.value)}
              />
            </label>
            <label>
              TTC
              <CurrencyInput unstyled
                type="number"
                min="0"
                step="0.01"
                value={form.amountTTC}
                onChange={(e) => change("amountTTC", e.target.value)}
              />
            </label>
          </div>
          <div>
            <button type="button" onClick={onClose}>
              Annuler
            </button>
            <button
              type="submit"
              className="invoices-v2-primary"
              disabled={saving}
            >
              {saving ? "Import…" : "Créer la facture"}
            </button>
          </div>
        </form>
    </Dialog>
  );
}

export function InvoicesV2View({
  rows = [],
  summary = {},
  thirdPartyMap = new Map(),
  projectMap = new Map(),
  search,
  setSearch,
  status,
  setStatus,
  sort,
  setSort,
  onCreate,
  onDelete,
  onNavigate,
}) {
  const [menuId, setMenuId] = useState("");
  return (
    <div className="horizon-v2 recurring-v2 invoices-v2">
      <div className="v2-shell">
        <DashboardV2Sidebar active="invoices" onNavigate={onNavigate} />
        <main className="v2-main recurring-v2-main invoices-v2-main">
          <header className="v2-header">
            <div>
              <p className="v2-eyebrow">Organisation</p>
              <h1>Factures</h1>
              <p>
                Suivez toutes vos factures et leur état d&apos;encaissement.
              </p>
            </div>
            <div className="v2-header-actions">
              <button
                type="button"
                className="v2-bell"
                aria-label="Ouvrir les notifications"
              >
                <Bell size={18} />
              </button>
            </div>
          </header>
          <section className="recurring-v2-kpis invoices-v2-kpis">
            <KpiCard
              className="v2-card recurring-v2-kpi invoices-v2-kpi"
              icon={FileCheck2}
              label="Nombre de factures"
              value={String(summary.invoiceCount || 0)}
              caption="Factures non annulées"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi invoices-v2-kpi"
              icon={CircleDollarSign}
              label="Montant total"
              value={money(summary.billedRevenue)}
              caption="Montant facturé"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi invoices-v2-kpi"
              icon={Clock3}
              label="En attente de paiement"
              value={String(summary.unpaidInvoiceCount || 0)}
              caption={money(summary.receivables)}
            />
            <KpiCard
              className="v2-card recurring-v2-kpi invoices-v2-kpi"
              icon={CheckCircle2}
              label="Encaissées"
              value={money(summary.receivedRevenue)}
              caption="Montant encaissé"
            />
          </section>
      <ActionBar className="v2-card recurring-v2-actions invoices-v2-actions">
            <label>
              <Search size={18} />
              <SearchInput unstyled
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une facture…"
                aria-label="Rechercher une facture"
              />
            </label>
            <Select unstyled
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filtres"
            >
              <option value="all">Tous les statuts</option>
              {Object.entries(WORK_INVOICE_STATUS_LABELS).map(
                ([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ),
              )}
            </Select>
            <Select unstyled
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Tri"
            >
              <option value="date">Tri : date</option>
              <option value="amount">Tri : montant</option>
              <option value="number">Tri : numéro</option>
            </Select>
            <button type="button" className="recurring-v2-filter">
              <SlidersHorizontal size={18} />
              Filtres
              <ChevronDown size={16} />
            </button>
            <button
              type="button"
              className="recurring-v2-primary invoices-v2-primary"
              onClick={onCreate}
            >
              <Plus size={18} />
              Nouvelle facture
            </button>
      </ActionBar>
          <SectionCard unstyled as="section" className="v2-card recurring-v2-expected invoices-v2-summary">
            <div>
              <p className="v2-eyebrow">Synthèse</p>
              <h2>Suivi des encaissements</h2>
            </div>
            <div>
              <span>
                Nombre<strong>{summary.invoiceCount || 0}</strong>
              </span>
              <span>
                Montant<strong>{money(summary.billedRevenue)}</strong>
              </span>
              <span>
                Taux d'encaissement
                <strong>
                  {summary.billedRevenue > 0
                    ? `${((summary.receivedRevenue / summary.billedRevenue) * 100).toFixed(1)} %`
                    : "À venir"}
                </strong>
              </span>
            </div>
          </SectionCard>
          <section
            className="recurring-v2-grid invoices-v2-grid"
            aria-label={`${rows.length} factures affichées`}
          >
            {rows.map((invoice) => {
              const label = WORK_INVOICE_STATUS_LABELS[invoice.status];
              return (
                <Card
                  className="v2-card recurring-v2-card invoices-v2-card"
                  key={invoice.id}
                >
                  <header>
                    <div>
                      {label && (
                        <span
                          className={`recurring-v2-status invoices-v2-status ${invoice.status}`}
                        >
                          <i />
                          {label}
                        </span>
                      )}
                      <h2>{invoice.invoiceNumber || "Facture sans numéro"}</h2>
                    </div>
                    <div className="recurring-v2-menu-wrap">
                      <button
                        type="button"
                        className="recurring-v2-menu-button"
                        aria-label={`Actions pour ${invoice.invoiceNumber || "cette facture"}`}
                        aria-expanded={menuId === invoice.id}
                        onClick={() =>
                          setMenuId(menuId === invoice.id ? "" : invoice.id)
                        }
                      >
                        <MoreVertical size={20} />
                      </button>
                      {menuId === invoice.id && (
                        <div className="recurring-v2-menu">
                          <button
                            type="button"
                            className="danger"
                            onClick={() => {
                              setMenuId("");
                              onDelete(invoice);
                            }}
                          >
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                  </header>
                  <div className="recurring-v2-amount invoices-v2-amount">
                    <span>Montant TTC</span>
                    <strong>{money(invoice.amountTTC)}</strong>
                  </div>
                  <dl>
                    <div>
                      <dt>Client</dt>
                      <dd>
                        {thirdPartyMap.get(invoice.thirdPartyId) ||
                          "Client indisponible"}
                      </dd>
                    </div>
                    <div>
                      <dt>Date</dt>
                      <dd>
                        {invoice.invoiceDate
                          ? formatTargetDate(invoice.invoiceDate)
                          : "Aucune"}
                      </dd>
                    </div>
                    <div>
                      <dt>Statut</dt>
                      <dd>{label || invoice.status}</dd>
                    </div>
                    {invoice.workProjectId && (
                      <div>
                        <dt>Dossier</dt>
                        <dd>
                          {projectMap.get(invoice.workProjectId) ||
                            "Dossier indisponible"}
                        </dd>
                      </div>
                    )}
                  </dl>
                </Card>
              );
            })}
            {rows.length === 0 && (
              <PageEmpty
                filtered={summary.sourceCount > 0}
                onCreate={onCreate}
                onReset={() => {
                  setSearch("");
                  setStatus("all");
                  setSort("date");
                }}
              />
            )}
          </section>
        </main>
      </div>
      <DashboardV2MobileNavigation active="invoices" onNavigate={onNavigate} />
    </div>
  );
}

export default function InvoicesV2({ onNavigate }) {
  const api = useWorkInvoices();
  const projectsApi = useWorkProjects();
  const { thirdParties = [] } = useThirdParties({ includeInactive: true });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("date");
  const [draft, setDraft] = useState(null);
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef(null);
  const thirdPartyMap = useMemo(
    () => new Map(thirdParties.map((item) => [item.id, item.name])),
    [thirdParties],
  );
  const projectMap = useMemo(
    () => new Map(projectsApi.projects.map((item) => [item.id, item.name])),
    [projectsApi.projects],
  );
  const liveInvoices = useMemo(
    () => api.invoices.filter((invoice) => invoice.isDeleted !== true),
    [api.invoices],
  );
  const metrics = useMemo(
    () => ({
      ...calculateInvoiceMetrics(liveInvoices),
      sourceCount: liveInvoices.length,
    }),
    [liveInvoices],
  );
  const rows = useMemo(
    () =>
      liveInvoices
        .filter((invoice) =>
          `${invoice.invoiceNumber || ""} ${thirdPartyMap.get(invoice.thirdPartyId) || ""}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        )
        .filter((invoice) => status === "all" || invoice.status === status)
        .toSorted((a, b) =>
          sort === "amount"
            ? amount(b.amountTTC) - amount(a.amountTTC)
            : sort === "number"
              ? String(a.invoiceNumber || "").localeCompare(
                  String(b.invoiceNumber || ""),
                  "fr",
                )
              : String(b.invoiceDate || "").localeCompare(
                  String(a.invoiceDate || ""),
                ),
        ),
    [liveInvoices, thirdPartyMap, search, status, sort],
  );
  const chooseFile = () => inputRef.current?.click();
  const selected = async (event) => {
    const selectedFile = event.target.files?.[0];
    event.target.value = "";
    if (!selectedFile) return;
    setImporting(true);
    try {
      const extraction = await parseTiiimeInvoicePdf(selectedFile);
      setFile(selectedFile);
      setDraft({ ...EMPTY, ...extraction });
    } finally {
      setImporting(false);
    }
  };
  const close = () => {
    setDraft(null);
    setFile(null);
  };
  const remove = async (invoice) => {
    const context = await api.inspectDelete(invoice);
    if (!context.success) return;
    if (
      window.confirm(
        context.value.hasLinkedTransaction
          ? "Supprimer la facture en conservant la transaction liée ?"
          : "Supprimer cette facture ?",
      )
    )
      await api.deleteInvoice(invoice, { deleteLinkedTransaction: false });
  };
  if (api.loading || projectsApi.loading)
    return <LoadingState unstyled as="div" className="recurring-v2-loading">Chargement des factures…</LoadingState>;
  return (
    <>
      {api.error && (
        <ErrorState unstyled as="p" className="recurring-v2-error">
          {api.error}
        </ErrorState>
      )}
      <Input unstyled
        ref={inputRef}
        hidden
        type="file"
        accept="application/pdf"
        onChange={selected}
      />
      <InvoicesV2View
        rows={rows}
        summary={metrics}
        thirdPartyMap={thirdPartyMap}
        projectMap={projectMap}
        search={search}
        setSearch={setSearch}
        status={status}
        setStatus={setStatus}
        sort={sort}
        setSort={setSort}
        onCreate={chooseFile}
        onDelete={remove}
        onNavigate={onNavigate}
      />
      {importing && (
        <div className="invoices-v2-importing" role="status">
          Lecture de la facture…
        </div>
      )}
      {draft && file && (
        <InvoiceDialog
          draft={draft}
          file={file}
          thirdParties={thirdParties}
          projects={projectsApi.projects}
          onClose={close}
          onSave={api.importInvoice}
        />
      )}
    </>
  );
}

