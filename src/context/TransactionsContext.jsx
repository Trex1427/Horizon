/* eslint-disable react-hooks/set-state-in-effect -- listener lifecycle owns loading/error state transitions */
/* eslint-disable react-refresh/only-export-components -- provider and consumer hook intentionally share this module */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";
import {
  createTransaction,
  deleteTransaction,
  subscribeToTransactions,
  updateTransaction,
} from "../services/transactionsService";

const TransactionsContext = createContext(undefined);

export function TransactionsProvider({ children }) {
  const { uid } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (!uid) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = subscribeToTransactions(
      (data) => {
        setTransactions(data);
        setLoading(false);
      },
      (err) => {
        const message = err?.message || "Erreur lors du chargement des transactions";
        setError(message);
        setLoading(false);
      },
      { ownerUid: uid }
    );

    return () => unsubscribe();
  }, [uid]);

  const addTransaction = useCallback(async (payload) => {
    try {
      setError(null);
      await createTransaction(payload);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de l'enregistrement";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const updateTransactionById = useCallback(async (id, payload) => {
    try {
      setError(null);
      await updateTransaction(id, payload);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la mise à jour";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const deleteTransactionById = useCallback(async (id) => {
    try {
      setError(null);
      await deleteTransaction(id);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la suppression";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const value = useMemo(
    () => ({
      transactions,
      loading,
      error,
      addTransaction,
      updateTransaction: updateTransactionById,
      deleteTransaction: deleteTransactionById,
    }),
    [transactions, loading, error, addTransaction, updateTransactionById, deleteTransactionById]
  );

  return <TransactionsContext.Provider value={value}>{children}</TransactionsContext.Provider>;
}

export function useTransactionsContext() {
  const context = useContext(TransactionsContext);

  if (!context) {
    throw new Error("useTransactionsContext must be used within a TransactionsProvider");
  }

  return context;
}
