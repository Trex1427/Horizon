/* eslint-disable react-hooks/set-state-in-effect -- listener lifecycle owns loading/error state transitions */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/useAuth";
import {
  createFixedExpense,
  deleteFixedExpense,
  subscribeToFixedExpenses,
  updateFixedExpense,
} from "../services/fixedExpensesService";

export function useFixedExpenses() {
  const { uid } = useAuth();
  const createSubmittingRef = useRef(false);
  const [fixedExpenses, setFixedExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (!uid) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = subscribeToFixedExpenses(
      (data) => {
        setFixedExpenses(data);
        setLoading(false);
      },
      (err) => {
        const message = err?.message || "Erreur lors du chargement des frais fixes";
        setError(message);
        setLoading(false);
      },
      { ownerUid: uid }
    );

    return () => unsubscribe();
  }, [uid]);

  const addFixedExpense = useCallback(async (payload) => {
    console.log("[CREATE FIXED]", "service =", "useFixedExpenses");
    console.log("[CREATE FIXED]", "function =", "addFixedExpense");
    if (createSubmittingRef.current) {
      return { success: false, error: "Création déjà en cours", code: "fixed-expense/submission-in-progress" };
    }

    createSubmittingRef.current = true;
    try {
      setError(null);
      console.log("[CREATE FIXED]", "next =", "createFixedExpense(payload)");
      const createdRef = await createFixedExpense(payload);
      return { success: true, id: createdRef?.id || "" };
    } catch (err) {
      const message = err?.message || "Erreur lors de la création";
      setError(message);
      return { success: false, error: message, code: err?.code || "", existingId: err?.existingId || "" };
    } finally {
      createSubmittingRef.current = false;
    }
  }, []);

  const updateFixedExpenseData = useCallback(async (id, payload) => {
    try {
      setError(null);
      await updateFixedExpense(id, payload);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la mise à jour";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const deleteFixedExpenseData = useCallback(async (id) => {
    try {
      setError(null);
      await deleteFixedExpense(id);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la suppression";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  return {
    fixedExpenses,
    loading,
    error,
    addFixedExpense,
    updateFixedExpense: updateFixedExpenseData,
    deleteFixedExpense: deleteFixedExpenseData,
  };
}
