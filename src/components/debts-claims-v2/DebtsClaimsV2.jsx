import { useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  HandCoins,
  MoreVertical,
  Plus,
  Scale,
  Search,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  DashboardV2MobileNavigation,
  DashboardV2Sidebar,
} from "../dashboard-v2/DashboardV2Navigation.jsx";
import DebtReceivableForm from "../DebtReceivableForm.jsx";
import { useDebtsReceivables } from "../../hooks/useDebtsReceivables.js";
import { useThirdParties } from "../../hooks/useThirdParties.js";
import { useCategories } from "../../hooks/useCategories.js";
import { calculateDebtsReceivablesSummary } from "../../services/debtsReceivablesModel.js";
import { formatTargetDate } from "../../utils/dateFormatter.js";
import "../dashboard-v2/DashboardV2.css";
import "../recurring-income-v2/RecurringIncomeV2.css";
import "./DebtsClaimsV2.css";
import { ActionBar, Card, KpiCard, ProgressBar, SearchInput, Select, InfoCard, EmptyState, LoadingState, ErrorState } from "../ui";

const numeric = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const money = (value) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(numeric(value));
const statusLabel = (item) =>
  item.functionalStatus === "paid"
    ? "Soldé"
    : item.type === "receivable"
      ? "À recevoir"
      : "À payer";

function PageEmpty({ filtered, onCreate, onReset }) {
  return (
    <EmptyState unstyled as="div" className="v2-card recurring-v2-empty debts-v2-empty">
      <span>
        <HandCoins size={30} />
      </span>
      <h2>{filtered ? "Aucun résultat" : "Aucune dette ni créance."}</h2>
      <p>
        {filtered
          ? "Aucun suivi ne correspond aux critères sélectionnés."
          : "Ajoutez votre premier suivi de dette ou de créance."}
      </p>
      <button
        type="button"
        className="recurring-v2-primary debts-v2-primary"
        onClick={filtered ? onReset : onCreate}
      >
        {filtered ? "Réinitialiser les filtres" : "Créer un suivi"}
      </button>
    </EmptyState>
  );
}

export function DebtsClaimsV2View({
  rows = [],
  summary = {},
  thirdPartiesById = new Map(),
  search,
  setSearch,
  type,
  setType,
  sort,
  setSort,
  onCreate,
  onEdit,
  onDelete,
  onNavigate,
}) {
  const [menuId, setMenuId] = useState("");
  const total = numeric(summary.receivables) + numeric(summary.debts);
  const receivablesWidth = total
    ? (numeric(summary.receivables) / total) * 100
    : 0;
  const debtsWidth = total ? (numeric(summary.debts) / total) * 100 : 0;
  return (
    <div className="horizon-v2 recurring-v2 debts-v2">
      <div className="v2-shell">
        <DashboardV2Sidebar active="debts" onNavigate={onNavigate} />
        <main className="v2-main recurring-v2-main debts-v2-main">
          <header className="v2-header">
            <div>
              <p className="v2-eyebrow">Gestion financière</p>
              <h1>Dettes &amp; créances</h1>
              <p>
                Suivez les sommes que vous devez et celles que l&apos;on vous
                doit.
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
          <section className="recurring-v2-kpis debts-v2-kpis">
            <KpiCard
              className="v2-card recurring-v2-kpi debts-v2-kpi receivable"
              icon={TrendingUp}
              label="Créances"
              value={money(summary.receivables)}
              caption="Montant total à recevoir"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi debts-v2-kpi debt"
              icon={TrendingDown}
              label="Dettes"
              value={money(summary.debts)}
              caption="Montant total à payer"
            />
            <KpiCard
              className={`v2-card recurring-v2-kpi debts-v2-kpi ${numeric(summary.net) >= 0 ? "receivable" : "debt"}`}
              icon={Scale}
              label="Solde net"
              value={`${numeric(summary.net) > 0 ? "+" : ""}${money(summary.net)}`}
              caption="Créances − Dettes"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi debts-v2-kpi"
              icon={CalendarDays}
              label="Échéances proches"
              value="À venir"
              caption="Indicateur non disponible"
            />
          </section>
      <ActionBar className="v2-card recurring-v2-actions debts-v2-actions">
            <label>
              <Search size={18} />
              <SearchInput unstyled
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher une dette ou créance…"
                aria-label="Rechercher une dette ou une créance"
              />
            </label>
            <button type="button">
              <CalendarDays size={18} />
              Toutes périodes
              <ChevronDown size={16} />
            </button>
            <Select unstyled
              value={type}
              onChange={(event) => setType(event.target.value)}
              aria-label="Filtres"
            >
              <option value="all">Tous les types</option>
              <option value="receivable">Créances</option>
              <option value="debt">Dettes</option>
              <option value="paid">Soldés</option>
            </Select>
            <Select unstyled
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Tri"
            >
              <option value="date">Tri : échéance</option>
              <option value="name">Tri : nom</option>
              <option value="amount">Tri : montant</option>
            </Select>
            <button type="button" className="recurring-v2-filter">
              <SlidersHorizontal size={18} />
              Filtres
            </button>
            <button
              type="button"
              className="recurring-v2-primary debts-v2-primary"
              onClick={onCreate}
            >
              <Plus size={18} />
              Ajouter une dette / créance
            </button>
      </ActionBar>
          <section className="recurring-v2-summary-grid">
            <InfoCard unstyled as="article" className="v2-card recurring-v2-expected debts-v2-expected">
              <div>
                <p className="v2-eyebrow">Synthèse</p>
                <h2>Situation actuelle</h2>
              </div>
              <div>
                <span>
                  Total créances<strong>{money(summary.receivables)}</strong>
                </span>
                <span>
                  Total dettes<strong>{money(summary.debts)}</strong>
                </span>
                <span>
                  Solde net
                  <strong
                    className={
                      numeric(summary.net) >= 0 ? "positive" : "negative"
                    }
                  >
                    {numeric(summary.net) > 0 ? "+" : ""}
                    {money(summary.net)}
                  </strong>
                </span>
              </div>
            </InfoCard>
            <InfoCard unstyled as="article" className="v2-card recurring-v2-distribution debts-v2-distribution">
              <p className="v2-eyebrow">Structure</p>
              <h2>Répartition</h2>
              {total > 0 ? (
                <div className="debts-v2-bars">
                  <div>
                    <span>
                      Créances<b>{money(summary.receivables)}</b>
                    </span>
                    <ProgressBar unstyled as="i" fillAs="em" fillClassName="receivable-bar" value={receivablesWidth} showValue={false} ariaLabel={`Créances : ${money(summary.receivables)}`} />
                  </div>
                  <div>
                    <span>
                      Dettes<b>{money(summary.debts)}</b>
                    </span>
                    <ProgressBar unstyled as="i" fillAs="em" fillClassName="debt-bar" value={debtsWidth} showValue={false} ariaLabel={`Dettes : ${money(summary.debts)}`} />
                  </div>
                </div>
              ) : (
                <EmptyState unstyled as="div" className="recurring-v2-distribution-empty">
                  Aucune répartition disponible.
                </EmptyState>
              )}
            </InfoCard>
          </section>
          <section
            className="recurring-v2-grid"
            aria-label={`${rows.length} dettes et créances affichées`}
          >
            {rows.map((item) => {
              const party = thirdPartiesById.get(item.thirdPartyId);
              const status = statusLabel(item);
              return (
                <Card
                  className={`v2-card recurring-v2-card debts-v2-card ${item.type}`}
                  key={item.id}
                >
                  <header>
                    <div>
                      <span
                        className={`recurring-v2-status debts-v2-status ${item.type} ${item.functionalStatus === "paid" ? "paid" : ""}`}
                      >
                        <i />
                        {status}
                      </span>
                      <h2>{item.label || "Suivi sans nom"}</h2>
                    </div>
                    <div className="recurring-v2-menu-wrap">
                      <button
                        type="button"
                        className="recurring-v2-menu-button"
                        aria-label={`Actions pour ${item.label || "ce suivi"}`}
                        aria-expanded={menuId === item.id}
                        onClick={() =>
                          setMenuId((current) =>
                            current === item.id ? "" : item.id,
                          )
                        }
                      >
                        <MoreVertical size={20} />
                      </button>
                      {menuId === item.id && (
                        <div className="recurring-v2-menu">
                          <button
                            type="button"
                            onClick={() => {
                              setMenuId("");
                              onEdit(item);
                            }}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => {
                              setMenuId("");
                              onDelete(item.id);
                            }}
                          >
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                  </header>
                  <div className="recurring-v2-amount debts-v2-amount">
                    <span>Montant</span>
                    <strong>{money(item.amount)}</strong>
                  </div>
                  <dl>
                    <div>
                      <dt>Type</dt>
                      <dd>
                        {item.type === "receivable" ? "Créance" : "Dette"}
                      </dd>
                    </div>
                    <div>
                      <dt>Personne concernée</dt>
                      <dd>
                        {party?.name || item.counterparty || "Non renseignée"}
                      </dd>
                    </div>
                    <div>
                      <dt>Échéance</dt>
                      <dd>
                        {item.dueDate
                          ? formatTargetDate(item.dueDate)
                          : "Aucune"}
                      </dd>
                    </div>
                    <div>
                      <dt>Statut</dt>
                      <dd>{status}</dd>
                    </div>
                  </dl>
                </Card>
              );
            })}
            {rows.length === 0 && (
              <PageEmpty
                filtered={summary.itemCount > 0}
                onCreate={onCreate}
                onReset={() => {
                  setSearch("");
                  setType("all");
                  setSort("date");
                }}
              />
            )}
          </section>
        </main>
      </div>
      <DashboardV2MobileNavigation active="debts" onNavigate={onNavigate} />
    </div>
  );
}

export default function DebtsClaimsV2({
  accounts = [],
  defaultAccount = null,
  onNavigate,
}) {
  const {
    items = [],
    loading,
    error,
    create,
    update,
    remove,
  } = useDebtsReceivables();
  const { thirdParties = [], addThirdParty } = useThirdParties({
    includeInactive: true,
  });
  const { categories = [] } = useCategories();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [sort, setSort] = useState("date");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const thirdPartiesById = useMemo(
    () => new Map(thirdParties.map((party) => [party.id, party])),
    [thirdParties],
  );
  const calculatedSummary = useMemo(
    () => calculateDebtsReceivablesSummary(items),
    [items],
  );
  const summary = useMemo(
    () => ({ ...calculatedSummary, itemCount: items.length }),
    [calculatedSummary, items.length],
  );
  const rows = useMemo(
    () =>
      items
        .filter((item) =>
          [
            item.label,
            thirdPartiesById.get(item.thirdPartyId)?.name,
            item.counterparty,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        )
        .filter(
          (item) =>
            type === "all" ||
            (type === "paid"
              ? item.functionalStatus === "paid"
              : item.type === type),
        )
        .toSorted((left, right) =>
          sort === "name"
            ? String(left.label || "").localeCompare(
                String(right.label || ""),
                "fr",
              )
            : sort === "amount"
              ? numeric(right.amount) - numeric(left.amount)
              : String(left.dueDate || "9999").localeCompare(
                  String(right.dueDate || "9999"),
                ),
        ),
    [items, search, sort, thirdPartiesById, type],
  );
  const close = () => {
    setFormOpen(false);
    setEditing(null);
  };
  const submit = (payload) =>
    editing ? update(editing.id, payload) : create(payload);
  const deleteItem = async (id) => {
    if (window.confirm("Supprimer cette dette ou créance ?")) await remove(id);
  };
  if (loading)
    return (
      <LoadingState unstyled as="div" className="recurring-v2-loading">
        Chargement des dettes et créances…
      </LoadingState>
    );
  return (
    <>
      {error && (
        <ErrorState unstyled as="p" className="recurring-v2-error">
          {error}
        </ErrorState>
      )}
      <DebtsClaimsV2View
        rows={rows}
        summary={summary}
        thirdPartiesById={thirdPartiesById}
        search={search}
        setSearch={setSearch}
        type={type}
        setType={setType}
        sort={sort}
        setSort={setSort}
        onCreate={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        onEdit={(item) => {
          setEditing(item);
          setFormOpen(true);
        }}
        onDelete={deleteItem}
        onNavigate={onNavigate}
      />
      <DebtReceivableForm
        key={`${editing?.id || "new"}-${formOpen}`}
        open={formOpen}
        initialItem={editing}
        thirdParties={thirdParties}
        categories={categories}
        accounts={accounts}
        defaultAccount={defaultAccount}
        onRequestCreateThirdParty={addThirdParty}
        onClose={close}
        onSubmit={submit}
      />
    </>
  );
}
