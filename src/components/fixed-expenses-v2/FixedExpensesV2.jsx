import { useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  MoreVertical,
  Plus,
  ReceiptText,
  Search,
  SlidersHorizontal,
  TrendingDown,
} from "lucide-react";
import {
  DashboardV2MobileNavigation,
  DashboardV2Sidebar,
} from "../dashboard-v2/DashboardV2Navigation.jsx";
import { FixedExpenseForm } from "../FixedExpenseForm.jsx";
import { useFixedExpenses } from "../../hooks/useFixedExpenses.js";
import { useAccounts } from "../../hooks/useAccounts.js";
import { useCategories } from "../../hooks/useCategories.js";
import { useSubcategories } from "../../hooks/useSubcategories.js";
import { getFixedExpenseApplicableAmount } from "../../utils/transactionFixedExpenseLinking.js";
import { formatTargetDate } from "../../utils/dateFormatter.js";
import "../dashboard-v2/DashboardV2.css";
import "./FixedExpensesV2.css";
import { ActionBar, Card, KpiCard, ProgressBar, SearchInput, Select, InfoCard, EmptyState, LoadingState, ErrorState } from "../ui";

const numeric = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const money = (value) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(numeric(value));
const nextDate = (expense) =>
  expense?.nextPaymentDate ||
  expense?.nextDebitDate ||
  expense?.nextDate ||
  expense?.nextOccurrence ||
  null;
const frequencyKey = (value) => {
  const key = String(value || "").toLowerCase();
  if (["monthly", "mensuel"].includes(key)) return "monthly";
  if (["weekly", "hebdomadaire"].includes(key)) return "weekly";
  if (["quarterly", "trimestriel"].includes(key)) return "quarterly";
  if (["annual", "annuel"].includes(key)) return "annual";
  return "other";
};
const FREQUENCIES = {
  monthly: "Mensuel",
  weekly: "Hebdomadaire",
  quarterly: "Trimestriel",
  annual: "Annuel",
  other: "Autre",
};

function PageEmpty({ filtered, onCreate, onReset }) {
  return (
    <EmptyState unstyled as="div" className="v2-card recurring-v2-empty fixed-v2-empty">
      <span>
        <ReceiptText size={30} />
      </span>
      <h2>{filtered ? "Aucun résultat" : "Aucun frais fixe."}</h2>
      <p>
        {filtered
          ? "Aucun frais ne correspond aux critères sélectionnés."
          : "Ajoutez votre première dépense récurrente."}
      </p>
      <button
        type="button"
        className="recurring-v2-primary fixed-v2-primary"
        onClick={filtered ? onReset : onCreate}
      >
        {filtered ? "Réinitialiser les filtres" : "Créer un frais fixe"}
      </button>
    </EmptyState>
  );
}

export function FixedExpensesV2View({
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
    <div className="horizon-v2 recurring-v2 fixed-v2">
      <div className="v2-shell">
        <DashboardV2Sidebar active="fixed-expenses" onNavigate={onNavigate} />
        <main className="v2-main recurring-v2-main fixed-v2-main">
          <header className="v2-header">
            <div>
              <p className="v2-eyebrow">Gestion financière</p>
              <h1>Frais fixes</h1>
              <p>Suivez toutes vos dépenses récurrentes.</p>
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
          <section className="recurring-v2-kpis fixed-v2-kpis">
            <KpiCard
              className="v2-card recurring-v2-kpi fixed-v2-kpi"
              icon={ReceiptText}
              label="Frais fixes"
              value={String(summary.count || 0)}
              caption="Toutes les dépenses"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi fixed-v2-kpi"
              icon={CircleDollarSign}
              label="Montant mensuel"
              value={money(summary.monthlyTotal)}
              caption="Frais actifs"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi fixed-v2-kpi"
              icon={Clock3}
              label="Prochaine échéance"
              value={
                summary.nextDate ? formatTargetDate(summary.nextDate) : "Aucune"
              }
              caption="Prochain prélèvement disponible"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi fixed-v2-kpi"
              icon={TrendingDown}
              label="Projection annuelle"
              value={money(summary.annualTotal)}
              caption="Montant annuel estimé"
            />
          </section>
      <ActionBar className="v2-card recurring-v2-actions fixed-v2-actions">
            <label>
              <Search size={18} />
              <SearchInput unstyled
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un frais fixe…"
                aria-label="Rechercher un frais fixe"
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
              className="recurring-v2-primary fixed-v2-primary"
              onClick={onCreate}
            >
              <Plus size={18} />
              Ajouter un frais fixe
            </button>
      </ActionBar>
          <section className="recurring-v2-summary-grid">
            <InfoCard unstyled as="article" className="v2-card recurring-v2-expected fixed-v2-expected">
              <div>
                <p className="v2-eyebrow">Synthèse</p>
                <h2>Dépenses prévues</h2>
              </div>
              <div>
                <span>
                  Mensuel<strong>{money(summary.monthlyTotal)}</strong>
                </span>
                <span>
                  Annuel<strong>{money(summary.annualTotal)}</strong>
                </span>
                <span>
                  Prochaine échéance
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
                      <ProgressBar unstyled as="i" fillAs="em" fillClassName="fixed-v2-frequency-bar" value={count} max={maximum} showValue={false} ariaLabel={`${FREQUENCIES[key]} : ${count}`} />
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
            aria-label={`${rows.length} frais fixes affichés`}
          >
            {rows.map((row) => {
              const expense = row.expense;
              const active = expense.isActive !== false;
              const category = [
                expense.categoryName || expense.category,
                expense.subcategoryName,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <Card
                  className="v2-card recurring-v2-card fixed-v2-card"
                  key={expense.id}
                >
                  <header>
                    <div>
                      <span
                        className={`recurring-v2-status fixed-v2-status${active ? "" : " suspended"}`}
                      >
                        <i />
                        {active ? "Actif" : "Suspendu"}
                      </span>
                      <h2>{expense.name || "Frais sans nom"}</h2>
                    </div>
                    <div className="recurring-v2-menu-wrap">
                      <button
                        type="button"
                        className="recurring-v2-menu-button"
                        aria-label={`Actions pour ${expense.name || "ce frais"}`}
                        aria-expanded={menuId === expense.id}
                        onClick={() =>
                          setMenuId((current) =>
                            current === expense.id ? "" : expense.id,
                          )
                        }
                      >
                        <MoreVertical size={20} />
                      </button>
                      {menuId === expense.id && (
                        <div className="recurring-v2-menu">
                          <button
                            type="button"
                            onClick={() => {
                              setMenuId("");
                              onEdit(expense);
                            }}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => {
                              setMenuId("");
                              onDelete(expense.id);
                            }}
                          >
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                  </header>
                  <div className="recurring-v2-amount fixed-v2-amount">
                    <span>Montant</span>
                    <strong>{money(row.amount)}</strong>
                  </div>
                  <dl>
                    <div>
                      <dt>Fréquence</dt>
                      <dd>{FREQUENCIES[frequencyKey(expense.frequency)]}</dd>
                    </div>
                    <div>
                      <dt>Prochain prélèvement</dt>
                      <dd>
                        {nextDate(expense)
                          ? formatTargetDate(nextDate(expense))
                          : "Aucune"}
                      </dd>
                    </div>
                    <div>
                      <dt>Compte associé</dt>
                      <dd>
                        {accountsById.get(expense.accountId) ||
                          "Compte non défini"}
                      </dd>
                    </div>
                    <div>
                      <dt>Catégorie</dt>
                      <dd>{category || "Catégorie non définie"}</dd>
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
        active="fixed-expenses"
        onNavigate={onNavigate}
      />
    </div>
  );
}

export default function FixedExpensesV2({ onNavigate }) {
  const {
    fixedExpenses = [],
    loading,
    error,
    addFixedExpense,
    updateFixedExpense,
    deleteFixedExpense,
  } = useFixedExpenses();
  const { accounts = [] } = useAccounts();
  const { categories = [] } = useCategories();
  const { subcategories = [] } = useSubcategories();
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
  const referenceDate = useMemo(() => new Date(), []);
  const allRows = useMemo(
    () =>
      fixedExpenses.map((expense) => ({
        expense,
        amount: numeric(
          getFixedExpenseApplicableAmount(expense, referenceDate),
        ),
      })),
    [fixedExpenses, referenceDate],
  );
  const rows = useMemo(
    () =>
      allRows
        .filter((row) =>
          [
            row.expense.name,
            row.expense.categoryName,
            row.expense.category,
            row.expense.subcategoryName,
            accountsById.get(row.expense.accountId),
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
              ? row.expense.isActive !== false
              : row.expense.isActive === false),
        )
        .toSorted((left, right) =>
          sort === "name"
            ? String(left.expense.name || "").localeCompare(
                String(right.expense.name || ""),
                "fr",
              )
            : sort === "amount"
              ? right.amount - left.amount
              : String(nextDate(left.expense) || "9999").localeCompare(
                  String(nextDate(right.expense) || "9999"),
                ),
        ),
    [allRows, accountsById, search, status, sort],
  );
  const summary = useMemo(() => {
    const active = allRows.filter((row) => row.expense.isActive !== false);
    const monthlyTotal = active.reduce(
      (sum, row) =>
        sum +
        (frequencyKey(row.expense.frequency) === "annual"
          ? row.amount / 12
          : row.amount),
      0,
    );
    const dates = active
      .map((row) => nextDate(row.expense))
      .filter(Boolean)
      .toSorted((left, right) => String(left).localeCompare(String(right)));
    const distribution = allRows.reduce(
      (result, row) => ({
        ...result,
        [frequencyKey(row.expense.frequency)]:
          (result[frequencyKey(row.expense.frequency)] || 0) + 1,
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
    {
      console.log("[CREATE FIXED]", "service =", "FixedExpensesV2");
      console.log("[CREATE FIXED]", "function =", "submit");
      if (editing) {
        console.log("[CREATE FIXED]", "next =", "updateFixedExpense(editing.id, payload)");
        return updateFixedExpense(editing.id, payload);
      }
      console.log("[CREATE FIXED]", "next =", "addFixedExpense(payload)");
      return addFixedExpense(payload);
    };
  const remove = async (id) => {
    if (window.confirm("Supprimer ce frais fixe ?"))
      await deleteFixedExpense(id);
  };
  if (loading)
    return (
      <LoadingState unstyled as="div" className="recurring-v2-loading">Chargement des frais fixes…</LoadingState>
    );
  return (
    <>
      {error && (
        <ErrorState unstyled as="p" className="recurring-v2-error">
          {error}
        </ErrorState>
      )}
      <FixedExpensesV2View
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
        onEdit={(expense) => {
          setEditing(expense);
          setFormOpen(true);
        }}
        onDelete={remove}
        onNavigate={onNavigate}
      />
      <FixedExpenseForm
        open={formOpen}
        onClose={close}
        onSubmit={submit}
        initialExpense={editing}
        isLoading={false}
        accounts={accounts}
        categories={categories}
        subcategories={subcategories}
      />
    </>
  );
}
