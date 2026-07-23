import { useCallback, useEffect, useState } from "react";
import {
  createOpportunity,
  deleteOpportunity,
  setOpportunityActive,
  subscribeToOpportunities,
  updateOpportunity,
} from "../services/opportunitiesService";

export function useOpportunities(options = {}) {
  const includeInactive = options?.includeInactive === true;
  const [opportunities, setOpportunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToOpportunities(
      (data) => {
        setOpportunities(data);
        setLoading(false);
      },
      (err) => {
        setError(err?.message || "Erreur lors du chargement des opportunites");
        setLoading(false);
      },
      { includeInactive }
    );

    return () => unsubscribe();
  }, [includeInactive]);

  const addOpportunity = useCallback(async (payload) => {
    try {
      setError(null);
      const docRef = await createOpportunity(payload);
      return { success: true, id: docRef.id };
    } catch (err) {
      const message = err?.message || "Erreur lors de la creation";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const updateOpportunityData = useCallback(async (id, payload) => {
    try {
      setError(null);
      await updateOpportunity(id, payload);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la mise a jour";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const toggleOpportunityActive = useCallback(async (id, isActive) => {
    try {
      setError(null);
      await setOpportunityActive(id, isActive);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors du changement d'etat";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const deleteOpportunityData = useCallback(async (id) => {
    try {
      setError(null);
      await deleteOpportunity(id);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la suppression";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  return {
    opportunities,
    loading,
    error,
    addOpportunity,
    updateOpportunity: updateOpportunityData,
    toggleOpportunityActive,
    deleteOpportunity: deleteOpportunityData,
  };
}
