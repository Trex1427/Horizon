export function resolveVisibleSelectedTransactionIds(selectedTransactionIds = [], displayedTransactions = []) {
  const displayedIds = new Set(
    (displayedTransactions || []).map((transaction) => transaction?.id).filter(Boolean)
  );

  return [...new Set(selectedTransactionIds || [])].filter((transactionId) => displayedIds.has(transactionId));
}

export function resolveVisibleSelectedTransactions(selectedTransactionIds = [], displayedTransactions = []) {
  const selectedIds = new Set(resolveVisibleSelectedTransactionIds(selectedTransactionIds, displayedTransactions));
  return (displayedTransactions || []).filter((transaction) => selectedIds.has(transaction?.id));
}
