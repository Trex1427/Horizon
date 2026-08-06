import { useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Filter,
  Landmark,
  Lightbulb,
  PiggyBank,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  DashboardV2MobileNavigation,
  DashboardV2Sidebar,
} from "../dashboard-v2/DashboardV2Navigation.jsx";
import { useTransactionsContext } from "../../context/TransactionsContext.jsx";
import { useFixedExpenses } from "../../hooks/useFixedExpenses.js";
import { useRecurringIncome } from "../../hooks/useRecurringIncome.js";
import { useAccounts } from "../../hooks/useAccounts.js";
import { useCategories } from "../../hooks/useCategories.js";
import { useSubcategories } from "../../hooks/useSubcategories.js";
import {
  buildAnalysisSnapshot,
  getPeriodRange,
  getPreviousPeriodRange,
} from "../../utils/analysisDataUtils.js";
import "../dashboard-v2/DashboardV2.css";
import "../analyse-v2/AnalyseV2.css";
import "./ReportsV2.css";
import { ActionBar, DonutChart, KpiCard, LineChart, SearchInput, Select, SectionCard, InfoCard, EmptyState } from "../ui";
import { ErrorState } from "../ui";
import { LoadingState } from "../ui";

const amount = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const money = (value) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount(value));
const percent = (value) =>
  Number.isFinite(Number(value))
    ? `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(1)} %`
    : "À venir";

function chartPath(values, width = 100, height = 58) {
  if (!values.length) return "";
  const low = Math.min(...values);
  const range = Math.max(Math.max(...values) - low, 1);
  const points = values.map((value, index) => [
    values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
    height - 6 - ((value - low) / range) * (height - 12),
  ]);
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const middle = (previous[0] + point[0]) / 2;
    return `${path} C ${middle},${previous[1]} ${middle},${point[1]} ${point[0]},${point[1]}`;
  }, `M ${points[0][0]},${points[0][1]}`);
}
function EvolutionVisualization({ incomes = [], expenses = [] }) {
  const labels =
    expenses.length >= incomes.length
      ? expenses.map((row) => row.label)
      : incomes.map((row) => row.label);
  return labels.length ? (
    <div className="reports-v2-chart-wrap">
      <LineChart unstyled width={100} height={60} ariaLabel="Évolution des revenus et dépenses" showLegend={false}
        gridLines={[13, 28, 43, 57].map((y) => ({ y1: y, y2: y, x1: 0, x2: 100 }))}
        paths={[{ id: "income", d: chartPath(incomes.map((row) => amount(row.value))), className: "income" }, { id: "expense", d: chartPath(expenses.map((row) => amount(row.value))), className: "expense" }]}
        xLabels={labels.map((label, index) => ({ key: `${label}-${index}`, label }))} />
    </div>
  ) : null;
}
function PageEmpty() {
  return (
    <EmptyState unstyled as="div" className="v2-card reports-v2-empty">
      <span>
        <TrendingUp size={30} />
      </span>
      <h2>Aucune donnée disponible.</h2>
      <p>
        Les rapports apparaîtront lorsque vous aurez suffisamment de données.
      </p>
    </EmptyState>
  );
}

export function ReportsV2View({
  snapshot,
  accounts = [],
  categories = [],
  period,
  setPeriod,
  accountId,
  setAccountId,
  category,
  setCategory,
  search,
  setSearch,
  loading,
  error,
  onNavigate,
}) {
  const totals = snapshot?.totals || {};
  const revenues = amount(totals.revenues);
  const expenses = amount(totals.expenses);
  const savings = amount(totals.analyticalBalance);
  const savingsRate = revenues > 0 ? (savings / revenues) * 100 : null;
  const allExpenseSegments = [
    ...(snapshot?.variableExpenses?.segments || []),
    ...(snapshot?.fixedExpenses?.segments || []),
  ].toSorted((left, right) => amount(right.amount) - amount(left.amount));
  const visibleSegments = allExpenseSegments.filter((item) =>
    String(item.categoryName || item.name || "")
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const top = allExpenseSegments[0];
  const insights = [
    top
      ? `${top.categoryName || top.name} est la principale catégorie de dépense avec ${money(top.amount)}.`
      : null,
    Number.isFinite(Number(snapshot?.variableIncome?.variation))
      ? `Les revenus variables évoluent de ${percent(snapshot.variableIncome.variation)} par rapport à la période précédente.`
      : null,
    Number.isFinite(Number(snapshot?.variableExpenses?.variation))
      ? `Les dépenses variables évoluent de ${percent(snapshot.variableExpenses.variation)} par rapport à la période précédente.`
      : null,
  ].filter(Boolean);
  const hasData = revenues !== 0 || expenses !== 0;
  return (
    <div className="horizon-v2 analyse-v2 reports-v2">
      <div className="v2-shell">
        <DashboardV2Sidebar active="reports" onNavigate={onNavigate} />
        <main className="v2-main analyse-v2-main reports-v2-main">
          <header className="v2-header">
            <div>
              <p className="v2-eyebrow">Gestion financière</p>
              <h1>Rapports</h1>
              <p>Analysez vos finances sur différentes périodes.</p>
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
          <section className="analyse-v2-kpis reports-v2-kpis">
            <KpiCard
              className="v2-card analyse-v2-kpi reports-v2-kpi income"
              icon={TrendingUp}
              label="Revenus"
              value={money(revenues)}
              caption="Total de la période"
            />
            <KpiCard
              className="v2-card analyse-v2-kpi reports-v2-kpi expense"
              icon={TrendingDown}
              label="Dépenses"
              value={money(expenses)}
              caption="Total de la période"
            />
            <KpiCard
              className="v2-card analyse-v2-kpi reports-v2-kpi saving"
              icon={PiggyBank}
              label="Épargne"
              value={money(savings)}
              caption="Revenus − Dépenses"
            />
            <KpiCard
              className="v2-card analyse-v2-kpi reports-v2-kpi saving"
              icon={CircleDollarSign}
              label="Taux d'épargne"
              value={savingsRate === null ? "À venir" : percent(savingsRate)}
              caption="Part des revenus épargnée"
            />
          </section>
      <ActionBar className="v2-card reports-v2-actions">
            <label>
              <Search size={18} />
              <SearchInput unstyled
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher une catégorie…"
                aria-label="Recherche"
              />
            </label>
            <div>
              <CalendarDays size={18} />
              <Select unstyled
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                aria-label="Période"
              >
                <option value="currentMonth">Ce mois</option>
                <option value="previousMonth">Mois précédent</option>
                <option value="last3Months">3 derniers mois</option>
                <option value="currentYear">Cette année</option>
              </Select>
              <ChevronDown size={16} />
            </div>
            <div>
              <Landmark size={18} />
              <Select unstyled
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                aria-label="Comptes"
              >
                <option value="all">Tous les comptes</option>
                {accounts.map((account) => (
                  <option value={account.id} key={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
              <ChevronDown size={16} />
            </div>
            <div>
              <Filter size={18} />
              <Select unstyled
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                aria-label="Catégories"
              >
                <option value="all">Toutes les catégories</option>
                {categories
                  .filter((item) => item.isActive !== false)
                  .map((item) => (
                    <option value={item.name} key={item.id}>
                      {item.name}
                    </option>
                  ))}
              </Select>
              <ChevronDown size={16} />
            </div>
      </ActionBar>
          {error && (
            <ErrorState unstyled as="p" className="analyse-v2-error">
              {String(error)}
            </ErrorState>
          )}
          {loading ? (
            <LoadingState unstyled as="div" className="analyse-v2-loading">
              Chargement des rapports…
            </LoadingState>
          ) : !hasData ? (
            <PageEmpty />
          ) : (
            <>
              <SectionCard unstyled as="section" className="v2-card reports-v2-panel reports-v2-evolution">
                <div className="reports-v2-heading">
                  <div>
                    <p>Tendance</p>
                    <h2>Évolution des revenus et dépenses</h2>
                  </div>
                  <div className="reports-v2-legend">
                    <span>
                      <i className="income" />
                      Revenus
                    </span>
                    <span>
                      <i className="expense" />
                      Dépenses
                    </span>
                  </div>
                </div>
                <EvolutionVisualization
                  incomes={snapshot.variableIncome.trend}
                  expenses={snapshot.variableExpenses.trend}
                />
              </SectionCard>
              <section className="reports-v2-split">
                <article className="reports-v2-donut-card">
                  <div className="reports-v2-heading"><div><p>Structure</p><h2>Répartition des dépenses</h2><small>Dépenses de la période sélectionnée</small></div></div>
                  <DonutChart segments={visibleSegments.map((item, index) => ({ label: item.categoryName || item.name || `Catégorie ${index + 1}`, value: amount(item.amount ?? item.value), color: item.color }))} centerLabel={<><small>Total dépenses</small><strong>{money(expenses)}</strong></>} ariaLabel="Répartition des dépenses" empty={<EmptyState unstyled as="p">Aucune dépense sur cette période.</EmptyState>} />
                </article>
                <InfoCard unstyled as="article" className="v2-card reports-v2-points">
                  <div className="reports-v2-heading">
                    <div>
                      <p>Lecture automatique</p>
                      <h2>Points clés</h2>
                    </div>
                    <Lightbulb size={21} />
                  </div>
                  {insights.length ? (
                    <ul>
                      {insights.map((insight) => (
                        <li key={insight}>{insight}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="reports-v2-no-insight">
                      Aucun point clé calculable sur cette période.
                    </p>
                  )}
                </InfoCard>
              </section>
              <SectionCard unstyled as="section" className="v2-card reports-v2-comparison">
                <div>
                  <span>Revenus</span>
                  <strong className="income">{money(revenues)}</strong>
                </div>
                <div>
                  <span>Dépenses</span>
                  <strong className="expense">{money(expenses)}</strong>
                </div>
                <div>
                  <span>Épargne</span>
                  <strong className="saving">{money(savings)}</strong>
                </div>
              </SectionCard>
            </>
          )}
        </main>
      </div>
      <DashboardV2MobileNavigation active="reports" onNavigate={onNavigate} />
    </div>
  );
}

export default function ReportsV2({ onNavigate }) {
  const transactionsState = useTransactionsContext();
  const fixedState = useFixedExpenses();
  const incomeState = useRecurringIncome();
  const accountsState = useAccounts();
  const categoriesState = useCategories();
  const subcategoriesState = useSubcategories();
  const [period, setPeriod] = useState("currentMonth");
  const [accountId, setAccountId] = useState("all");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const referenceDate = useMemo(() => new Date(), []);
  const range = useMemo(
    () => getPeriodRange(period, referenceDate),
    [period, referenceDate],
  );
  const previousRange = useMemo(
    () => getPreviousPeriodRange(period, referenceDate),
    [period, referenceDate],
  );
  const snapshot = useMemo(
    () =>
      buildAnalysisSnapshot({
        transactions: transactionsState.transactions,
        fixedExpenses: fixedState.fixedExpenses,
        recurringIncome: incomeState.recurringIncome,
        categories: categoriesState.categories,
        subcategories: subcategoriesState.subcategories,
        range,
        previousRange,
        accountId,
        selectedCategory: category,
      }),
    [
      transactionsState.transactions,
      fixedState.fixedExpenses,
      incomeState.recurringIncome,
      categoriesState.categories,
      subcategoriesState.subcategories,
      range,
      previousRange,
      accountId,
      category,
    ],
  );
  const states = [transactionsState, fixedState, incomeState];
  return (
    <ReportsV2View
      snapshot={snapshot}
      accounts={accountsState.accounts || []}
      categories={categoriesState.categories || []}
      period={period}
      setPeriod={setPeriod}
      accountId={accountId}
      setAccountId={setAccountId}
      category={category}
      setCategory={setCategory}
      search={search}
      setSearch={setSearch}
      loading={states.some((state) => state.loading)}
      error={states.find((state) => state.error)?.error}
      onNavigate={onNavigate}
    />
  );
}

