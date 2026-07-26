import { useCallback, useEffect, useMemo, useState } from "react";
import { createDebtReceivable, deleteDebtReceivable, subscribeToDebtsReceivables, updateDebtReceivable } from "../services/debtsReceivablesService.js";
import {
  createDebtReceivablePayment,
  deleteDebtReceivablePayment,
  subscribeToActiveDebtReceivablePayments,
  updateDebtReceivablePayment,
} from "../services/debtReceivablePaymentsService.js";
import { enrichDebtReceivableWithPayments } from "../services/debtsReceivablesModel.js";

export function useDebtsReceivables() {
  const [items, setItems] = useState([]);
  const [activePayments, setActivePayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => subscribeToDebtsReceivables(
    (data) => { setItems(data); setLoading(false); },
    (err) => { setError(err?.message || "Erreur lors du chargement."); setLoading(false); },
  ), []);

  useEffect(() => subscribeToActiveDebtReceivablePayments(
    (data) => setActivePayments(data),
    (err) => setError(err?.message || "Erreur lors du chargement des paiements."),
  ), []);

  const run = useCallback(async (operation) => {
    try {
      setError(null);
      const result = await operation();
      return { success: true, id: result?.id };
    } catch (err) {
      const message = err?.message || "L’opération a échoué.";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const paymentsByParent = useMemo(() => {
    const grouped = new Map();
    for (const payment of activePayments) {
      const parentId = String(payment?.debtReceivableId || "").trim();
      if (!parentId || payment?.isDeleted === true) continue;
      const existing = grouped.get(parentId) || [];
      existing.push(payment);
      grouped.set(parentId, existing);
    }
    return grouped;
  }, [activePayments]);

  const enrichedItems = useMemo(() => (
    items.map((item) => enrichDebtReceivableWithPayments(item, paymentsByParent.get(item.id) || []))
  ), [items, paymentsByParent]);

  return {
    items: enrichedItems,
    loading,
    error,
    create: useCallback((payload) => run(() => createDebtReceivable(payload)), [run]),
    update: useCallback((id, payload) => run(() => updateDebtReceivable(id, payload)), [run]),
    remove: useCallback((id) => run(() => deleteDebtReceivable(id)), [run]),
    createPayment: useCallback((debtReceivableId, payload) => run(() => createDebtReceivablePayment(debtReceivableId, payload)), [run]),
    updatePayment: useCallback((paymentId, payload) => run(() => updateDebtReceivablePayment(paymentId, payload)), [run]),
    removePayment: useCallback((paymentId) => run(() => deleteDebtReceivablePayment(paymentId)), [run]),
  };
}
