/* eslint-disable react-hooks/set-state-in-effect -- listener lifecycle owns loading/error state transitions */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";
import {
  createAccount,
  DEFAULT_ACCOUNT_NAME,
  deleteAccount,
  initializeDefaultAccountsIfEmpty,
  subscribeToAccounts,
  updateAccount,
} from "../services/accountsService";
import { seedDefaultCategories } from "../services/categoriesService";
import { seedDefaultSubcategories } from "../services/subcategoriesService";

export function useAccounts() {
  const { uid } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (!uid) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let unsubscribe = () => {};

    async function initializeAndSubscribe() {
      try {
        await initializeDefaultAccountsIfEmpty();
        await seedDefaultCategories();
        await seedDefaultSubcategories();
        if (cancelled) return;
        unsubscribe = subscribeToAccounts(
          (data) => {
            setAccounts(data);
            setLoading(false);
          },
          (err) => {
            setError(err?.message || "Erreur lors du chargement des comptes");
            setLoading(false);
          },
          { ownerUid: uid }
        );
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Erreur lors de l'initialisation de l'environnement");
          setLoading(false);
        }
      }
    }

    initializeAndSubscribe();
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [uid]);

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
    return accounts.find((account) => account.isDefault === true) || accounts.find((account) => account.name === DEFAULT_ACCOUNT_NAME) || accounts[0] || null;
  }, [accounts]);

  console.log("USE_ACCOUNTS =", accounts);

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
