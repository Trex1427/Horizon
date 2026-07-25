import { useCallback, useEffect, useState } from "react";
import { createDebtReceivable, deleteDebtReceivable, subscribeToDebtsReceivables, updateDebtReceivable } from "../services/debtsReceivablesService.js";

export function useDebtsReceivables() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => subscribeToDebtsReceivables(
    (data) => { setItems(data); setLoading(false); },
    (err) => { setError(err?.message || "Erreur lors du chargement."); setLoading(false); },
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

  return {
    items, loading, error,
    create: useCallback((payload) => run(() => createDebtReceivable(payload)), [run]),
    update: useCallback((id, payload) => run(() => updateDebtReceivable(id, payload)), [run]),
    remove: useCallback((id) => run(() => deleteDebtReceivable(id)), [run]),
  };
}
