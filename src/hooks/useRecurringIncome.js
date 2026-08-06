/* eslint-disable react-hooks/set-state-in-effect -- listener lifecycle owns loading state */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import {
  createRecurringIncome,
  deleteRecurringIncome,
  subscribeToRecurringIncome,
  updateRecurringIncome,
} from "../services/recurringIncomeService";

export function useRecurringIncomeStore() {
  const { uid } = useAuth();
  const [recurringIncome, setRecurringIncome] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (!uid) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = subscribeToRecurringIncome(
      (data) => {
        setRecurringIncome(data);
        setLoading(false);
      },
      (err) => {
        const message = err?.message || "Erreur lors du chargement des revenus récurrents";
        setError(message);
        setLoading(false);
      },
      { ownerUid: uid }
    );

    return () => unsubscribe();
  }, [uid]);

  const addRecurringIncome = useCallback(async (payload) => {
    try {
      setError(null);
      await createRecurringIncome(payload);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la création";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const updateRecurringIncomeData = useCallback(async (id, payload) => {
    try {
      setError(null);
      await updateRecurringIncome(id, payload);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la mise à jour";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const deleteRecurringIncomeData = useCallback(async (id) => {
    try {
      setError(null);
      await deleteRecurringIncome(id);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la suppression";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  return {
    recurringIncome,
    loading,
    error,
    addRecurringIncome,
    updateRecurringIncome: updateRecurringIncomeData,
    deleteRecurringIncome: deleteRecurringIncomeData,
  };
}

export { useRecurringIncomeContext as useRecurringIncome } from "../context/RecurringIncomeContext";
