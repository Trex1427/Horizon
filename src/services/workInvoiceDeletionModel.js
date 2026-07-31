export function planWorkInvoiceDeletion({ invoiceId, invoice = {}, transactions = [], deleteLinkedTransaction = false }) {
  const paymentTransactionId = String(invoice.paymentTransactionId || "").trim();
  const seen = new Set();
  const linkedTransactions = transactions.filter((entry) => {
    if (!entry?.id || seen.has(entry.id)) return false;
    const linked = entry.id === paymentTransactionId || entry.workInvoiceId === invoiceId;
    if (linked) seen.add(entry.id);
    return linked;
  }).map((entry) => ({
    id: entry.id,
    removeInvoiceLink: entry.workInvoiceId === invoiceId,
    softDelete: deleteLinkedTransaction && entry.isDeleted !== true,
    alreadyDeleted: entry.isDeleted === true,
  }));

  return {
    invoicePatch: { softDelete: true, removePaymentLink: Boolean(paymentTransactionId) },
    linkedTransactions,
    transactionDeleted: linkedTransactions.some((entry) => entry.softDelete),
    transactionKept: linkedTransactions.some((entry) => !entry.softDelete && !entry.alreadyDeleted),
  };
}
