/* eslint-disable react-hooks/set-state-in-effect -- listener lifecycle owns loading/error state transitions */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { subscribeToTransfers } from "../features/transfers/services/transfersService";

export function useTransfers() {
  const { uid } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (!uid) {
      setLoading(false);
      return undefined;
    }

    const unsubscribe = subscribeToTransfers(
      (data) => {
        setTransfers(data);
        setLoading(false);
      },
      (err) => {
        setError(err?.message || "Erreur lors du chargement des transferts");
        setLoading(false);
      },
      { ownerUid: uid }
    );

    return () => unsubscribe();
  }, [uid]);

  return useMemo(() => ({
    transfers,
    loading,
    error,
  }), [transfers, loading, error]);
}
