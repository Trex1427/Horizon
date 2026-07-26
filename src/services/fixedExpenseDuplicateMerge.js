const IDENTITY_FIELDS = [
  "ownerUid",
  "accountId",
  "categoryId",
  "subcategoryId",
  "thirdPartyId",
  "projectId",
  "activityId",
];

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("fr-FR");
}

function normalizeFrequency(value) {
  const normalized = normalizeText(value);
  if (normalized === "mensuel") return "monthly";
  if (normalized === "annuel") return "annual";
  if (normalized === "monthly" || normalized === "annual") return normalized;
  return normalized || "monthly";
}

function normalizeAmount(value) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function stableJson(value) {
  return JSON.stringify(value ?? null);
}

function toComparableTime(value) {
  if (!value) return Number.POSITIVE_INFINITY;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  }
  if (typeof value?.toMillis === "function") return value.toMillis();
  if (typeof value?.iso === "string") {
    const parsed = Date.parse(value.iso);
    return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
  }
  if (typeof value?.seconds === "number") {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1_000_000);
  }
  return Number.POSITIVE_INFINITY;
}

function getCreatedTime(fixedExpense) {
  return fixedExpense?.createTime || fixedExpense?.createdAt || fixedExpense?.updatedAt;
}

function getInitialAmount(fixedExpense) {
  return normalizeAmount(fixedExpense?.initialAmount ?? fixedExpense?.amount);
}

function buildDuplicateKey(fixedExpense) {
  return [
    normalizeText(fixedExpense?.name),
    normalizeFrequency(fixedExpense?.frequency),
    ...IDENTITY_FIELDS.map((field) => String(fixedExpense?.[field] || "").trim()),
    String(getInitialAmount(fixedExpense)),
    stableJson(Array.isArray(fixedExpense?.variations) ? fixedExpense.variations : []),
  ].join("|");
}

function buildSimilarityKey(fixedExpense) {
  return [
    String(fixedExpense?.ownerUid || "").trim(),
    normalizeText(fixedExpense?.name),
    String(fixedExpense?.accountId || "").trim(),
  ].join("|");
}

function monthKey(value) {
  const parsed = value instanceof Date ? value : new Date(value || "");
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}`;
}

function isDueInMonth(fixedExpense, year, monthIndex) {
  if (fixedExpense?.isActive === false) return false;

  const monthStart = new Date(year, monthIndex, 1);
  const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  const startDate = fixedExpense?.startDate ? new Date(fixedExpense.startDate) : null;
  const endDate = fixedExpense?.endDate ? new Date(fixedExpense.endDate) : null;

  if (!startDate || Number.isNaN(startDate.getTime()) || startDate > monthEnd) return false;
  if (endDate && !Number.isNaN(endDate.getTime()) && endDate < monthStart) return false;
  if (normalizeFrequency(fixedExpense?.frequency) === "annual") {
    return startDate.getMonth() === monthIndex;
  }

  return true;
}

export function buildFixedExpenseForecastSnapshot(fixedExpenses = [], { year = new Date().getFullYear() } = {}) {
  return Array.from({ length: 12 }, (_, monthIndex) => {
    const month = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const dueItems = fixedExpenses.filter((fixedExpense) => isDueInMonth(fixedExpense, year, monthIndex));
    const expectedFixedExpenses = dueItems.reduce((sum, fixedExpense) => sum + getInitialAmount(fixedExpense), 0);

    return {
      month,
      expectedFixedExpenses,
      fixedExpenseIds: dueItems.map((fixedExpense) => fixedExpense.id).filter(Boolean).sort(),
    };
  });
}

export function selectCanonicalFixedExpense(group = [], linkedTransactionsByFixedExpenseId = new Map()) {
  return [...group].sort((left, right) => {
    const leftLinks = (linkedTransactionsByFixedExpenseId.get(left.id) || []).length;
    const rightLinks = (linkedTransactionsByFixedExpenseId.get(right.id) || []).length;
    if (leftLinks !== rightLinks) return rightLinks - leftLinks;

    const createdDelta = toComparableTime(getCreatedTime(left)) - toComparableTime(getCreatedTime(right));
    if (createdDelta !== 0) return createdDelta;

    return String(left.id || "").localeCompare(String(right.id || ""));
  })[0] || null;
}

function summarizeFixedExpense(fixedExpense, lookups = {}) {
  return {
    id: fixedExpense.id,
    name: fixedExpense.name || "",
    startDate: fixedExpense.startDate || null,
    endDate: fixedExpense.endDate || null,
    createTime: fixedExpense.createTime?.iso || fixedExpense.createTime || null,
    updateTime: fixedExpense.updateTime?.iso || fixedExpense.updateTime || null,
    account: {
      id: fixedExpense.accountId || "",
      name: fixedExpense.accountName || lookups.accounts?.get?.(fixedExpense.accountId)?.name || "",
    },
    category: {
      id: fixedExpense.categoryId || "",
      name: fixedExpense.categoryName || fixedExpense.category || lookups.categories?.get?.(fixedExpense.categoryId)?.name || "",
    },
    subcategory: {
      id: fixedExpense.subcategoryId || "",
      name: fixedExpense.subcategoryName || lookups.subcategories?.get?.(fixedExpense.subcategoryId)?.name || "",
    },
    thirdParty: {
      id: fixedExpense.thirdPartyId || "",
      name: fixedExpense.thirdPartyName || lookups.thirdParties?.get?.(fixedExpense.thirdPartyId)?.name || "",
    },
    project: {
      id: fixedExpense.projectId || "",
      name: fixedExpense.projectName || lookups.projects?.get?.(fixedExpense.projectId)?.name || "",
    },
    activity: {
      id: fixedExpense.activityId || "",
      name: fixedExpense.activityName || lookups.activities?.get?.(fixedExpense.activityId)?.name || "",
    },
    amount: getInitialAmount(fixedExpense),
    frequency: normalizeFrequency(fixedExpense.frequency),
    variations: Array.isArray(fixedExpense.variations) ? fixedExpense.variations : [],
    isActive: fixedExpense.isActive !== false,
  };
}

function buildLinkedTransactionsByFixedExpenseId(transactions = []) {
  const map = new Map();
  for (const transaction of transactions) {
    const fixedExpenseId = String(transaction?.fixedExpenseId || "").trim();
    if (!fixedExpenseId) continue;
    if (!map.has(fixedExpenseId)) map.set(fixedExpenseId, []);
    map.get(fixedExpenseId).push(transaction);
  }
  return map;
}

function buildMapById(items = []) {
  return new Map(items.map((item) => [item.id, item]));
}

function buildForecastComparison(beforeFixedExpenses, afterFixedExpenses, options = {}) {
  const before = buildFixedExpenseForecastSnapshot(beforeFixedExpenses, options);
  const after = buildFixedExpenseForecastSnapshot(afterFixedExpenses, options);
  return before.map((beforeMonth, index) => ({
    month: beforeMonth.month,
    before: beforeMonth.expectedFixedExpenses,
    after: after[index].expectedFixedExpenses,
    delta: after[index].expectedFixedExpenses - beforeMonth.expectedFixedExpenses,
    removedDuplicateIds: beforeMonth.fixedExpenseIds.filter((id) => !after[index].fixedExpenseIds.includes(id)),
  }));
}

function hasOnlyTrueValues(object) {
  return Object.values(object).every((value) => value === true);
}

export function buildFixedExpenseDuplicateMergeReport({
  fixedExpenses = [],
  transactions = [],
  accounts = [],
  categories = [],
  subcategories = [],
  thirdParties = [],
  projects = [],
  activities = [],
  generatedAt = new Date().toISOString(),
  source = "unknown",
  year = new Date().getFullYear(),
} = {}) {
  const linkedTransactionsByFixedExpenseId = buildLinkedTransactionsByFixedExpenseId(transactions);
  const fixedExpenseIds = new Set(fixedExpenses.map((fixedExpense) => fixedExpense.id));
  const orphanTransactions = [...linkedTransactionsByFixedExpenseId.entries()]
    .filter(([fixedExpenseId]) => !fixedExpenseIds.has(fixedExpenseId))
    .flatMap(([fixedExpenseId, linkedTransactions]) => linkedTransactions.map((transaction) => ({
      transactionId: transaction.id,
      fixedExpenseId,
    })));
  const lookups = {
    accounts: buildMapById(accounts),
    categories: buildMapById(categories),
    subcategories: buildMapById(subcategories),
    thirdParties: buildMapById(thirdParties),
    projects: buildMapById(projects),
    activities: buildMapById(activities),
  };
  const groupsByDuplicateKey = new Map();
  const groupsBySimilarityKey = new Map();

  for (const fixedExpense of fixedExpenses) {
    const duplicateKey = buildDuplicateKey(fixedExpense);
    const similarityKey = buildSimilarityKey(fixedExpense);
    if (!groupsByDuplicateKey.has(duplicateKey)) groupsByDuplicateKey.set(duplicateKey, []);
    if (!groupsBySimilarityKey.has(similarityKey)) groupsBySimilarityKey.set(similarityKey, []);
    groupsByDuplicateKey.get(duplicateKey).push(fixedExpense);
    groupsBySimilarityKey.get(similarityKey).push(fixedExpense);
  }

  const duplicateGroups = [...groupsByDuplicateKey.values()]
    .filter((group) => group.length > 1)
    .map((group) => {
      const canonical = selectCanonicalFixedExpense(group, linkedTransactionsByFixedExpenseId);
      const duplicateIds = group.map((fixedExpense) => fixedExpense.id).filter((id) => id !== canonical.id).sort();
      const linkedTransactions = group.flatMap((fixedExpense) => linkedTransactionsByFixedExpenseId.get(fixedExpense.id) || []);
      const guardrails = {
        noOrphanTransactions: orphanTransactions.filter((item) => group.some((fixedExpense) => fixedExpense.id === item.fixedExpenseId)).length === 0,
        sameOwner: new Set(group.map((fixedExpense) => String(fixedExpense.ownerUid || ""))).size === 1,
        sameAccount: new Set(group.map((fixedExpense) => String(fixedExpense.accountId || ""))).size === 1,
        sameCategory: new Set(group.map((fixedExpense) => String(fixedExpense.categoryId || ""))).size === 1,
        sameSubcategory: new Set(group.map((fixedExpense) => String(fixedExpense.subcategoryId || ""))).size === 1,
        sameThirdParty: new Set(group.map((fixedExpense) => String(fixedExpense.thirdPartyId || ""))).size === 1,
        sameProject: new Set(group.map((fixedExpense) => String(fixedExpense.projectId || ""))).size === 1,
        sameActivity: new Set(group.map((fixedExpense) => String(fixedExpense.activityId || ""))).size === 1,
        sameFrequency: new Set(group.map((fixedExpense) => normalizeFrequency(fixedExpense.frequency))).size === 1,
        sameAmount: new Set(group.map((fixedExpense) => String(getInitialAmount(fixedExpense)))).size === 1,
        sameVariations: new Set(group.map((fixedExpense) => stableJson(fixedExpense.variations || []))).size === 1,
      };

      return {
        name: canonical.name || group[0]?.name || "Frais fixe",
        count: group.length,
        fixedExpenseIds: group.map((fixedExpense) => fixedExpense.id).sort(),
        items: group.map((fixedExpense) => ({
          ...summarizeFixedExpense(fixedExpense, lookups),
          linkedTransactionCount: (linkedTransactionsByFixedExpenseId.get(fixedExpense.id) || []).length,
        })).sort((left, right) => String(left.id).localeCompare(String(right.id))),
        linkedTransactionCount: linkedTransactions.length,
        linkedTransactionsByFixedExpenseId: Object.fromEntries(group.map((fixedExpense) => [
          fixedExpense.id,
          (linkedTransactionsByFixedExpenseId.get(fixedExpense.id) || []).map((transaction) => transaction.id).sort(),
        ]).sort(([left], [right]) => String(left).localeCompare(String(right)))),
        impactedForecastMonths: [...new Set(linkedTransactions.map((transaction) => monthKey(transaction.date || transaction.createdAt?.iso)).filter(Boolean))].sort(),
        canonicalId: canonical.id,
        canonicalSelectionRule: "plus grand nombre de transactions liees, sinon plus ancienne, sinon ID Firestore",
        duplicateIds,
        guardrails,
        safeToMerge: hasOnlyTrueValues(guardrails),
      };
    })
    .sort((left, right) => String(left.name).localeCompare(String(right.name)) || String(left.canonicalId).localeCompare(String(right.canonicalId)));

  const duplicateIds = new Set(duplicateGroups.filter((group) => group.safeToMerge).flatMap((group) => group.duplicateIds));
  const afterFixedExpenses = fixedExpenses.filter((fixedExpense) => !duplicateIds.has(fixedExpense.id));
  const incompatibleGroups = [...groupsBySimilarityKey.values()]
    .filter((group) => group.length > 1)
    .filter((group) => new Set(group.map(buildDuplicateKey)).size > 1)
    .map((group) => ({
      name: group[0]?.name || "Frais fixe",
      fixedExpenseIds: group.map((fixedExpense) => fixedExpense.id).sort(),
      reason: "fiches ressemblantes mais compte/categorie/frequence/montant/variation differents",
      items: group.map((fixedExpense) => summarizeFixedExpense(fixedExpense, lookups)),
    }));
  const reassignmentPlan = duplicateGroups
    .filter((group) => group.safeToMerge)
    .flatMap((group) => group.duplicateIds.map((duplicateId) => ({
      fromFixedExpenseId: duplicateId,
      toFixedExpenseId: group.canonicalId,
      transactionIds: group.linkedTransactionsByFixedExpenseId[duplicateId] || [],
    })));
  const forecastBefore = buildFixedExpenseForecastSnapshot(fixedExpenses, { year });
  const forecastAfter = buildFixedExpenseForecastSnapshot(afterFixedExpenses, { year });
  const comparison = buildForecastComparison(fixedExpenses, afterFixedExpenses, { year });
  const errors = [
    ...(orphanTransactions.length > 0 ? ["transaction_orpheline"] : []),
    ...duplicateGroups.filter((group) => !group.safeToMerge).map((group) => `garde_fou_refuse:${group.name}`),
  ];

  return {
    generatedAt,
    source,
    mode: "dry-run",
    fixedExpenseCountBefore: fixedExpenses.length,
    fixedExpenseCountAfterPlannedMerge: afterFixedExpenses.length,
    transactionCount: transactions.length,
    fixedExpenseIdsUsed: [...linkedTransactionsByFixedExpenseId.entries()].map(([fixedExpenseId, linkedTransactions]) => ({
      fixedExpenseId,
      transactionCount: linkedTransactions.length,
      exists: fixedExpenseIds.has(fixedExpenseId),
    })).sort((left, right) => String(left.fixedExpenseId).localeCompare(String(right.fixedExpenseId))),
    orphanTransactions,
    allFixedExpenses: fixedExpenses.map((fixedExpense) => summarizeFixedExpense(fixedExpense, lookups))
      .sort((left, right) => String(left.name).localeCompare(String(right.name)) || String(left.id).localeCompare(String(right.id))),
    duplicateGroups,
    incompatibleGroups,
    reassignmentPlan,
    before: {
      fixedExpenseCount: fixedExpenses.length,
      forecast: forecastBefore,
    },
    after: {
      fixedExpenseCount: afterFixedExpenses.length,
      forecast: forecastAfter,
    },
    comparison: {
      mergedFixedExpenseCount: duplicateIds.size,
      remainingFixedExpenseCount: afterFixedExpenses.length,
      monthlyForecasts: comparison,
    },
    durationMs: 0,
    errors,
    verdict: errors.length === 0 ? "DRY_RUN_OK" : "DRY_RUN_REFUSED",
  };
}
