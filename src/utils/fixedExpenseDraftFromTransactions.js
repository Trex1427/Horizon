function toTrimmedString(value) {
  return String(value || "").trim();
}

function toComparableDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("fr-FR");
}

function getTransactionLabel(transaction = {}) {
  return toTrimmedString(
    transaction.thirdPartyName
      || transaction.merchant
      || transaction.description
      || transaction.rawLabel
      || transaction.label
      || transaction.name
  );
}

function getTransactionAmount(transaction = {}) {
  const amount = Number(transaction.amount ?? transaction.montant ?? 0);
  return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

function getTransactionDate(transaction = {}) {
  return (
    toComparableDate(transaction.date)
    || toComparableDate(transaction.operationDate)
    || toComparableDate(transaction.createdAt?.iso)
    || toComparableDate(transaction.createdAt)
    || toComparableDate(transaction.updatedAt?.iso)
    || toComparableDate(transaction.updatedAt)
  );
}

function getSharedValue(transactions = [], extractor) {
  const values = transactions
    .map((transaction) => toTrimmedString(extractor(transaction)))
    .filter(Boolean);

  if (!values.length) return "";
  const firstValue = values[0];
  return values.every((value) => normalizeText(value) === normalizeText(firstValue)) ? firstValue : "";
}

function detectFrequency(transactions = []) {
  const dates = transactions
    .map(getTransactionDate)
    .filter(Boolean)
    .sort((left, right) => left.getTime() - right.getTime());

  if (dates.length < 2) return "monthly";

  const deltas = [];
  for (let index = 1; index < dates.length; index += 1) {
    const deltaDays = Math.abs((dates[index].getTime() - dates[index - 1].getTime()) / (1000 * 60 * 60 * 24));
    if (deltaDays > 0) deltas.push(deltaDays);
  }

  if (!deltas.length) return "monthly";

  const averageDelta = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
  if (averageDelta >= 320) return "annual";
  return "monthly";
}

function detectInitialAmount(transactions = []) {
  const amounts = transactions.map(getTransactionAmount).filter((amount) => amount > 0);
  if (!amounts.length) return 0;

  const firstAmount = amounts[0];
  if (amounts.every((amount) => Math.abs(amount - firstAmount) < 0.01)) {
    return firstAmount;
  }

  const total = amounts.reduce((sum, amount) => sum + amount, 0);
  return Math.round((total / amounts.length) * 100) / 100;
}

function buildDescription(transactions = []) {
  const labels = transactions
    .map(getTransactionLabel)
    .filter(Boolean);

  if (!labels.length) return "";

  const firstLabel = labels[0];
  if (labels.every((label) => normalizeText(label) === normalizeText(firstLabel))) {
    return firstLabel;
  }

  return labels.slice(0, 3).join(" · ");
}

export function buildFixedExpenseDraftFromTransactions(transactions = []) {
  const filteredTransactions = Array.isArray(transactions)
    ? transactions.filter((transaction) => transaction)
    : [];

  const firstTransaction = filteredTransactions
    .map((transaction) => ({ transaction, date: getTransactionDate(transaction) }))
    .filter(({ date }) => Boolean(date))
    .sort((left, right) => left.date.getTime() - right.date.getTime())[0]?.transaction || filteredTransactions[0] || {};

  const name = getSharedValue(filteredTransactions, getTransactionLabel)
    || getSharedValue(filteredTransactions, (transaction) => transaction.thirdPartyName)
    || getSharedValue(filteredTransactions, (transaction) => transaction.categoryName)
    || getSharedValue(filteredTransactions, (transaction) => transaction.categorie)
    || getSharedValue(filteredTransactions, (transaction) => transaction.rawLabel)
    || "Frais fixe";

  const categoryId = getSharedValue(filteredTransactions, (transaction) => transaction.categoryId);
  const categoryName = getSharedValue(filteredTransactions, (transaction) => transaction.categoryName || transaction.categorie);
  const subcategoryId = getSharedValue(filteredTransactions, (transaction) => transaction.subcategoryId);
  const subcategoryName = getSharedValue(filteredTransactions, (transaction) => transaction.subcategoryName);
  const accountId = getSharedValue(filteredTransactions, (transaction) => transaction.accountId);
  const thirdPartyId = getSharedValue(filteredTransactions, (transaction) => transaction.thirdPartyId);
  const thirdPartyName = getSharedValue(filteredTransactions, (transaction) => transaction.thirdPartyName);
  const activityId = getSharedValue(filteredTransactions, (transaction) => transaction.activityId);
  const activityName = getSharedValue(filteredTransactions, (transaction) => transaction.activityName);
  const projectId = getSharedValue(filteredTransactions, (transaction) => transaction.projectId);
  const projectName = getSharedValue(filteredTransactions, (transaction) => transaction.projectName);

  return {
    name,
    categoryId,
    categoryName,
    subcategoryId,
    subcategoryName,
    accountId,
    thirdPartyId,
    thirdPartyName,
    activityId,
    activityName,
    projectId,
    projectName,
    frequency: detectFrequency(filteredTransactions),
    initialAmount: detectInitialAmount(filteredTransactions),
    startDate: getTransactionDate(firstTransaction)?.toISOString().slice(0, 10) || "",
    endDate: "",
    description: buildDescription(filteredTransactions),
    sourceTransactionCount: filteredTransactions.length,
  };
}
