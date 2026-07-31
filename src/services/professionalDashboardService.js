const PROJECT_STATUS_LABELS = Object.freeze({
  planned: "À planifier",
  in_progress: "En cours",
  on_hold: "En attente",
  completed: "Terminé",
  cancelled: "Annulé",
});

const DEFAULT_SORT = Object.freeze({ key: "name", direction: "asc" });
const SORT_KEYS = new Set([
  "name", "client", "activity", "quoteAmount", "billed", "received",
  "expenses", "margin", "profitabilityRate", "statusLabel",
]);

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round((number + Number.EPSILON) * 100) / 100 : 0;
}

function sum(items, selector) {
  return money(items.reduce((total, item) => total + selector(item), 0));
}

function rate(numerator, denominator) {
  return denominator > 0 ? money((numerator / denominator) * 100) : 0;
}

function active(items) {
  return (items || []).filter((item) => !item?.deletedAt && item?.isDeleted !== true);
}

function dateKey(value) {
  if (typeof value?.toDate === "function") return value.toDate().toISOString().slice(0, 10);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}/.test(String(value || "")) ? String(value).slice(0, 10) : "";
}

function displayName(map, id, fallback) {
  return map.get(id)?.name || fallback;
}

function buildIndex(items) {
  return new Map((items || []).map((item) => [item.id, item]));
}

function groupBy(items, selector) {
  const groups = new Map();
  items.forEach((item) => {
    const key = selector(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return groups;
}

function buildProjectRows({ projects, quotes, invoices, transactions, activities, thirdParties }) {
  const quoteMap = buildIndex(quotes);
  const activityMap = buildIndex(activities);
  const thirdPartyMap = buildIndex(thirdParties);
  const invoicesByProject = groupBy(invoices, (invoice) => invoice.workProjectId);
  const transactionsByProject = groupBy(transactions, (transaction) => transaction.workProjectId);

  return projects.map((project) => {
    const projectInvoices = invoicesByProject.get(project.id) || [];
    const projectExpenses = (transactionsByProject.get(project.id) || [])
      .filter((transaction) => transaction.type === "depense");
    const quote = quoteMap.get(project.quoteId);
    const quoteAmount = money(quote?.amount ?? project.plannedRevenue);
    const billed = sum(projectInvoices, (invoice) => money(invoice.amountHT));
    const billedTTC = sum(projectInvoices, (invoice) => money(invoice.amountTTC));
    const received = sum(projectInvoices.filter((invoice) => invoice.status === "paid"), (invoice) => money(invoice.amountTTC));
    const expenses = sum(projectExpenses, (transaction) => Math.abs(money(transaction.montant)));
    const plannedMargin = money(money(project.plannedRevenue) - money(project.plannedExpenses));
    const actualMargin = money(billed - expenses);
    const hasActualRevenue = billed > 0;
    const margin = hasActualRevenue ? actualMargin : plannedMargin;
    const profitabilityRate = rate(
      margin,
      hasActualRevenue ? billed : money(project.plannedRevenue),
    );

    return {
      id: project.id,
      name: project.name || "Dossier sans nom",
      client: displayName(thirdPartyMap, project.thirdPartyId, "Client indisponible"),
      activity: displayName(activityMap, project.professionalActivityId, "Activité indisponible"),
      quoteAmount,
      billed,
      billedTTC,
      received,
      expenses,
      plannedMargin,
      actualMargin,
      margin,
      profitabilityRate,
      profitabilityKind: hasActualRevenue ? "actual" : "forecast",
      status: project.status || "planned",
      statusLabel: PROJECT_STATUS_LABELS[project.status] || project.status || "À planifier",
    };
  });
}

/**
 * Construit une vue métier entièrement dérivée des collections déjà chargées.
 * Les montants de CA et de marge sont en HT ; les encaissements sont en TTC.
 */
export function calculateProfessionalDashboard(input = {}, { today = new Date() } = {}) {
  const quotes = active(input.quotes);
  const projects = active(input.projects);
  const invoices = active(input.invoices).filter((invoice) => invoice.status !== "cancelled");
  const transactions = active(input.transactions);
  const todayKey = dateKey(today);
  const pendingInvoices = invoices.filter((invoice) => invoice.status === "pending_payment");
  const overdueInvoices = pendingInvoices.filter((invoice) => {
    const dueDate = dateKey(invoice.dueDate);
    return dueDate && todayKey && dueDate < todayKey;
  });
  const paidInvoices = invoices.filter((invoice) => invoice.status === "paid");
  const currentProjects = projects.filter((project) => project.status !== "cancelled");
  const projectRows = buildProjectRows({
    projects,
    quotes,
    invoices,
    transactions,
    activities: input.activities,
    thirdParties: input.thirdParties,
  });

  const revenueHT = sum(invoices, (invoice) => money(invoice.amountHT));
  const revenueTTC = sum(invoices, (invoice) => money(invoice.amountTTC));
  const received = sum(paidInvoices, (invoice) => money(invoice.amountTTC));
  const outstanding = sum(pendingInvoices, (invoice) => money(invoice.amountTTC));
  const plannedRevenue = sum(currentProjects, (project) => money(project.plannedRevenue));
  const plannedExpenses = sum(currentProjects, (project) => money(project.plannedExpenses));
  const plannedMargin = money(plannedRevenue - plannedExpenses);
  const actualExpenses = sum(projectRows.filter((row) => row.status !== "cancelled"), (row) => row.expenses);
  const actualMargin = money(revenueHT - actualExpenses);

  return {
    kpis: {
      revenue: { ht: revenueHT, ttc: revenueTTC, received, outstanding },
      profitability: {
        plannedMargin,
        actualMargin,
        marginRate: rate(actualMargin, revenueHT),
      },
      activity: {
        quotes: quotes.length,
        projects: projects.length,
        invoices: invoices.length,
      },
      collections: {
        paid: paidInvoices.length,
        pending: pendingInvoices.length,
        overdue: overdueInvoices.length,
      },
    },
    projects: projectRows,
    alerts: {
      overdueInvoices,
      quotesToFollowUp: quotes.filter((quote) => quote.status === "pending"),
    },
  };
}

export function filterAndSortDashboardProjects(
  rows = [],
  { search = "", sort = DEFAULT_SORT } = {},
) {
  const needle = String(search).trim().toLocaleLowerCase("fr-FR");
  const filtered = needle
    ? rows.filter((row) => `${row.name} ${row.client} ${row.activity} ${row.statusLabel}`
      .toLocaleLowerCase("fr-FR").includes(needle))
    : [...rows];
  const key = SORT_KEYS.has(sort?.key) ? sort.key : DEFAULT_SORT.key;
  const direction = sort?.direction === "desc" ? -1 : 1;
  const collator = new Intl.Collator("fr", { numeric: true, sensitivity: "base" });

  return filtered.sort((left, right) => {
    const leftValue = left[key];
    const rightValue = right[key];
    const comparison = typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : collator.compare(String(leftValue || ""), String(rightValue || ""));
    return comparison * direction || collator.compare(left.name, right.name);
  });
}

