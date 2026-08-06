import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  Filter,
  Landmark,
  PiggyBank,
  Search,
  ShieldCheck,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  DashboardV2MobileNavigation,
  DashboardV2Sidebar,
} from "../dashboard-v2/DashboardV2Navigation.jsx";
import { useAccounts } from "../../hooks/useAccounts.js";
import { useTransactions } from "../../hooks/useTransactions.js";
import { useFixedExpenses } from "../../hooks/useFixedExpenses.js";
import { useRecurringIncome } from "../../hooks/useRecurringIncome.js";
import { useBudgets } from "../../hooks/useBudgets.js";
import { useTransfers } from "../../hooks/useTransfers.js";
import { calculateAnnualTrajectory } from "../../services/annualTrajectoryService.js";
import { calculateBudgetMetrics } from "../../services/budgetsService.js";
import "../dashboard-v2/DashboardV2.css";
import "./ForecastV2.css";
import { ActionBar, Card, KpiCard, LineChart, SearchInput, Select, InfoCard, SectionCard, SummaryCard, EmptyState } from "../ui";
import { ErrorState } from "../ui";
import { LoadingState } from "../ui";

const numeric = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const money = (value) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(numeric(value));
const monthLabel = (key) => {
  const [year, month] = String(key || "")
    .split("-")
    .map(Number);
  return year && month
    ? new Intl.DateTimeFormat("fr-FR", { month: "short" })
        .format(new Date(year, month - 1))
        .replace(".", "")
    : "—";
};

function ForecastInfo({ icon: Icon, label, value, caption, tone = "" }) {
  return (
    <InfoCard unstyled as="article" className={`v2-card forecast-v2-info ${tone}`}>
      <span>
        <Icon size={18} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{money(value)}</strong>
        <small>{caption}</small>
      </div>
    </InfoCard>
  );
}

function chartPoints(rows) {
  if (!rows.length) return [];
  const values = rows.map((row) =>
    numeric(
      row.status === "current"
        ? row.balanceAtReferenceDate
        : row.closingBalance,
    ),
  );
  const minimum = Math.min(...values);
  const range = Math.max(Math.max(...values) - minimum, 1);
  return values.map((value, index) => ({
    x: rows.length === 1 ? 50 : 4 + (index / (rows.length - 1)) * 92,
    y: 55 - ((value - minimum) / range) * 44,
  }));
}

function curvedPath(points) {
  if (!points.length) return "";
  return points.slice(1).reduce((result, point, index) => {
    const previous = points[index];
    const middle = (previous.x + point.x) / 2;
    return `${result} C ${middle},${previous.y} ${middle},${point.y} ${point.x},${point.y}`;
  }, `M ${points[0].x},${points[0].y}`);
}

function PageEmpty({ filtered = false }) {
  return (
    <EmptyState unstyled as="div" className="forecast-v2-empty">
      <span>
        <TrendingUp size={30} />
      </span>
      <h2>
        {filtered
          ? "Aucune prévision correspondante"
          : "Votre trajectoire se dessinera ici"}
      </h2>
      <p>
        {filtered
          ? "Modifiez la recherche, la période ou les filtres pour retrouver vos données."
          : "Ajoutez des mouvements ou des flux planifiés pour obtenir une projection fiable."}
      </p>
    </EmptyState>
  );
}

function TrajectoryVisualization({ rows }) {
  const points = chartPoints(rows);
  const currentIndex = rows.findIndex((row) => row.status === "current");
  const split =
    currentIndex >= 0
      ? currentIndex
      : Math.max(
          rows.findLastIndex((row) => row.status === "actual"),
          0,
        );
  const history = points.slice(0, split + 1);
  const projection = points.slice(split);
  if (!points.length) return <PageEmpty filtered />;
  return (
    <div className="forecast-v2-chart-wrap">
      <LineChart unstyled svgClassName="forecast-v2-chart" width={100} height={62} ariaLabel="Historique, aujourd’hui et projection financière" showLegend={false}
        gridLines={[12, 27, 42, 57].map((y) => ({ y1: y, y2: y, x1: 4, x2: 96, className: "forecast-v2-gridline" }))}
        paths={[history.length > 1 && { id: "history", d: curvedPath(history), className: "forecast-v2-history" }, projection.length > 1 && { id: "projection", d: curvedPath(projection), className: "forecast-v2-projection" }].filter(Boolean)}
        marker={currentIndex >= 0 ? { line: { x1: points[currentIndex].x, x2: points[currentIndex].x, y1: 7, y2: 57, className: "forecast-v2-today-line" }, point: { cx: points[currentIndex].x, cy: points[currentIndex].y, r: 2.7, className: "forecast-v2-today-dot" } } : undefined}
        xLabels={rows.map((row) => ({ key: row.month, label: monthLabel(row.month) }))} labelsClassName="forecast-v2-months" />
    </div>
  );
}

export function ForecastV2View({
  trajectory = [],
  budgetAlerts = [],
  loading = false,
  error = null,
  onNavigate,
}) {
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("year");
  const [filter, setFilter] = useState("all");
  const current = trajectory.find((row) => row.status === "current");
  const final = trajectory.at(-1);
  const currentBalance = numeric(current?.balanceAtReferenceDate);
  const endOfMonth = numeric(current?.closingBalance);
  const yearEnd = numeric(final?.closingBalance);
  const income =
    numeric(current?.expectedRecurringIncome) +
    numeric(current?.expectedOpportunities);
  const expenses =
    numeric(current?.expectedFixedExpenses) +
    numeric(current?.remainingBudgets);
  const variation = numeric(current?.monthlyNet);
  const annualDifference = yearEnd - currentBalance;
  const negative = trajectory.find(
    (row) => row.status !== "actual" && numeric(row.closingBalance) < 0,
  );
  const alerts = [
    ...budgetAlerts,
    ...(negative
      ? [
          {
            id: `negative-${negative.month}`,
            title: "Découvert futur",
            detail: `Le solde projeté devient négatif en ${monthLabel(negative.month)} (${money(negative.closingBalance)}).`,
          },
        ]
      : []),
  ];
  const hasData = trajectory.some((row) =>
    [
      row.actualRevenue,
      row.actualExpense,
      row.expectedRecurringIncome,
      row.expectedFixedExpenses,
      row.remainingBudgets,
      row.balanceAtReferenceDate,
    ].some((value) => numeric(value) !== 0),
  );
  const visible = trajectory
    .filter((row) => (period === "month" ? row.status === "current" : true))
    .filter(
      (row) =>
        filter === "all" ||
        (filter === "history"
          ? row.status === "actual"
          : row.status !== "actual"),
    )
    .filter(
      (row) =>
        !search.trim() ||
        monthLabel(row.month)
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    );

  return (
    <div className="horizon-v2 forecast-v2">
      <div className="v2-shell">
        <DashboardV2Sidebar active="forecast" onNavigate={onNavigate} />
        <main className="v2-main forecast-v2-main">
          <header className="v2-header">
            <div>
              <p className="v2-eyebrow">Pilotage financier</p>
              <h1>Prévisions</h1>
              <p>
                Anticipez votre situation financière avant qu'elle n'arrive.
              </p>
            </div>
          </header>
          {error && (
            <ErrorState unstyled as="div" className="forecast-v2-error">
              {String(error)}
            </ErrorState>
          )}
      <ActionBar className="v2-card forecast-v2-actions">
            <label>
              <Search size={18} />
              <SearchInput unstyled
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un mois…"
                aria-label="Rechercher dans les prévisions"
              />
            </label>
            <div className="forecast-v2-select">
              <CalendarDays size={18} />
              <Select unstyled
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                aria-label="Période"
              >
                <option value="year">Cette année</option>
                <option value="month">Ce mois</option>
              </Select>
              <ChevronDown size={16} />
            </div>
            <div className="forecast-v2-select">
              <Filter size={18} />
              <Select unstyled
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                aria-label="Filtres"
              >
                <option value="all">Filtres</option>
                <option value="history">Historique</option>
                <option value="projection">Projection</option>
              </Select>
              <ChevronDown size={16} />
            </div>
            <button
              type="button"
              className="v2-bell"
              aria-label="Ouvrir les notifications"
            >
              <Bell size={18} />
              {alerts.length > 0 && <i />}
            </button>
      </ActionBar>
          <section
            className="forecast-v2-kpis"
            aria-label="Indicateurs prévisionnels"
          >
            <KpiCard
              className="v2-card forecast-v2-kpi"
              headerClassName="forecast-v2-kpi-top"
              icon={WalletCards}
              label="Solde actuel"
              value={money(currentBalance)}
              caption="Situation aujourd’hui"
            />
            <KpiCard
              className={`v2-card forecast-v2-kpi${endOfMonth < 0 ? " danger" : ""}`}
              headerClassName="forecast-v2-kpi-top"
              icon={Landmark}
              label="Solde prévu fin de mois"
              value={money(endOfMonth)}
              caption="Estimation disponible"
            />
            <KpiCard
              className={`v2-card forecast-v2-kpi primary${yearEnd < 0 ? " danger" : ""}`}
              headerClassName="forecast-v2-kpi-top"
              icon={CircleDollarSign}
              label="Projection au 31 décembre"
              value={money(yearEnd)}
              caption="Trajectoire annuelle"
              badge={
                <span className="forecast-v2-badge">Projection annuelle</span>
              }
            />
            <KpiCard
              className={`v2-card forecast-v2-kpi${variation < 0 ? " danger" : ""}`}
              headerClassName="forecast-v2-kpi-top"
              icon={TrendingUp}
              label="Variation prévisionnelle"
              value={money(variation)}
              caption="Revenus moins dépenses"
            />
          </section>
          {loading ? (
            <LoadingState unstyled as="div" className="forecast-v2-loading">
              Calcul de votre trajectoire…
            </LoadingState>
          ) : !hasData ? (
            <PageEmpty />
          ) : (
            <>
              <SectionCard unstyled as="section" className="v2-card forecast-v2-summary">
                <div>
                  <p className="v2-eyebrow">Résumé des prévisions</p>
                  <h2>
                    Si votre trajectoire actuelle se poursuit,
                    <br />
                    vous devriez terminer l’année avec :
                  </h2>
                </div>
                <div className="forecast-v2-summary-value">
                  <strong>{money(yearEnd)}</strong>
                  <span>
                    soit{" "}
                    <b>
                      {annualDifference >= 0 ? "+" : ""}
                      {money(annualDifference)}
                    </b>{" "}
                    par rapport à aujourd’hui.
                  </span>
                </div>
              </SectionCard>
              <SectionCard unstyled as="section" className="v2-card forecast-v2-panel forecast-v2-trajectory">
                <div className="forecast-v2-heading">
                  <div>
                    <p>Trajectoire financière</p>
                    <h2>D’aujourd’hui au 31 décembre</h2>
                  </div>
                </div>
                <div className="forecast-v2-chart-values">
                  <div>
                    <span>Aujourd’hui</span>
                    <strong>{money(currentBalance)}</strong>
                  </div>
                  <div>
                    <span>31 décembre</span>
                    <strong>{money(yearEnd)}</strong>
                  </div>
                </div>
                <div className="forecast-v2-legend">
                  <span>
                    <i />
                    Historique
                  </span>
                  <span>
                    <i className="today" />
                    Aujourd’hui
                  </span>
                  <span>
                    <i className="projection" />
                    Projection
                  </span>
                </div>
                <TrajectoryVisualization rows={visible} />
              </SectionCard>
              <section className="forecast-v2-projection-block">
                <div className="forecast-v2-block-title">
                  <p>Flux attendus</p>
                  <h2>Projection</h2>
                </div>
                <div className="forecast-v2-projection-grid">
                  <ForecastInfo
                    icon={TrendingUp}
                    label="Revenus prévus"
                    value={income}
                    caption="Flux attendus"
                  />
                  <ForecastInfo
                    icon={CircleDollarSign}
                    label="Dépenses prévues"
                    value={expenses}
                    caption="Charges et budgets"
                    tone="expense"
                  />
                </div>
              </section>
              <SectionCard unstyled as="section"
                className={`v2-card forecast-v2-saving${variation < 0 ? " expense" : ""}`}
              >
                <span className="v2-icon">
                  <PiggyBank size={21} />
                </span>
                <div>
                  <p>Épargne attendue</p>
                  <strong>{money(variation)}</strong>
                  <small>Variation prévisionnelle</small>
                </div>
              </SectionCard>
              <section className="forecast-v2-watch">
                <div className="forecast-v2-block-title">
                  <p>Points d’attention</p>
                  <h2>À surveiller</h2>
                </div>
                {alerts.length ? (
                  <div className="forecast-v2-alerts">
                    {alerts.map((alert) => (
                      <Card className="v2-card" key={alert.id}>
                        <span className="forecast-v2-alert-icon">
                          <AlertTriangle size={19} />
                        </span>
                        <div>
                          <strong>{alert.title}</strong>
                          <p>{alert.detail}</p>
                        </div>
                        {alert.id.startsWith("budget-") && (
                          <button
                            type="button"
                            onClick={() => onNavigate?.("budgets")}
                          >
                            Voir le budget <ArrowRight size={15} />
                          </button>
                        )}
                      </Card>
                    ))}
                  </div>
                ) : (
                  <SummaryCard unstyled as="div" className="v2-card forecast-v2-clear">
                    <ShieldCheck size={22} />
                    <div>
                      <strong>Aucun risque détecté</strong>
                      <p>Toutes les prévisions disponibles sont cohérentes.</p>
                    </div>
                  </SummaryCard>
                )}
              </section>
            </>
          )}
        </main>
      </div>
      <DashboardV2MobileNavigation active="forecast" onNavigate={onNavigate} />
    </div>
  );
}

export default function ForecastV2({ onNavigate }) {
  const accounts = useAccounts();
  const transactions = useTransactions();
  const fixed = useFixedExpenses();
  const incomes = useRecurringIncome();
  const budgets = useBudgets();
  const transfers = useTransfers();
  const trajectory = useMemo(
    () =>
      calculateAnnualTrajectory({
        accounts: accounts.accounts,
        transactions: transactions.transactions,
        fixedExpenses: fixed.fixedExpenses,
        recurringIncome: incomes.recurringIncome,
        budgets: budgets.budgets,
        transfers: transfers.transfers,
      }),
    [
      accounts.accounts,
      transactions.transactions,
      fixed.fixedExpenses,
      incomes.recurringIncome,
      budgets.budgets,
      transfers.transfers,
    ],
  );
  const budgetAlerts = useMemo(
    () =>
      (budgets.budgets || [])
        .map((budget) => ({
          budget,
          metrics: calculateBudgetMetrics(
            budget,
            transactions.transactions || [],
          ),
        }))
        .filter(({ metrics }) => numeric(metrics.consumedPercent) > 100)
        .map(({ budget, metrics }) => ({
          id: `budget-${budget.id}`,
          title: budget.name || budget.categoryName || "Budget dépassé",
          detail: `Ce budget atteint ${numeric(metrics.consumedPercent).toFixed(0)} % (${money(Math.abs(numeric(metrics.remainingAmount)))} de dépassement).`,
        })),
    [budgets.budgets, transactions.transactions],
  );
  const states = [accounts, transactions, fixed, incomes, budgets, transfers];
  return (
    <ForecastV2View
      trajectory={trajectory}
      budgetAlerts={budgetAlerts}
      loading={states.some((state) => state.loading)}
      error={states.find((state) => state.error)?.error}
      onNavigate={onNavigate}
    />
  );
}

