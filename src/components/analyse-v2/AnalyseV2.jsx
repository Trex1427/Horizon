import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  ChevronDown,
  Filter,
  PiggyBank,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  WalletCards,
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
import "./AnalyseV2.css";
import { ActionBar, Card, DonutChart, KpiCard, LineChart, SearchInput, Select, InfoCard, SectionCard, SummaryCard, EmptyState, ErrorState, LoadingState } from "../ui";

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
    : "N/A";
const COLORS = [
  "#0f5c5e",
  "#6d9e91",
  "#d8a458",
  "#d8786f",
  "#5f7d80",
  "#aebfba",
];

function path(values, width = 100, height = 54) {
  if (!values.length) return "";
  const low = Math.min(...values);
  const range = Math.max(Math.max(...values) - low, 1);
  const points = values.map((value, index) => [
    values.length === 1 ? width / 2 : (index / (values.length - 1)) * width,
    height - 5 - ((value - low) / range) * (height - 10),
  ]);
  return points.slice(1).reduce((result, point, index) => {
    const previous = points[index];
    const middle = (previous[0] + point[0]) / 2;
    return `${result} C ${middle},${previous[1]} ${middle},${point[1]} ${point[0]},${point[1]}`;
  }, `M ${points[0][0]},${points[0][1]}`);
}

function EvolutionVisualization({ expenses = [], incomes = [] }) {
  const labels =
    expenses.length >= incomes.length
      ? expenses.map((row) => row.label)
      : incomes.map((row) => row.label);
  return labels.length ? (
    <div className="analyse-v2-chart-wrap">
      <LineChart unstyled svgClassName="analyse-v2-chart" width={100} height={58} ariaLabel="Évolution des revenus et dépenses" showLegend={false}
        gridLines={[12, 27, 42, 55].map((y) => ({ y1: y, y2: y, x1: 0, x2: 100, className: "analyse-v2-gridline" }))}
        paths={[{ id: "income", d: path(incomes.map((row) => amount(row.value))), className: "analyse-v2-income-line" }, { id: "expense", d: path(expenses.map((row) => amount(row.value))), className: "analyse-v2-expense-line" }]}
        xLabels={labels.map((label, index) => ({ key: `${label}-${index}`, label }))} labelsClassName="analyse-v2-axis" />
    </div>
  ) : (
    <PageEmpty
      compact
      text="L’évolution apparaîtra dès que la période contient des mouvements."
    />
  );
}

function ExpenseDistribution({ segments = [], total = 0 }) {
  const stops = segments
    .filter((item) => amount(item.percentage) > 0)
    .reduce(
      (result, item, index) => {
        const end = result.offset + amount(item.percentage);
        return {
          offset: end,
          values: [
            ...result.values,
            `${COLORS[index % COLORS.length]} ${result.offset}% ${end}%`,
          ],
        };
      },
      { offset: 0, values: [] },
    ).values;
  return stops.length ? (
    <DonutChart unstyled variant="conic" segments={segments.map((item, index) => ({ label: item.name || item.label || `Catégorie ${index + 1}`, value: amount(item.percentage), color: COLORS[index % COLORS.length] }))} gradient={`conic-gradient(${stops.join(",")})`} visualClassName="analyse-v2-donut" showLegend={false} ariaLabel="Répartition des dépenses" centerLabel={<div>
        <strong>{money(total)}</strong>
        <small>Total dépenses</small>
      </div>} />
  ) : (
    <PageEmpty compact text="Aucune dépense sur cette période." />
  );
}

function PageEmpty({
  compact = false,
  text = "Aucune donnée analytique disponible pour cette période.",
}) {
  return (
    <EmptyState unstyled as="div" className={`analyse-v2-empty${compact ? " compact" : ""}`}>
      <span>
        <TrendingUp size={28} />
      </span>
      <strong>Analyse à venir</strong>
      <p>{text}</p>
    </EmptyState>
  );
}

function CategoryList({ items = [] }) {
  return items.length ? (
    <div className="analyse-v2-ranking">
      {items.slice(0, 5).map((item, index) => (
        <div key={item.categoryName || item.name}>
          <span className="analyse-v2-rank">{index + 1}</span>
          <div>
            <strong>{item.categoryName || item.name}</strong>
            <small>{amount(item.percentage).toFixed(1)} % des dépenses</small>
          </div>
          <b>{money(item.amount)}</b>
        </div>
      ))}
    </div>
  ) : (
    <PageEmpty compact text="Aucune catégorie à classer." />
  );
}

function AnalysisCard({ icon: Icon, label, value, variation, tone }) {
  return (
    <InfoCard unstyled as="article" className={`v2-card analyse-v2-insight ${tone}`}>
      <span>
        <Icon size={19} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{money(value)}</strong>
        <small>{variation}</small>
      </div>
    </InfoCard>
  );
}

export function AnalyseV2View({
  snapshot,
  accounts = [],
  period,
  setPeriod,
  accountId,
  setAccountId,
  search,
  setSearch,
  loading,
  error,
  onNavigate,
}) {
  const totals = snapshot?.totals || {};
  const expenses = amount(totals.expenses);
  const revenues = amount(totals.revenues);
  const balance = amount(totals.analyticalBalance);
  const savingsRate = revenues > 0 ? (balance / revenues) * 100 : 0;
  const expenseSegments = [
    ...(snapshot?.variableExpenses?.segments || []),
    ...(snapshot?.fixedExpenses?.segments || []),
  ].toSorted((left, right) => amount(right.amount) - amount(left.amount));
  const visibleSegments = expenseSegments.filter((item) =>
    String(item.categoryName || item.name || "")
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const top = expenseSegments[0];
  const attention = [
    amount(snapshot?.variableExpenses?.variation) > 20
      ? {
          id: "expenses-rise",
          title: "Dépenses en hausse",
          detail: `${percent(snapshot.variableExpenses.variation)} par rapport à la période précédente.`,
        }
      : null,
    top && amount(top.percentage) >= 35
      ? {
          id: "dominant",
          title: "Catégorie dominante",
          detail: `${top.categoryName || top.name} représente ${amount(top.percentage).toFixed(1)} % de son bloc.`,
        }
      : null,
    amount(snapshot?.variableIncome?.variation) < -15 ||
    amount(snapshot?.fixedIncome?.variation) < -15
      ? {
          id: "income-drop",
          title: "Revenus en baisse",
          detail: `Fixes : ${percent(snapshot.fixedIncome.variation)} · variables : ${percent(snapshot.variableIncome.variation)}.`,
        }
      : null,
  ].filter(Boolean);
  const hasData = revenues !== 0 || expenses !== 0;
  return (
    <div className="horizon-v2 analyse-v2">
      <div className="v2-shell">
        <DashboardV2Sidebar active="analysis" onNavigate={onNavigate} />
        <main className="v2-main analyse-v2-main">
          <header className="v2-header">
            <div>
              <p className="v2-eyebrow">Pilotage financier</p>
              <h1>Analyse</h1>
              <p>Comprenez vos finances grâce à des indicateurs visuels.</p>
            </div>
            <div className="v2-header-actions">
              <button
                type="button"
                className="v2-bell"
                aria-label="Ouvrir les notifications"
              >
                <Bell size={18} />
                {attention.length > 0 && <i />}
              </button>
            </div>
          </header>
      <ActionBar className="v2-card analyse-v2-actions">
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
              <Filter size={18} />
              <Select unstyled
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
                aria-label="Filtres"
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
      </ActionBar>
          {error && (
            <ErrorState unstyled as="p" className="analyse-v2-error">
              {String(error)}
            </ErrorState>
          )}
          <section className="analyse-v2-kpis">
            <KpiCard
              className="v2-card analyse-v2-kpi income"
              icon={TrendingUp}
              label="Revenus de la période"
              value={money(revenues)}
              caption={percent(snapshot?.variableIncome?.variation)}
            />
            <KpiCard
              className={`v2-card analyse-v2-kpi expense${expenses > revenues ? " danger" : ""}`}
              icon={TrendingDown}
              label="Dépenses de la période"
              value={money(expenses)}
              caption={percent(snapshot?.variableExpenses?.variation)}
            />
            <KpiCard
              className={`v2-card analyse-v2-kpi saving${savingsRate < 0 ? " danger" : ""}`}
              icon={PiggyBank}
              label="Épargne nette"
              value={`${savingsRate.toFixed(1)} %`}
              caption="Taux d’épargne disponible"
            />
            <KpiCard
              className={`v2-card analyse-v2-kpi saving${balance < 0 ? " danger" : ""}`}
              icon={WalletCards}
              label="Solde net"
              value={money(balance)}
              caption="Solde analytique"
            />
          </section>
          {loading ? (
            <LoadingState unstyled as="div" className="analyse-v2-loading">
              Chargement de l’analyse…
            </LoadingState>
          ) : !hasData ? (
            <PageEmpty />
          ) : (
            <>
              <SectionCard unstyled as="section" className="v2-card analyse-v2-panel analyse-v2-evolution">
                <div className="analyse-v2-heading">
                  <div>
                    <p>Tendance</p>
                    <h2>Évolution des finances</h2>
                    {revenues > 0 && (
                      <span className="analyse-v2-auto-insight">
                        Votre capacité d’épargne actuelle est de{" "}
                        <strong>{savingsRate.toFixed(1)} %</strong>.
                      </span>
                    )}
                  </div>
                  <div className="analyse-v2-legend">
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
              <section className="analyse-v2-split">
                <InfoCard unstyled as="article" className="v2-card analyse-v2-panel">
                  <div className="analyse-v2-heading">
                    <div>
                      <p>Structure</p>
                      <h2>Répartition des dépenses</h2>
                    </div>
                  </div>
                  <ExpenseDistribution
                    segments={snapshot.variableExpenses.segments}
                    total={snapshot.variableExpenses.total}
                  />
                </InfoCard>
                <InfoCard unstyled as="article" className="v2-card analyse-v2-panel">
                  <div className="analyse-v2-heading">
                    <div>
                      <p>Classement</p>
                      <h2>Top catégories</h2>
                    </div>
                  </div>
                  <CategoryList items={visibleSegments} />
                </InfoCard>
              </section>
              <section className="analyse-v2-insights">
                <AnalysisCard
                  icon={TrendingUp}
                  label="Revenus"
                  value={revenues}
                  variation={percent(snapshot.variableIncome.variation)}
                  tone="income"
                />
                <AnalysisCard
                  icon={TrendingDown}
                  label="Dépenses"
                  value={expenses}
                  variation={percent(snapshot.variableExpenses.variation)}
                  tone="expense"
                />
                <AnalysisCard
                  icon={PiggyBank}
                  label="Épargne"
                  value={balance}
                  variation={`${savingsRate.toFixed(1)} % des revenus`}
                  tone="saving"
                />
              </section>
              <section className="analyse-v2-attention">
                <div className="analyse-v2-section-title">
                  <p>Lecture automatique</p>
                  <h2>Points d’attention</h2>
                </div>
                {attention.length ? (
                  <div className="analyse-v2-alerts">
                    {attention.map((item) => (
                      <Card className="v2-card" key={item.id}>
                        <span>
                          <AlertTriangle size={19} />
                        </span>
                        <div>
                          <strong>{item.title}</strong>
                          <p>{item.detail}</p>
                        </div>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <SummaryCard unstyled as="div" className="v2-card analyse-v2-clear">
                    <ShieldCheck size={23} />
                    <div>
                      <strong>Aucun point d’attention</strong>
                      <p>
                        Les données disponibles ne signalent aucune évolution
                        notable.
                      </p>
                    </div>
                  </SummaryCard>
                )}
              </section>
            </>
          )}
        </main>
      </div>
      <DashboardV2MobileNavigation active="analysis" onNavigate={onNavigate} />
    </div>
  );
}

export default function AnalyseV2({ onNavigate }) {
  const transactionsState = useTransactionsContext();
  const fixedState = useFixedExpenses();
  const incomeState = useRecurringIncome();
  const accountsState = useAccounts();
  const categoriesState = useCategories();
  const subcategoriesState = useSubcategories();
  const [period, setPeriod] = useState("currentMonth");
  const [accountId, setAccountId] = useState("all");
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
    ],
  );
  const states = [transactionsState, fixedState, incomeState];
  return (
    <AnalyseV2View
      snapshot={snapshot}
      accounts={accountsState.accounts || []}
      period={period}
      setPeriod={setPeriod}
      accountId={accountId}
      setAccountId={setAccountId}
      search={search}
      setSearch={setSearch}
      loading={states.some((state) => state.loading)}
      error={states.find((state) => state.error)?.error}
      onNavigate={onNavigate}
    />
  );
}
