/* eslint-disable react-hooks/set-state-in-effect -- listener lifecycle owns loading/error state transitions */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import {
  createBudget,
  deleteBudget,
  subscribeToBudgets,
  updateBudget,
} from "../services/budgetsService";

export function useBudgets() {
  const { uid } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (!uid) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = subscribeToBudgets(
      (data) => {
        setBudgets(data);
        setLoading(false);
      },
      (err) => {
        const message = err?.message || "Erreur lors du chargement des budgets";
        setError(message);
        setLoading(false);
      },
      { ownerUid: uid }
    );

    return () => unsubscribe();
  }, [uid]);

  const addBudget = useCallback(async (payload) => {
    try {
      setError(null);
      await createBudget(payload);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la création";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const updateBudgetData = useCallback(async (id, payload) => {
    try {
      setError(null);
      await updateBudget(id, payload);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la mise à jour";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const deleteBudgetData = useCallback(async (id) => {
    try {
      setError(null);
      await deleteBudget(id);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la suppression";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  return {
    budgets,
    loading,
    error,
    addBudget,
    updateBudget: updateBudgetData,
    deleteBudget: deleteBudgetData,
  };
}
