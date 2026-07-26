import { useCallback, useEffect, useState } from "react";
import {
  createDebtReceivablePayment,
  deleteDebtReceivablePayment,
  subscribeToDebtReceivablePaymentsHistory,
  updateDebtReceivablePayment,
} from "../services/debtReceivablePaymentsService.js";

export function useDebtReceivablePayments(debtReceivableId) {
  const safeDebtReceivableId = String(debtReceivableId || "").trim();
  const [payments, setPayments] = useState([]);
  const [loadedDebtReceivableId, setLoadedDebtReceivableId] = useState(null);
  const [error, setError] = useState(null);

  const loading = loadedDebtReceivableId !== safeDebtReceivableId;

  useEffect(() => {
    return subscribeToDebtReceivablePaymentsHistory(
      safeDebtReceivableId,
      (data) => {
        setPayments(data);
        setLoadedDebtReceivableId(safeDebtReceivableId);
        setError(null);
      },
      (err) => {
        setError(err?.message || "Erreur lors du chargement des paiements.");
        setLoadedDebtReceivableId(safeDebtReceivableId);
      },
    );
  }, [safeDebtReceivableId]);

  const run = useCallback(async (operation, operationName) => {
    try {
      setError(null);
      const result = await operation();
      return { success: true, id: result?.id };
    } catch (err) {
      console.error("[debt-receivable-payment]", { operation: operationName, debtReceivableId: safeDebtReceivableId }, err);
      const message = err?.message || "L'operation de paiement a echoue.";
      setError(message);
      return { success: false, error: message };
    }
  }, [safeDebtReceivableId]);

  return {
    payments,
    loading,
    error,
    create: useCallback((payload) => run(() => createDebtReceivablePayment(safeDebtReceivableId, payload), "create"), [safeDebtReceivableId, run]),
    update: useCallback((paymentId, payload) => run(() => updateDebtReceivablePayment(paymentId, payload), "update"), [run]),
    remove: useCallback((paymentId) => run(() => deleteDebtReceivablePayment(paymentId), "delete"), [run]),
  };
}
