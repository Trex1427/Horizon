import { useCallback, useEffect, useState } from "react";
import {
  createBudget,
  deleteBudget,
  subscribeToBudgets,
  updateBudget,
} from "../services/budgetsService";

export function useBudgets() {
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToBudgets(
      (data) => {
        setBudgets(data);
        setLoading(false);
      },
      (err) => {
        const message = err?.message || "Erreur lors du chargement des budgets";
        setError(message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

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
