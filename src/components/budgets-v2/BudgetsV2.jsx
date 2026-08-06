import { useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Filter,
  Gauge,
  MoreVertical,
  Plus,
  Search,
  Target,
  WalletCards,
} from "lucide-react";
import { BudgetForm } from "../BudgetForm.jsx";
import {
  DashboardV2MobileNavigation,
  DashboardV2Sidebar,
} from "../dashboard-v2/DashboardV2Navigation.jsx";
import { useBudgets } from "../../hooks/useBudgets.js";
import { useCategories } from "../../hooks/useCategories.js";
import { useSubcategories } from "../../hooks/useSubcategories.js";
import { useTransactionsContext } from "../../context/TransactionsContext.jsx";
import { calculateBudgetMetrics } from "../../services/budgetsService.js";
import { selectNonOverlappingBudgetsForForecast } from "../../services/financeCalculations.js";
import { getSafeCategoryLabel } from "../../utils/displayTextUtils.js";
import "../dashboard-v2/DashboardV2.css";
import "./BudgetsV2.css";
import { ActionBar, Card, EmptyState, KpiCard, ProgressBar, SearchInput, Select, LoadingState } from "../ui";
import { ErrorState } from "../ui";

const money = (value) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
function statusFor(percent) {
  if (percent > 100) return { label: "Dépassé", tone: "danger" };
  if (percent >= 75) return { label: "À surveiller", tone: "warning" };
  return { label: "Maîtrisé", tone: "safe" };
}

export function BudgetsV2View({
  rows = [],
  summary = {},
  search,
  setSearch,
  sort,
  setSort,
  status,
  setStatus,
  onCreate,
  onEdit,
  onDelete,
  onNavigate,
}) {
  const [menuId, setMenuId] = useState("");
  return (
    <div className="horizon-v2 budgets-v2">
      <div className="v2-shell">
        <DashboardV2Sidebar active="budgets" onNavigate={onNavigate} />
        <main className="v2-main budgets-v2-main">
          <header className="v2-header">
            <div>
              <p className="v2-eyebrow">Gestion financière</p>
              <h1>Budgets</h1>
              <p>
                Pilotez vos dépenses et gardez le contrôle de vos objectifs.
              </p>
            </div>
            <div className="v2-header-actions">
              <button type="button" className="v2-period">
                <CalendarDays size={18} />
                Ce mois
                <ChevronDown size={16} />
              </button>
              <button
                type="button"
                className="v2-bell"
                aria-label="Ouvrir les notifications"
              >
                <Bell size={18} />
              </button>
            </div>
          </header>
          <section className="budgets-v2-kpis">
            <KpiCard
              className="v2-card budgets-v2-kpi"
              icon={Target}
              label="Nombre de budgets"
              value={String(summary.count || 0)}
              caption="Budgets suivis"
            />
            <KpiCard
              className="v2-card budgets-v2-kpi"
              icon={WalletCards}
              label="Budget total"
              value={money(summary.planned)}
              caption="Objectif cumulé"
            />
            <KpiCard
              className="v2-card budgets-v2-kpi"
              icon={CircleDollarSign}
              label="Dépenses du mois"
              value={money(summary.spent)}
              caption="Montant consommé"
            />
            <KpiCard
              className="v2-card budgets-v2-kpi"
              icon={Gauge}
              label="Reste à dépenser"
              value={money(summary.remaining)}
              caption={
                Number(summary.remaining) < 0 ? "Dépassement" : "Disponible"
              }
            />
          </section>
      <ActionBar className="v2-card budgets-v2-actions">
            <label>
              <Search size={18} />
              <SearchInput unstyled
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un budget…"
                aria-label="Rechercher un budget"
              />
            </label>
            <button type="button">
              <CalendarDays size={18} />
              Période
            </button>
            <Select unstyled
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filtrer les budgets"
            >
              <option value="all">Tous les statuts</option>
              <option value="safe">Maîtrisés</option>
              <option value="warning">À surveiller</option>
              <option value="danger">Dépassés</option>
            </Select>
            <Select unstyled
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Trier les budgets"
            >
              <option value="name">Tri : nom</option>
              <option value="remaining">Tri : reste</option>
              <option value="progress">Tri : progression</option>
            </Select>
            <button type="button" className="budgets-v2-filter">
              <Filter size={18} />
              Filtres
            </button>
            <button
              type="button"
              className="budgets-v2-primary"
              onClick={onCreate}
            >
              <Plus size={18} />
              Créer un budget
            </button>
      </ActionBar>
          <section
            className="budgets-v2-grid"
            aria-label={`${rows.length} budgets affichés`}
          >
            {rows.map((row) => {
              const state = statusFor(row.consumedPercent);
              const progress = Math.min(Math.max(row.consumedPercent, 0), 100);
              return (
                <Card
                  className={`v2-card budgets-v2-card ${state.tone}`}
                  key={row.id}
                >
                  <header>
                    <div>
                      <span className="budgets-v2-category">
                        {row.category}
                      </span>
                      <h2>{row.name}</h2>
                    </div>
                    <div className="budgets-v2-menu-wrap">
                      <button
                        type="button"
                        className="budgets-v2-menu-button"
                        aria-label={`Actions pour ${row.name}`}
                        onClick={() =>
                          setMenuId((current) =>
                            current === row.id ? "" : row.id,
                          )
                        }
                      >
                        <MoreVertical size={20} />
                      </button>
                      {menuId === row.id && (
                        <div className="budgets-v2-menu">
                          <button
                            type="button"
                            onClick={() => {
                              setMenuId("");
                              onEdit(row.budget);
                            }}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => {
                              setMenuId("");
                              onDelete(row.id);
                            }}
                          >
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                  </header>
                  <div className="budgets-v2-remaining">
                    <span>Reste disponible</span>
                    <strong>{money(row.remainingAmount)}</strong>
                  </div>
                  <div className="budgets-v2-progress-copy">
                    <span>{money(row.spentAmount)} consommés</span>
                    <b>{row.consumedPercent.toFixed(0)} %</b>
                  </div>
                  <ProgressBar unstyled className="budgets-v2-progress" value={progress} showValue={false} ariaLabel={`${row.consumedPercent.toFixed(0)} % utilisé`} />
                  <footer>
                    <span className={`budgets-v2-status ${state.tone}`}>
                      <i />
                      {state.label}
                    </span>
                    <span>
                      Objectif <b>{money(row.plannedAmount)}</b>
                    </span>
                  </footer>
                </Card>
              );
            })}
            {rows.length === 0 && (
              <EmptyState unstyled as="div" className="v2-card budgets-v2-empty">
                <span>
                  <Target size={30} />
                </span>
                <h2>Aucun budget pour le moment.</h2>
                <p>
                  Créez votre premier budget pour suivre vos dépenses et garder
                  vos objectifs à portée de vue.
                </p>
                <button
                  type="button"
                  className="budgets-v2-primary"
                  onClick={onCreate}
                >
                  <Plus size={18} />
                  Créer mon premier budget
                </button>
              </EmptyState>
            )}
          </section>
        </main>
      </div>
      <DashboardV2MobileNavigation active="budgets" onNavigate={onNavigate} />
    </div>
  );
}

export default function BudgetsV2({ onNavigate }) {
  const {
    budgets = [],
    loading,
    error,
    addBudget,
    updateBudget,
    deleteBudget,
  } = useBudgets();
  const { categories = [] } = useCategories();
  const { subcategories = [] } = useSubcategories();
  const { transactions = [] } = useTransactionsContext();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [status, setStatus] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const allRows = useMemo(
    () =>
      budgets.map((budget) => {
        const metrics = calculateBudgetMetrics(budget, transactions);
        return {
          id: budget.id,
          budget,
          name:
            budget.name || getSafeCategoryLabel(budget.categoryName, "Budget"),
          category: [
            getSafeCategoryLabel(budget.categoryName, "Budget"),
            budget.subcategoryName,
          ]
            .filter(Boolean)
            .join(" · "),
          plannedAmount: Number(metrics.plannedAmount || 0),
          spentAmount: Number(metrics.spentAmount || 0),
          remainingAmount: Number(metrics.remainingAmount || 0),
          consumedPercent: Number(metrics.consumedPercent || 0),
        };
      }),
    [budgets, transactions],
  );
  const rows = useMemo(
    () =>
      allRows
        .filter(
          (row) =>
            row.name.toLowerCase().includes(search.trim().toLowerCase()) &&
            (status === "all" ||
              statusFor(row.consumedPercent).tone === status),
        )
        .toSorted((left, right) =>
          sort === "remaining"
            ? right.remainingAmount - left.remainingAmount
            : sort === "progress"
              ? right.consumedPercent - left.consumedPercent
              : left.name.localeCompare(right.name, "fr"),
        ),
    [allRows, search, sort, status],
  );
  const summary = useMemo(() => {
    const selected = new Set(selectNonOverlappingBudgetsForForecast(budgets));
    return allRows
      .filter((row) => selected.has(row.budget))
      .reduce(
        (result, row) => ({
          count: budgets.length,
          planned: result.planned + row.plannedAmount,
          spent: result.spent + row.spentAmount,
          remaining: result.remaining + row.remainingAmount,
        }),
        { count: budgets.length, planned: 0, spent: 0, remaining: 0 },
      );
  }, [allRows, budgets]);
  const close = () => {
    setFormOpen(false);
    setEditing(null);
  };
  const submit = (payload) =>
    editing ? updateBudget(editing.id, payload) : addBudget(payload);
  if (loading)
    return <LoadingState unstyled as="div" className="budgets-v2-loading">Chargement des budgets…</LoadingState>;
  return (
    <>
      {error && <ErrorState unstyled as="p">{error}</ErrorState>}
      <BudgetsV2View
        rows={rows}
        summary={summary}
        search={search}
        setSearch={setSearch}
        sort={sort}
        setSort={setSort}
        status={status}
        setStatus={setStatus}
        onCreate={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        onEdit={(budget) => {
          setEditing(budget);
          setFormOpen(true);
        }}
        onDelete={deleteBudget}
        onNavigate={onNavigate}
      />
      <BudgetForm
        open={formOpen}
        onClose={close}
        onSubmit={submit}
        initialBudget={editing}
        isLoading={false}
        categories={categories}
        subcategories={subcategories}
      />
    </>
  );
}
