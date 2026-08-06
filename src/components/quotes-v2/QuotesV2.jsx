import { useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  FileText,
  MoreVertical,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  DashboardV2MobileNavigation,
  DashboardV2Sidebar,
} from "../dashboard-v2/DashboardV2Navigation.jsx";
import { useWorkQuotes } from "../../hooks/useWorkQuotes.js";
import { useProfessionalActivities } from "../../hooks/useProfessionalActivities.js";
import { useThirdParties } from "../../hooks/useThirdParties.js";
import { formatTargetDate } from "../../utils/dateFormatter.js";
import "../dashboard-v2/DashboardV2.css";
import "../recurring-income-v2/RecurringIncomeV2.css";
import "./QuotesV2.css";
import { ActionBar, Card, CurrencyInput, DatePicker, Dialog, Input, KpiCard, SearchInput, Select, SectionCard, EmptyState, LoadingState, ErrorState } from "../ui";

const amount = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const money = (value) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount(value));
const EMPTY = {
  professionalActivityId: "",
  thirdPartyId: "",
  quoteNumber: "",
  issueDate: new Date().toISOString().slice(0, 10),
  amount: "",
  status: "pending",
  source: "manual",
  documentId: null,
};
function PageEmpty({ filtered, onCreate, onReset }) {
  return (
    <EmptyState unstyled as="div" className="v2-card recurring-v2-empty quotes-v2-empty">
      <span>
        <FileText size={30} />
      </span>
      <h2>{filtered ? "Aucun résultat" : "Aucun devis."}</h2>
      <p>
        {filtered
          ? "Aucun devis ne correspond aux critères sélectionnés."
          : "Créez votre premier devis."}
      </p>
      <button
        type="button"
        className="recurring-v2-primary quotes-v2-primary"
        onClick={filtered ? onReset : onCreate}
      >
        {filtered ? "Réinitialiser les filtres" : "Créer un devis"}
      </button>
    </EmptyState>
  );
}
function QuoteDialog({ quote, activities, thirdParties, onClose, onSave }) {
  const [form, setForm] = useState(quote);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const change = (key, value) =>
    setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    const result = await onSave(form);
    setSaving(false);
    if (result.success) onClose();
    else setError(result.error || "Enregistrement impossible.");
  };
  return (
    <Dialog open unstyled overlayClassName="quotes-v2-dialog-backdrop" className="quotes-v2-dialog" ariaLabelledby="quotes-v2-dialog-title" onClose={onClose} closeOnEscape={false} closeOnBackdrop={false}>
        <h2 id="quotes-v2-dialog-title">
          {quote.id ? "Modifier le devis" : "Nouveau devis"}
        </h2>
        <form onSubmit={submit}>
          {error && <ErrorState unstyled as="p">{error}</ErrorState>}
          <label>
            Activité
            <Select unstyled
              required
              value={form.professionalActivityId}
              onChange={(e) => change("professionalActivityId", e.target.value)}
            >
              <option value="">Sélectionner</option>
              {activities
                .filter(
                  (item) =>
                    item.isActive !== false ||
                    item.id === form.professionalActivityId,
                )
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
            </Select>
          </label>
          <label>
            Client
            <Select unstyled
              required
              value={form.thirdPartyId}
              onChange={(e) => change("thirdPartyId", e.target.value)}
            >
              <option value="">Sélectionner</option>
              {thirdParties
                .filter(
                  (item) =>
                    item.isActive !== false || item.id === form.thirdPartyId,
                )
                .map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name}
                  </option>
                ))}
            </Select>
          </label>
          <label>
            Numéro
            <Input unstyled
              value={form.quoteNumber}
              onChange={(e) => change("quoteNumber", e.target.value)}
            />
          </label>
          <label>
            Date
            <DatePicker unstyled
              required
              type="date"
              value={form.issueDate}
              onChange={(e) => change("issueDate", e.target.value)}
            />
          </label>
          <label>
            Montant
            <CurrencyInput unstyled
              required
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => change("amount", e.target.value)}
            />
          </label>
          <label>
            Statut
            <Select unstyled
              value={form.status}
              onChange={(e) => change("status", e.target.value)}
            >
              <option value="pending">En attente</option>
              <option value="accepted">Accepté</option>
            </Select>
          </label>
          <div>
            <button type="button" onClick={onClose}>
              Annuler
            </button>
            <button
              type="submit"
              className="quotes-v2-primary"
              disabled={saving}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
    </Dialog>
  );
}

export function QuotesV2View({
  rows = [],
  summary = {},
  thirdPartyMap = new Map(),
  activityMap = new Map(),
  search,
  setSearch,
  status,
  setStatus,
  sort,
  setSort,
  onCreate,
  onEdit,
  onDelete,
  onNavigate,
}) {
  const [menuId, setMenuId] = useState("");
  return (
    <div className="horizon-v2 recurring-v2 quotes-v2">
      <div className="v2-shell">
        <DashboardV2Sidebar active="quotes" onNavigate={onNavigate} />
        <main className="v2-main recurring-v2-main quotes-v2-main">
          <header className="v2-header">
            <div>
              <p className="v2-eyebrow">Organisation</p>
              <h1>Devis</h1>
              <p>Suivez tous vos devis.</p>
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
          <section className="recurring-v2-kpis quotes-v2-kpis">
            <KpiCard
              className="v2-card recurring-v2-kpi quotes-v2-kpi"
              icon={FileText}
              label="Nombre de devis"
              value={String(summary.count || 0)}
              caption="Tous les devis"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi quotes-v2-kpi"
              icon={CircleDollarSign}
              label="Montant total"
              value={money(summary.total)}
              caption="Montants disponibles"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi quotes-v2-kpi"
              icon={CalendarDays}
              label="En attente"
              value={String(summary.pending || 0)}
              caption="Devis en attente"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi quotes-v2-kpi"
              icon={CheckCircle2}
              label="Acceptés"
              value={String(summary.accepted || 0)}
              caption="Devis acceptés"
            />
          </section>
      <ActionBar className="v2-card recurring-v2-actions quotes-v2-actions">
            <label>
              <Search size={18} />
              <SearchInput unstyled
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un devis…"
                aria-label="Rechercher un devis"
              />
            </label>
            <Select unstyled
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filtres"
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En attente</option>
              <option value="accepted">Acceptés</option>
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
              className="recurring-v2-primary quotes-v2-primary"
              onClick={onCreate}
            >
              <Plus size={18} />
              Nouveau devis
            </button>
      </ActionBar>
          <SectionCard unstyled as="section" className="v2-card recurring-v2-expected quotes-v2-summary">
            <div>
              <p className="v2-eyebrow">Synthèse</p>
              <h2>Vue d'ensemble des devis</h2>
            </div>
            <div>
              <span>
                Nombre<strong>{summary.count || 0}</strong>
              </span>
              <span>
                Montant<strong>{money(summary.total)}</strong>
              </span>
              <span>
                Taux d'acceptation
                <strong>
                  {summary.count
                    ? `${((summary.accepted / summary.count) * 100).toFixed(1)} %`
                    : "À venir"}
                </strong>
              </span>
            </div>
          </SectionCard>
          <section
            className="recurring-v2-grid quotes-v2-grid"
            aria-label={`${rows.length} devis affichés`}
          >
            {rows.map((quote) => {
              const client = thirdPartyMap.get(quote.thirdPartyId);
              const activity = activityMap.get(quote.professionalActivityId);
              return (
                <Card
                  className="v2-card recurring-v2-card quotes-v2-card"
                  key={quote.id}
                >
                  <header>
                    <div>
                      {quote.status === "accepted" && (
                        <span className="recurring-v2-status quotes-v2-status">
                          <i />
                          Accepté
                        </span>
                      )}
                      <h2>{quote.quoteNumber || "Devis sans numéro"}</h2>
                    </div>
                    <div className="recurring-v2-menu-wrap">
                      <button
                        type="button"
                        className="recurring-v2-menu-button"
                        aria-label={`Actions pour ${quote.quoteNumber || "ce devis"}`}
                        aria-expanded={menuId === quote.id}
                        onClick={() =>
                          setMenuId(menuId === quote.id ? "" : quote.id)
                        }
                      >
                        <MoreVertical size={20} />
                      </button>
                      {menuId === quote.id && (
                        <div className="recurring-v2-menu">
                          <button
                            type="button"
                            onClick={() => {
                              setMenuId("");
                              onEdit(quote);
                            }}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => {
                              setMenuId("");
                              onDelete(quote.id);
                            }}
                          >
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                  </header>
                  <div className="recurring-v2-amount quotes-v2-amount">
                    <span>Montant</span>
                    <strong>{money(quote.amount)}</strong>
                  </div>
                  <dl>
                    <div>
                      <dt>Client</dt>
                      <dd>{client || "Client indisponible"}</dd>
                    </div>
                    <div>
                      <dt>Date</dt>
                      <dd>
                        {quote.issueDate
                          ? formatTargetDate(quote.issueDate)
                          : "Aucune"}
                      </dd>
                    </div>
                    <div>
                      <dt>Statut</dt>
                      <dd>
                        {quote.status === "accepted" ? "Accepté" : "En attente"}
                      </dd>
                    </div>
                    {activity && (
                      <div>
                        <dt>Activité</dt>
                        <dd>{activity}</dd>
                      </div>
                    )}
                  </dl>
                </Card>
              );
            })}
            {rows.length === 0 && (
              <PageEmpty
                filtered={summary.count > 0}
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
      <DashboardV2MobileNavigation active="quotes" onNavigate={onNavigate} />
    </div>
  );
}

export default function QuotesV2({ onNavigate }) {
  const quotesApi = useWorkQuotes({ includeDocuments: false });
  const activitiesApi = useProfessionalActivities();
  const { thirdParties = [] } = useThirdParties({ includeInactive: true });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("date");
  const [editing, setEditing] = useState(null);
  const thirdPartyMap = useMemo(
    () => new Map(thirdParties.map((item) => [item.id, item.name])),
    [thirdParties],
  );
  const activityMap = useMemo(
    () =>
      new Map(
        activitiesApi.professionalActivities.map((item) => [
          item.id,
          item.name,
        ]),
      ),
    [activitiesApi.professionalActivities],
  );
  const activeQuotes = useMemo(
    () =>
      quotesApi.quotes.filter(
        (quote) => !quote.deletedAt && quote.isDeleted !== true,
      ),
    [quotesApi.quotes],
  );
  const rows = useMemo(
    () =>
      activeQuotes
        .filter((quote) =>
          `${quote.quoteNumber || ""} ${thirdPartyMap.get(quote.thirdPartyId) || ""}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        )
        .filter((quote) => status === "all" || quote.status === status)
        .toSorted((a, b) =>
          sort === "amount"
            ? amount(b.amount) - amount(a.amount)
            : sort === "number"
              ? String(a.quoteNumber || "").localeCompare(
                  String(b.quoteNumber || ""),
                  "fr",
                )
              : String(b.issueDate || "").localeCompare(
                  String(a.issueDate || ""),
                ),
        ),
    [activeQuotes, thirdPartyMap, search, status, sort],
  );
  const summary = useMemo(
    () => ({
      count: activeQuotes.length,
      total: activeQuotes.reduce((sum, quote) => sum + amount(quote.amount), 0),
      pending: activeQuotes.filter((quote) => quote.status === "pending")
        .length,
      accepted: activeQuotes.filter((quote) => quote.status === "accepted")
        .length,
    }),
    [activeQuotes],
  );
  const save = (payload) =>
    payload.id
      ? quotesApi.editQuote(payload.id, payload)
      : quotesApi.addQuote(payload);
  const remove = async (id) => {
    if (window.confirm("Supprimer ce devis ?")) await quotesApi.deleteQuote(id);
  };
  if (quotesApi.loading || activitiesApi.loading)
    return <LoadingState unstyled as="div" className="recurring-v2-loading">Chargement des devis…</LoadingState>;
  return (
    <>
      {(quotesApi.error || activitiesApi.error) && (
        <ErrorState unstyled as="p" className="recurring-v2-error">
          {quotesApi.error || activitiesApi.error}
        </ErrorState>
      )}
      <QuotesV2View
        rows={rows}
        summary={summary}
        thirdPartyMap={thirdPartyMap}
        activityMap={activityMap}
        search={search}
        setSearch={setSearch}
        status={status}
        setStatus={setStatus}
        sort={sort}
        setSort={setSort}
        onCreate={() => setEditing({ ...EMPTY })}
        onEdit={setEditing}
        onDelete={remove}
        onNavigate={onNavigate}
      />
      {editing && (
        <QuoteDialog
          quote={editing}
          activities={activitiesApi.professionalActivities}
          thirdParties={thirdParties}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </>
  );
}
