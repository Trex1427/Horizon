import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  createTransaction,
  deleteTransaction,
  subscribeToTransactions,
  updateTransaction,
} from "../services/transactionsService";

const TransactionsContext = createContext(undefined);

export function TransactionsProvider({ children }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToTransactions(
      (data) => {
        setTransactions(data);
        setLoading(false);
      },
      (err) => {
        const message = err?.message || "Erreur lors du chargement des transactions";
        setError(message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

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
