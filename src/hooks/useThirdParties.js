import { useCallback, useEffect, useState } from "react";
import {
  createThirdParty,
  deleteThirdParty,
  subscribeToThirdParties,
  updateThirdParty,
} from "../services/thirdPartiesService";

export function useThirdParties(options = {}) {
  const includeInactive = options?.includeInactive === true;
  const [thirdParties, setThirdParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToThirdParties(
      (data) => {
        setThirdParties(data);
        setLoading(false);
      },
      (err) => {
        setError(err?.message || "Erreur lors du chargement des tiers");
        setLoading(false);
      },
      { includeInactive }
    );

    return () => unsubscribe();
  }, [includeInactive]);

  const addThirdParty = useCallback(async (payload) => {
    try {
      setError(null);
      const docRef = await createThirdParty(payload);
      return { success: true, id: docRef.id };
    } catch (err) {
      const message = err?.message || "Erreur lors de la creation";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const updateThirdPartyData = useCallback(async (id, payload) => {
    try {
      setError(null);
      await updateThirdParty(id, payload);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la mise a jour";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const deactivateThirdParty = useCallback(async (id) => {
    try {
      setError(null);
      await deleteThirdParty(id);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la desactivation";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  return {
    thirdParties,
    loading,
    error,
    addThirdParty,
    updateThirdParty: updateThirdPartyData,
    deactivateThirdParty,
  };
}
