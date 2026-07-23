import { useEffect, useMemo, useState } from "react";
import { subscribeToTransfers } from "../features/transfers/services/transfersService";

export function useTransfers() {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToTransfers(
      (data) => {
        setTransfers(data);
        setLoading(false);
      },
      (err) => {
        setError(err?.message || "Erreur lors du chargement des transferts");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return useMemo(() => ({
    transfers,
    loading,
    error,
  }), [transfers, loading, error]);
}
