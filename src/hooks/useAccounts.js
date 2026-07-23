import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createAccount,
  DEFAULT_ACCOUNT_NAME,
  deleteAccount,
  subscribeToAccounts,
  updateAccount,
} from "../services/accountsService";

export function useAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToAccounts(
      (data) => {
        setAccounts(data);
        setLoading(false);
      },
      (err) => {
        setError(err?.message || "Erreur lors du chargement des comptes");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const addAccount = useCallback(async (payload) => {
    try {
      setError(null);
      const docRef = await createAccount(payload);
      return { success: true, id: docRef.id };
    } catch (err) {
      const message = err?.message || "Erreur lors de la crÃ©ation du compte";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const updateAccountData = useCallback(async (id, payload) => {
    try {
      setError(null);
      await updateAccount(id, payload);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la mise Ã  jour du compte";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const deleteAccountData = useCallback(async (id) => {
    try {
      setError(null);
      await deleteAccount(id);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la suppression du compte";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const defaultAccount = useMemo(() => {
    return accounts.find((account) => account.name === DEFAULT_ACCOUNT_NAME) || accounts[0] || null;
  }, [accounts]);

  return {
    accounts,
    loading,
    error,
    addAccount,
    updateAccount: updateAccountData,
    deleteAccount: deleteAccountData,
    defaultAccount,
  };
}
