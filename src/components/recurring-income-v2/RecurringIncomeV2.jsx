import { useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  MoreVertical,
  PiggyBank,
  Plus,
  Search,
  SlidersHorizontal,
  TrendingUp,
} from "lucide-react";
import {
  DashboardV2MobileNavigation,
  DashboardV2Sidebar,
} from "../dashboard-v2/DashboardV2Navigation.jsx";
import { RecurringIncomeForm } from "../RecurringIncomeForm.jsx";
import { useRecurringIncome } from "../../hooks/useRecurringIncome.js";
import { useAccounts } from "../../hooks/useAccounts.js";
import { useCategories } from "../../hooks/useCategories.js";
import { getRecurringIncomeApplicableAmount } from "../../utils/recurringIncomeAmount.js";
import { formatTargetDate } from "../../utils/dateFormatter.js";
import "../dashboard-v2/DashboardV2.css";
import "./RecurringIncomeV2.css";
import { ActionBar, Card, KpiCard, ProgressBar, SearchInput, Select, InfoCard, EmptyState, LoadingState, ErrorState } from "../ui";

const numeric = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const money = (value) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(numeric(value));
const todayKey = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const nextDate = (income) =>
  income?.nextPaymentDate || income?.nextDate || income?.nextOccurrence || null;
const frequencyKey = (value) => {
  const key = String(value || "").toLowerCase();
  if (["mensuel", "monthly"].includes(key)) return "monthly";
  if (["hebdomadaire", "weekly"].includes(key)) return "weekly";
  if (["annuel", "annual"].includes(key)) return "annual";
  return "other";
};
const FREQUENCIES = {
  monthly: "Mensuel",
  weekly: "Hebdomadaire",
  annual: "Annuel",
  other: "Autre",
};

function PageEmpty({ filtered, onCreate, onReset }) {
  return (
    <EmptyState unstyled as="div" className="v2-card recurring-v2-empty">
      <span>
        <TrendingUp size={30} />
      </span>
      <h2>{filtered ? "Aucun résultat" : "Aucun revenu récurrent."}</h2>
      <p>
        {filtered
          ? "Aucun revenu ne correspond aux critères sélectionnés."
          : "Ajoutez votre premier revenu automatique."}
      </p>
      <button
        type="button"
        className="recurring-v2-primary"
        onClick={filtered ? onReset : onCreate}
      >
        {filtered ? "Réinitialiser les filtres" : "Créer un revenu"}
      </button>
    </EmptyState>
  );
}

export function RecurringIncomeV2View({
  rows = [],
  summary = {},
  accountsById = new Map(),
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
  const distribution = Object.entries(summary.distribution || {}).filter(
    ([, count]) => count > 0,
  );
  const maximum = Math.max(1, ...distribution.map(([, count]) => count));
  return (
    <div className="horizon-v2 recurring-v2">
      <div className="v2-shell">
        <DashboardV2Sidebar active="recurring-income" onNavigate={onNavigate} />
        <main className="v2-main recurring-v2-main">
          <header className="v2-header">
            <div>
              <p className="v2-eyebrow">Gestion financière</p>
              <h1>Revenus récurrents</h1>
              <p>Visualisez tous vos revenus automatiques.</p>
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
          <section className="recurring-v2-kpis">
            <KpiCard
              className="v2-card recurring-v2-kpi"
              icon={TrendingUp}
              label="Revenus récurrents"
              value={String(summary.count || 0)}
              caption="Tous les revenus"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi"
              icon={CircleDollarSign}
              label="Montant mensuel"
              value={money(summary.monthlyTotal)}
              caption="Revenus actifs"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi"
              icon={Clock3}
              label="Prochaine échéance"
              value={
                summary.nextDate ? formatTargetDate(summary.nextDate) : "Aucune"
              }
              caption="Prochain versement disponible"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi"
              icon={PiggyBank}
              label="Revenus annuels"
              value={money(summary.annualTotal)}
              caption="Projection annuelle"
            />
          </section>
      <ActionBar className="v2-card recurring-v2-actions">
            <label>
              <Search size={18} />
              <SearchInput unstyled
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un revenu…"
                aria-label="Rechercher un revenu"
              />
            </label>
            <button type="button">
              <CalendarDays size={18} />
              Toutes périodes
              <ChevronDown size={16} />
            </button>
            <Select unstyled
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filtres"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="suspended">Suspendus</option>
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
              className="recurring-v2-primary"
              onClick={onCreate}
            >
              <Plus size={18} />
              Ajouter un revenu
            </button>
      </ActionBar>
          <section className="recurring-v2-summary-grid">
            <InfoCard unstyled as="article" className="v2-card recurring-v2-expected">
              <div>
                <p className="v2-eyebrow">Synthèse</p>
                <h2>Revenus attendus</h2>
              </div>
              <div>
                <span>
                  Mensuel<strong>{money(summary.monthlyTotal)}</strong>
                </span>
                <span>
                  Annuel<strong>{money(summary.annualTotal)}</strong>
                </span>
                <span>
                  Prochain versement
                  <strong>
                    {summary.nextDate
                      ? formatTargetDate(summary.nextDate)
                      : "Aucune"}
                  </strong>
                </span>
              </div>
            </InfoCard>
            <InfoCard unstyled as="article" className="v2-card recurring-v2-distribution">
              <p className="v2-eyebrow">Structure</p>
              <h2>Répartition</h2>
              {distribution.length ? (
                <div>
                  {distribution.map(([key, count]) => (
                    <div className="recurring-v2-frequency" key={key}>
                      <span>
                        {FREQUENCIES[key]}
                        <b>{count}</b>
                      </span>
                      <ProgressBar unstyled as="i" fillAs="em" value={count} max={maximum} showValue={false} ariaLabel={`${FREQUENCIES[key]} : ${count}`} />
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState unstyled as="div" className="recurring-v2-distribution-empty">
                  Aucune fréquence disponible.
                </EmptyState>
              )}
            </InfoCard>
          </section>
          <section
            className="recurring-v2-grid"
            aria-label={`${rows.length} revenus affichés`}
          >
            {rows.map((row) => {
              const income = row.income;
              const active = income.isActive !== false;
              return (
                <Card className="v2-card recurring-v2-card" key={income.id}>
                  <header>
                    <div>
                      <span
                        className={`recurring-v2-status${active ? "" : " suspended"}`}
                      >
                        <i />
                        {active ? "Actif" : "Suspendu"}
                      </span>
                      <h2>{income.name || "Revenu sans nom"}</h2>
                    </div>
                    <div className="recurring-v2-menu-wrap">
                      <button
                        type="button"
                        className="recurring-v2-menu-button"
                        aria-label={`Actions pour ${income.name || "ce revenu"}`}
                        aria-expanded={menuId === income.id}
                        onClick={() =>
                          setMenuId((current) =>
                            current === income.id ? "" : income.id,
                          )
                        }
                      >
                        <MoreVertical size={20} />
                      </button>
                      {menuId === income.id && (
                        <div className="recurring-v2-menu">
                          <button
                            type="button"
                            onClick={() => {
                              setMenuId("");
                              onEdit(income);
                            }}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => {
                              setMenuId("");
                              onDelete(income.id);
                            }}
                          >
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                  </header>
                  <div className="recurring-v2-amount">
                    <span>Montant</span>
                    <strong>{money(row.amount)}</strong>
                  </div>
                  <dl>
                    <div>
                      <dt>Fréquence</dt>
                      <dd>{FREQUENCIES[frequencyKey(income.frequency)]}</dd>
                    </div>
                    <div>
                      <dt>Prochain versement</dt>
                      <dd>
                        {nextDate(income)
                          ? formatTargetDate(nextDate(income))
                          : "Aucune"}
                      </dd>
                    </div>
                    <div>
                      <dt>Compte associé</dt>
                      <dd>
                        {accountsById.get(income.accountId) ||
                          "Compte non défini"}
                      </dd>
                    </div>
                    <div>
                      <dt>Catégorie</dt>
                      <dd>
                        {income.categoryName ||
                          income.category ||
                          "Catégorie non définie"}
                      </dd>
                    </div>
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
      <DashboardV2MobileNavigation
        active="recurring-income"
        onNavigate={onNavigate}
      />
    </div>
  );
}

export default function RecurringIncomeV2({ onNavigate }) {
  const {
    recurringIncome = [],
    loading,
    error,
    addRecurringIncome,
    updateRecurringIncome,
    deleteRecurringIncome,
  } = useRecurringIncome();
  const { accounts = [] } = useAccounts();
  const { categories = [] } = useCategories();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("date");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const accountsById = useMemo(
    () =>
      new Map(
        accounts.map((account) => [account.id, account.name || "Compte"]),
      ),
    [accounts],
  );
  const referenceDate = useMemo(() => todayKey(), []);
  const allRows = useMemo(
    () =>
      recurringIncome.map((income) => ({
        income,
        amount: numeric(
          getRecurringIncomeApplicableAmount(income, referenceDate),
        ),
      })),
    [recurringIncome, referenceDate],
  );
  const rows = useMemo(
    () =>
      allRows
        .filter((row) =>
          [
            row.income.name,
            row.income.categoryName,
            row.income.category,
            accountsById.get(row.income.accountId),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        )
        .filter(
          (row) =>
            status === "all" ||
            (status === "active"
              ? row.income.isActive !== false
              : row.income.isActive === false),
        )
        .toSorted((left, right) =>
          sort === "name"
            ? String(left.income.name || "").localeCompare(
                String(right.income.name || ""),
                "fr",
              )
            : sort === "amount"
              ? right.amount - left.amount
              : String(nextDate(left.income) || "9999").localeCompare(
                  String(nextDate(right.income) || "9999"),
                ),
        ),
    [allRows, accountsById, search, status, sort],
  );
  const summary = useMemo(() => {
    const active = allRows.filter((row) => row.income.isActive !== false);
    const monthlyTotal = active.reduce(
      (sum, row) =>
        sum +
        (frequencyKey(row.income.frequency) === "annual"
          ? row.amount / 12
          : frequencyKey(row.income.frequency) === "weekly"
            ? (row.amount * 52) / 12
            : row.amount),
      0,
    );
    const dates = active
      .map((row) => nextDate(row.income))
      .filter(Boolean)
      .toSorted((left, right) => String(left).localeCompare(String(right)));
    const distribution = allRows.reduce(
      (result, row) => ({
        ...result,
        [frequencyKey(row.income.frequency)]:
          (result[frequencyKey(row.income.frequency)] || 0) + 1,
      }),
      {},
    );
    return {
      count: allRows.length,
      monthlyTotal,
      annualTotal: monthlyTotal * 12,
      nextDate: dates[0] || null,
      distribution,
    };
  }, [allRows]);
  const close = () => {
    setFormOpen(false);
    setEditing(null);
  };
  const submit = (payload) =>
    editing
      ? updateRecurringIncome(editing.id, payload)
      : addRecurringIncome(payload);
  const remove = async (id) => {
    if (window.confirm("Supprimer ce revenu récurrent ?"))
      await deleteRecurringIncome(id);
  };
  if (loading)
    return (
      <LoadingState unstyled as="div" className="recurring-v2-loading">
        Chargement des revenus récurrents…
      </LoadingState>
    );
  return (
    <>
      {error && (
        <ErrorState unstyled as="p" className="recurring-v2-error">
          {error}
        </ErrorState>
      )}
      <RecurringIncomeV2View
        rows={rows}
        summary={summary}
        accountsById={accountsById}
        search={search}
        setSearch={setSearch}
        status={status}
        setStatus={setStatus}
        sort={sort}
        setSort={setSort}
        onCreate={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        onEdit={(income) => {
          setEditing(income);
          setFormOpen(true);
        }}
        onDelete={remove}
        onNavigate={onNavigate}
      />
      <RecurringIncomeForm
        open={formOpen}
        onClose={close}
        onSubmit={submit}
        initialIncome={editing}
        isLoading={false}
        accounts={accounts}
        categories={categories}
      />
    </>
  );
}
