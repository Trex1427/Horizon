function toAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function toDateValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toDateLabel(value) {
  const date = toDateValue(value);
  if (!date) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function sortByName(items = []) {
  return [...items].sort((left, right) => String(left?.name || "").localeCompare(String(right?.name || ""), "fr", { sensitivity: "base" }));
}

function buildTransactionRow(transaction = {}, accountsById = new Map()) {
  return {
    id: transaction.id,
    transaction,
    date: transaction.date || transaction.createdAt || transaction.timestamp || "",
    description: transaction.description || transaction.rawLabel || transaction.label || transaction.id,
    amount: toAmount(transaction.montant ?? transaction.amount),
    account: transaction.accountName || accountsById.get(transaction.accountId)?.name || transaction.accountId || "Compte inconnu",
    state: transaction.isDeleted === true ? "Supprimée" : "Active",
  };
}

function buildTransactionStats(rows = []) {
  const amounts = rows.map((row) => toAmount(row.amount));
  const dates = rows.map((row) => toDateValue(row.date)).filter(Boolean).sort((left, right) => left - right);
  const totalAmount = amounts.reduce((sum, amount) => sum + amount, 0);
  const months = new Set(dates.map((date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`));

  return {
    totalAmount,
    averageAmount: rows.length > 0 ? totalAmount / rows.length : 0,
    minAmount: rows.length > 0 ? Math.min(...amounts) : 0,
    maxAmount: rows.length > 0 ? Math.max(...amounts) : 0,
    firstUsage: dates[0] || null,
    lastUsage: dates[dates.length - 1] || null,
    monthsCount: months.size,
  };
}

function buildSortValue(detail, sortKey = "alphabetical") {
  if (sortKey === "mostUsed") return -(detail.transactionRows.length + detail.usageCount);
  if (sortKey === "lastUsage") return -(toDateValue(detail.stats.lastUsage)?.getTime() || 0);
  if (sortKey === "totalAmount") return -detail.stats.totalAmount;
  if (sortKey === "transactionCount") return -detail.transactionRows.length;
  if (sortKey === "custom") return Number(detail.item?.displayOrder || 0);
  return normalizeText(detail.name);
}

export function sortReferentialDetails(details = [], sortKey = "alphabetical") {
  return [...details].sort((left, right) => {
    const leftValue = buildSortValue(left, sortKey);
    const rightValue = buildSortValue(right, sortKey);
    if (typeof leftValue === "number" && typeof rightValue === "number") {
      if (leftValue !== rightValue) return leftValue - rightValue;
      return String(left.name || "").localeCompare(String(right.name || ""), "fr", { sensitivity: "base" });
    }
    return String(leftValue || "").localeCompare(String(rightValue || ""), "fr", { sensitivity: "base" });
  });
}

export function buildReferentialPilotData({
  categories = [],
  subcategories = [],
  thirdParties = [],
  activities = [],
  projects = [],
  fixedExpenses = [],
  recurringIncome = [],
  budgets = [],
  transactions = [],
  accounts = [],
} = {}) {
  const accountsById = new Map((accounts || []).map((account) => [String(account.id || ""), account]));
  const categoriesById = new Map((categories || []).map((item) => [String(item.id || ""), item]));
  const subcategoriesById = new Map((subcategories || []).map((item) => [String(item.id || ""), item]));
  const activitiesById = new Map((activities || []).map((item) => [String(item.id || ""), item]));
  const thirdPartiesById = new Map((thirdParties || []).map((item) => [String(item.id || ""), item]));
  const projectsById = new Map((projects || []).map((item) => [String(item.id || ""), item]));
  const fixedExpensesById = new Map((fixedExpenses || []).map((item) => [String(item.id || ""), item]));
  const recurringIncomeById = new Map((recurringIncome || []).map((item) => [String(item.id || ""), item]));

  function buildDetail(type, item) {
    const id = String(item?.id || "");
    let relatedTransactions = [];
    let relatedBudgets = [];
    let relatedFixedExpenses = [];
    let relatedRecurringIncome = [];
    let relatedProjects = [];
    let relatedSubcategories = [];
    let relatedActivities = [];
    let relatedThirdParties = [];
    let relations = [];

    if (type === "categories") {
      relatedTransactions = transactions.filter((transaction) => String(transaction.categoryId || "") === id);
      relatedBudgets = budgets.filter((budget) => String(budget.categoryId || "") === id);
      relatedFixedExpenses = fixedExpenses.filter((entry) => String(entry.categoryId || "") === id);
      relatedRecurringIncome = recurringIncome.filter((entry) => String(entry.categoryId || "") === id);
      relatedSubcategories = subcategories.filter((entry) => String(entry.categoryId || "") === id);
      relatedThirdParties = sortByName(thirdParties.filter((entry) => relatedTransactions.some((transaction) => String(transaction.thirdPartyId || "") === String(entry.id || ""))));
      relatedActivities = sortByName(activities.filter((entry) => relatedTransactions.some((transaction) => String(transaction.activityId || "") === String(entry.id || ""))));
      relatedProjects = sortByName(projects.filter((entry) => relatedTransactions.some((transaction) => String(transaction.projectId || "") === String(entry.id || ""))));
      relations = [
        { label: "Sous-catégories", type: "subcategories", items: relatedSubcategories },
        { label: "Tiers utilisés", type: "third-parties", items: relatedThirdParties },
        { label: "Activités", type: "activities", items: relatedActivities },
        { label: "Projets", type: "projects", items: relatedProjects },
      ];
    } else if (type === "subcategories") {
      relatedTransactions = transactions.filter((transaction) => String(transaction.subcategoryId || "") === id);
      relatedBudgets = budgets.filter((budget) => String(budget.subcategoryId || "") === id);
      relatedFixedExpenses = fixedExpenses.filter((entry) => String(entry.subcategoryId || "") === id);
      relatedRecurringIncome = recurringIncome.filter((entry) => String(entry.subcategoryId || "") === id);
      const parentCategory = categoriesById.get(String(item.categoryId || ""));
      relatedThirdParties = sortByName(thirdParties.filter((entry) => relatedTransactions.some((transaction) => String(transaction.thirdPartyId || "") === String(entry.id || ""))));
      relatedActivities = sortByName(activities.filter((entry) => relatedTransactions.some((transaction) => String(transaction.activityId || "") === String(entry.id || ""))));
      relatedProjects = sortByName(projects.filter((entry) => relatedTransactions.some((transaction) => String(transaction.projectId || "") === String(entry.id || ""))));
      relations = [
        parentCategory ? { label: "Catégorie", type: "categories", items: [parentCategory] } : null,
        { label: "Tiers utilisés", type: "third-parties", items: relatedThirdParties },
        { label: "Activités", type: "activities", items: relatedActivities },
        { label: "Projets", type: "projects", items: relatedProjects },
      ].filter(Boolean);
    } else if (type === "third-parties") {
      relatedTransactions = transactions.filter((transaction) => String(transaction.thirdPartyId || "") === id);
      relatedFixedExpenses = fixedExpenses.filter((entry) => String(entry.thirdPartyId || "") === id);
      relatedRecurringIncome = recurringIncome.filter((entry) => String(entry.thirdPartyId || "") === id);
      relatedActivities = sortByName(activities.filter((entry) => relatedTransactions.some((transaction) => String(transaction.activityId || "") === String(entry.id || ""))));
      relatedProjects = sortByName(projects.filter((entry) => relatedTransactions.some((transaction) => String(transaction.projectId || "") === String(entry.id || ""))));
      relations = [
        { label: "Activités", type: "activities", items: relatedActivities },
        { label: "Projets", type: "projects", items: relatedProjects },
      ];
    } else if (type === "activities") {
      relatedTransactions = transactions.filter((transaction) => String(transaction.activityId || "") === id);
      relatedProjects = projects.filter((project) => String(project.activityId || "") === id);
      relatedThirdParties = sortByName(thirdParties.filter((entry) => relatedTransactions.some((transaction) => String(transaction.thirdPartyId || "") === String(entry.id || ""))));
      relations = [
        { label: "Projets", type: "projects", items: relatedProjects },
        { label: "Tiers utilisés", type: "third-parties", items: relatedThirdParties },
      ];
    } else if (type === "projects") {
      relatedTransactions = transactions.filter((transaction) => String(transaction.projectId || "") === id);
      const activity = activitiesById.get(String(item.activityId || ""));
      const relatedCategories = sortByName(categories.filter((entry) => relatedTransactions.some((transaction) => String(transaction.categoryId || "") === String(entry.id || ""))));
      relations = [
        activity ? { label: "Activité", type: "activities", items: [activity] } : null,
        { label: "Catégories", type: "categories", items: relatedCategories },
      ].filter(Boolean);
    } else if (type === "fixed-expenses") {
      relatedTransactions = transactions.filter((transaction) => String(transaction.fixedExpenseId || "") === id);
      const category = categoriesById.get(String(item.categoryId || ""));
      const subcategory = subcategoriesById.get(String(item.subcategoryId || ""));
      const thirdParty = thirdPartiesById.get(String(item.thirdPartyId || ""));
      const activity = activitiesById.get(String(item.activityId || ""));
      const project = projectsById.get(String(item.projectId || ""));
      relations = [
        category ? { label: "Catégorie", type: "categories", items: [category] } : null,
        subcategory ? { label: "Sous-catégories", type: "subcategories", items: [subcategory] } : null,
        thirdParty ? { label: "Tiers utilisés", type: "third-parties", items: [thirdParty] } : null,
        activity ? { label: "Activités", type: "activities", items: [activity] } : null,
        project ? { label: "Projets", type: "projects", items: [project] } : null,
      ].filter(Boolean);
    } else if (type === "recurring-income") {
      relatedTransactions = transactions.filter((transaction) => String(transaction.recurringIncomeId || "") === id);
      const category = categoriesById.get(String(item.categoryId || ""));
      const subcategory = subcategoriesById.get(String(item.subcategoryId || ""));
      const thirdParty = thirdPartiesById.get(String(item.thirdPartyId || ""));
      const activity = activitiesById.get(String(item.activityId || ""));
      const project = projectsById.get(String(item.projectId || ""));
      relations = [
        category ? { label: "Catégorie", type: "categories", items: [category] } : null,
        subcategory ? { label: "Sous-catégories", type: "subcategories", items: [subcategory] } : null,
        thirdParty ? { label: "Tiers utilisés", type: "third-parties", items: [thirdParty] } : null,
        activity ? { label: "Activités", type: "activities", items: [activity] } : null,
        project ? { label: "Projets", type: "projects", items: [project] } : null,
      ].filter(Boolean);
    }

    const transactionRows = relatedTransactions.map((transaction) => buildTransactionRow(transaction, accountsById));
    const stats = buildTransactionStats(transactionRows);
    const usageCount = transactionRows.length + relatedBudgets.length + relatedFixedExpenses.length + relatedRecurringIncome.length + relatedProjects.length;

    return {
      type,
      item,
      id,
      name: item?.name || item?.categoryName || "Référentiel",
      status: item?.isActive === false ? "Inactif" : "Actif",
      createdAtLabel: toDateLabel(item?.createdAt),
      updatedAtLabel: toDateLabel(item?.updatedAt),
      usageCount,
      transactionRows,
      stats,
      relatedBudgets,
      relatedFixedExpenses,
      relatedRecurringIncome,
      relatedProjects,
      relations,
      impact: {
        transactions: transactionRows.length,
        budgets: relatedBudgets.length,
        fixedExpenses: relatedFixedExpenses.length,
        recurringIncome: relatedRecurringIncome.length,
        projects: relatedProjects.length,
      },
      usageSections: [
        { label: "Budgets", items: relatedBudgets, count: relatedBudgets.length },
        { label: "Transactions", items: transactionRows, count: transactionRows.length, totalAmount: stats.totalAmount },
        { label: "Frais fixes", items: relatedFixedExpenses, count: relatedFixedExpenses.length },
        { label: "Revenus récurrents", items: relatedRecurringIncome, count: relatedRecurringIncome.length },
        { label: "Prévisions", items: [], count: relatedFixedExpenses.length + relatedRecurringIncome.length > 0 ? 1 : 0 },
      ],
    };
  }

  return {
    tabs: {
      categories: sortByName(categories).map((item) => buildDetail("categories", item)),
      subcategories: sortByName(subcategories).map((item) => buildDetail("subcategories", item)),
      activities: sortByName(activities).map((item) => buildDetail("activities", item)),
      "third-parties": sortByName(thirdParties).map((item) => buildDetail("third-parties", item)),
      projects: sortByName(projects).map((item) => buildDetail("projects", item)),
      "fixed-expenses": sortByName(fixedExpenses).map((item) => buildDetail("fixed-expenses", item)),
      "recurring-income": sortByName(recurringIncome).map((item) => buildDetail("recurring-income", item)),
    },
  };
}

export function filterReferentialDetails(details = [], query = "") {
  const normalized = normalizeText(query);
  if (!normalized) return details;
  return details.filter((detail) => {
    const relationText = detail.relations.flatMap((group) => (group.items || []).map((item) => item?.name || "")).join(" ");
    return normalizeText([
      detail.name,
      detail.type,
      detail.status,
      relationText,
      detail.item?.notes,
      detail.item?.categoryName,
      detail.item?.subcategoryName,
    ].join(" ")).includes(normalized);
  });
}
