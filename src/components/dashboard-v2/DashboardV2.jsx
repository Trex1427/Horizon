import { useEffect } from "react";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays, ChevronDown,
  CircleDollarSign, CreditCard, FileChartColumn, Landmark, Plus, Target, WalletCards,
} from "lucide-react";
import { DashboardV2MobileNavigation, DashboardV2Sidebar } from "./DashboardV2Navigation.jsx";
import "./DashboardV2.css";
import { DonutChart, KpiCard, LineChart, ProgressBar, Sparkline, SectionCard, EmptyState } from "../ui";

const DONUT_COLORS = ["#0f5c5e", "#6d9e91", "#d8a458", "#aebfba", "#d8786f", "#5f7d80"];

function number(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function currency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  }).format(number(value));
}

function shortDate(value) {
  const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date non renseignée"
    : new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(date);
}

function linePoints(values, width = 100, height = 48) {
  if (!values.length) return "";
  const minimum = Math.min(...values);
  const range = Math.max(Math.max(...values) - minimum, 1);
  return values.map((value, index) => {
    const x = values.length > 1 ? (index / (values.length - 1)) * width : width / 2;
    const y = height - 4 - ((value - minimum) / range) * (height - 8);
    return `${x},${y}`;
  }).join(" ");
}

function smoothPath(points) {
  if (!points) return "";
  const coordinates = points.split(" ").map((point) => point.split(",").map(Number));
  if (coordinates.length < 2) return "";
  return coordinates.slice(1).reduce((path, point, index) => {
    const previous = coordinates[index];
    const middleX = (previous[0] + point[0]) / 2;
    return `${path} C ${middleX},${previous[1]} ${middleX},${point[1]} ${point[0]},${point[1]}`;
  }, `M ${coordinates[0][0]},${coordinates[0][1]}`);
}

function sparklineModel(values) {
  const points = linePoints(values.map(number), 78, 34);
  return smoothPath(points);
}

function Variation({ children = "—" }) {
  const label = String(children);
  const negative = label.trim().startsWith("-");
  const Icon = negative ? ArrowDownRight : ArrowUpRight;
  return <span className={`v2-variation${negative ? " negative" : ""}`}><Icon size={14} />{label}</span>;
}

function Heading({ title, caption, action, onAction }) {
  return <div className="v2-heading"><div><h2>{title}</h2>{caption && <p>{caption}</p>}</div>{action && <button type="button" className="v2-action" onClick={onAction}>{action}<ArrowRight size={15} /></button>}</div>;
}

function mainChartModel(rows) {
  const values = rows.map((row) => number(row?.status === "current" ? row?.balanceAtReferenceDate : row?.closingBalance));
  const allPoints = linePoints(values, 100, 58);
  const pointList = allPoints.split(" ");
  const firstProjection = rows.findIndex((row) => row?.status === "current" || row?.status === "forecast");
  const actualEnd = firstProjection >= 0 ? firstProjection : rows.length - 1;
  const actualPoints = pointList.slice(0, actualEnd + 1).join(" ");
  const projectedPoints = pointList.slice(Math.max(actualEnd, 0)).join(" ");
  return { allPoints, actualPath: smoothPath(actualPoints), projectedPath: smoothPath(projectedPoints), labels: rows.map((row, index) => ({ key: `${row?.label || row?.month}-${index}`, label: row?.label || String(row?.month || "").slice(5) })) };
}

function donutModel(data) {
  return data.filter((item) => number(item?.percent) > 0).map((item, index) => ({ label: item?.name || item?.label || `Catégorie ${index + 1}`, value: number(item.percent), color: DONUT_COLORS[index % DONUT_COLORS.length] }));
}

function InlineEmpty({ children }) {
  return <EmptyState unstyled as="div" className="v2-empty">{children}</EmptyState>;
}

function Budgets({ items, onOpen }) {
  const visible = items.filter((item) => Number.isFinite(Number(item?.progress))).slice(0, 3);
  return <SectionCard unstyled as="section" className="v2-card v2-panel"><Heading title="Budgets à surveiller" caption="Progressions déjà disponibles" action="Budgets" onAction={onOpen} />{visible.length ? <div className="v2-list">{visible.map((item) => <div className="v2-row" key={item.id || item.name}><div><strong>{item.name || item.label || "Budget"}</strong><small>{item.progress}% utilisé</small></div><ProgressBar unstyled className="v2-progress" value={item.progress} showValue={false} ariaLabel={`${item.progress}% utilisé`} /></div>)}</div> : <InlineEmpty>Aucune progression de budget disponible.</InlineEmpty>}</SectionCard>;
}

function Transactions({ items, onOpen }) {
  const visible = items.slice(0, 5);
  return <SectionCard unstyled as="section" className="v2-card v2-panel"><Heading title="Dernières transactions" caption="Les cinq mouvements les plus récents" action="Voir toutes" onAction={onOpen} />{visible.length ? <div className="v2-list">{visible.map((item) => { const expense = ["depense", "dépense"].includes(String(item?.type || "").toLowerCase()); return <div className="v2-row" key={item.id}><div><strong>{item.description || "Sans description"}</strong><small>{item.categoryName || item.categorie || "Sans catégorie"} · {shortDate(item.date)}</small></div><b className={expense ? "expense" : ""}>{expense ? "−" : "+"}{currency(item.montant ?? item.amount)}</b></div>; })}</div> : <InlineEmpty>Aucune transaction récente.</InlineEmpty>}</SectionCard>;
}

export default function DashboardV2({
  firstName = "Alexandre", periodLabel = "Ce mois", activeNavigation = "home",
  metrics = {}, variations = {}, budgets = [], expenseCategories = [],
  notificationsCount = 0, onNavigate, onOpenPeriod, onOpenNotifications, onCreateTransaction,
}) {
  console.log("[RENDER] DashboardV2 component");
  useEffect(() => {
    const previousOnError = typeof window !== "undefined" ? window.onerror : null;
    const previousOnUnhandledRejection = typeof window !== "undefined" ? window.onunhandledrejection : null;

    const globalErrorHandler = (message, source, lineno, colno, error) => {
      const stack = error?.stack || null;
      const guessedVariable =
        message && typeof message === "string"
          ? message.match(/Cannot read properties of undefined \(reading '([^']+)'\)/)?.[1] ||
            message.match(/Cannot destructure property '([^']+)'/)?.[1] ||
            null
          : null;
      console.error("[DIAG][DashboardV2][window.onerror]", {
        message,
        source,
        line: lineno,
        column: colno,
        stack,
        guessedVariable,
      });

      if (typeof previousOnError === "function") {
        return previousOnError(message, source, lineno, colno, error);
      }
      return false;
    };

    const globalUnhandledRejectionHandler = (event) => {
      const reason = event?.reason;
      const message = typeof reason === "string" ? reason : reason?.message || String(reason);
      const stack = reason?.stack || null;
      const guessedVariable =
        message && typeof message === "string"
          ? message.match(/Cannot read properties of undefined \(reading '([^']+)'\)/)?.[1] ||
            message.match(/Cannot destructure property '([^']+)'/)?.[1] ||
            null
          : null;
      console.error("[DIAG][DashboardV2][window.onunhandledrejection]", {
        message,
        stack,
        reason,
        guessedVariable,
      });

      if (typeof previousOnUnhandledRejection === "function") {
        return previousOnUnhandledRejection(event);
      }
      return undefined;
    };

    if (typeof window !== "undefined") {
      window.onerror = globalErrorHandler;
      window.onunhandledrejection = globalUnhandledRejectionHandler;
    }

    if (typeof window !== "undefined") {
      console.log("[DASHBOARD_V2_MOUNTED]");
      console.log("[DIAG][DashboardV2] mounted", {
        pathname: window.location.pathname,
        search: window.location.search,
      });
    } else {
      console.log("[DIAG][DashboardV2] mounted");
    }

    return () => {
      if (typeof window !== "undefined") {
        window.onerror = previousOnError;
        window.onunhandledrejection = previousOnUnhandledRejection;
      }
      console.log("[DIAG][DashboardV2] unmounted");
    };
  }, []);

  const trend = Array.isArray(metrics.yearTrend) ? metrics.yearTrend : [];
  const trendValues = trend.map((row) => number(row?.net));
  const accountValues = Array.isArray(metrics.accountBalances) ? metrics.accountBalances.map((account) => number(account?.balance)) : [];
  const categories = expenseCategories.length ? expenseCategories : metrics.monthlyExpenseCategoryData?.categories || metrics.monthlyExpenseCategoryData?.catégories || [];
  const savingProgress = Number.isFinite(Number(metrics.savingProgress)) ? Math.max(0, Math.min(100, number(metrics.savingProgress))) : 0;
  const trajectory = Array.isArray(metrics.annualTrajectory) ? metrics.annualTrajectory : [];
  const decemberProjection = trajectory.at(-1)?.closingBalance;
  const kpis = [
    ["Solde disponible", metrics.balance, variations.availableBalance, WalletCards, accountValues],
    ["Solde prévu fin de mois", metrics.remaining, variations.netWorth, Landmark, trendValues],
    ["Projection au 31 décembre", decemberProjection, variations.projection, CircleDollarSign, trajectory.map((row) => number(row?.closingBalance))],
    ["Dépenses du mois", metrics.totalExpense, variations.expenses, CreditCard, trendValues],
  ];
  const wealthChart = mainChartModel(trajectory);
  const expenseDonut = donutModel(categories);

  return (
    <div className="horizon-v2">
      <div className="v2-shell">
        <DashboardV2Sidebar active={activeNavigation} onNavigate={onNavigate} />
        <main className="v2-main">
          <header className="v2-header"><div><p className="v2-eyebrow">Vue d’ensemble</p><h1>Bonjour {firstName} 👋</h1><p>Voici votre situation financière aujourd’hui.</p></div><div className="v2-header-actions"><button type="button" className="v2-period" onClick={onOpenPeriod}><CalendarDays size={16} strokeWidth={1.8} />{periodLabel}<ChevronDown size={15} /></button><button type="button" className="v2-bell" onClick={onOpenNotifications} aria-label="Ouvrir les notifications"><Bell size={16} strokeWidth={1.8} />{notificationsCount > 0 && <i />}</button></div></header>
          <section className="v2-kpis" aria-label="Indicateurs financiers">{kpis.map(([label, value, variation, icon, values]) => <KpiCard key={label} className="v2-card v2-kpi" label={label} labelClassName="v2-kpi-label" value={currency(value)} valueAs="p" valueClassName="v2-kpi-value" variation={<Variation>{variation}</Variation>} icon={icon} iconStrokeWidth={1.8} visualization={<Sparkline unstyled className="v2-spark" width={78} height={34} path={sparklineModel(values)} color="currentColor" strokeWidth={1.45} ariaHidden />} />)}</section>
          <div className="v2-content">
            <div className="v2-primary">
              <div className="v2-charts"><SectionCard unstyled as="section" className="v2-card v2-panel v2-wealth"><Heading title="Patrimoine" caption="Évolution annuelle" /><div className="v2-wealth-summary"><div><span>Patrimoine actuel</span><strong>{currency(metrics.balance)}</strong></div><div><span>Projection au 31 décembre <em>Estimation</em></span><strong>{Number.isFinite(Number(decemberProjection)) ? currency(decemberProjection) : "—"}</strong></div></div><div className="v2-chart-wrap"><LineChart unstyled svgClassName="v2-chart" width={100} height={58} ariaLabel="Historique en ligne pleine et projection jusqu'au 31 décembre en ligne pointillée" paths={wealthChart.allPoints ? [{ id: "history", d: wealthChart.actualPath, stroke: "#173033", strokeWidth: 1.7, strokeLinecap: "round" }, { id: "projection", d: wealthChart.projectedPath, stroke: "#0f5c5e", strokeWidth: 1.7, strokeDasharray: "3 3", strokeLinecap: "round" }] : []} gridLines={[12, 28, 44].map((y) => ({ y1: y, y2: y, x1: 0, x2: 100, stroke: "#e5ecea", strokeWidth: .45 }))} legend={[{ id: "history", label: "Historique" }, { id: "projection", label: "Projection", swatchClassName: "projected" }]} legendClassName="v2-chart-legend" xLabels={wealthChart.labels} labelsClassName="v2-chart-labels" empty={<InlineEmpty>La projection sera affichée dès que les données seront disponibles.</InlineEmpty>} /></div></SectionCard><SectionCard unstyled as="section" className="v2-card v2-panel"><Heading title="Répartition des dépenses" caption="Mois en cours" /><div className="v2-donut-wrap"><DonutChart unstyled variant="conic" segments={expenseDonut} visualClassName="v2-donut" showLegend={false} centerLabel={<strong>{currency(metrics.monthlyExpenseCategoryData?.total)}</strong>} empty={<InlineEmpty>Aucune dépense ce mois-ci.</InlineEmpty>} /></div></SectionCard></div>
              <Budgets items={budgets} onOpen={() => onNavigate?.("budgets")} />
              <Transactions items={metrics.recentTransactions || []} onOpen={() => onNavigate?.("transactions")} />
            </div>
            <aside className="v2-aside" aria-label="Informations complémentaires">
              <SectionCard unstyled as="section" className="v2-card v2-panel"><Heading title="Épargne" caption="Variation du mois" /><p className="v2-saving">{currency(metrics.monthlySavings)}</p><ProgressBar unstyled className="v2-saving-bar" value={savingProgress} showValue={false} ariaLabel={`${savingProgress}% de l’objectif d’épargne`} /><div className="v2-saving-label"><small>Progression disponible</small><strong>{savingProgress}%</strong></div></SectionCard>
              <SectionCard unstyled as="section" className="v2-card v2-panel"><Heading title="Raccourcis" caption="Actions fréquentes" /><div className="v2-shortcuts"><button type="button" onClick={onCreateTransaction}><Plus size={16} strokeWidth={1.8} />Nouvelle transaction</button><button type="button" onClick={() => onNavigate?.("budgets")}><Target size={16} strokeWidth={1.8} />Gérer les budgets</button><button type="button" onClick={() => onNavigate?.("reports")}><FileChartColumn size={16} strokeWidth={1.8} />Voir les rapports</button></div></SectionCard>
            </aside>
          </div>
        </main>
      </div>
      <DashboardV2MobileNavigation active={activeNavigation} onNavigate={onNavigate} />
    </div>
  );
}
