import { useCallback, useEffect, useState } from "react";
import {
  createActivity,
  deleteActivity,
  subscribeToActivities,
  updateActivity,
} from "../services/activitiesService";

export function useActivities(options = {}) {
  const includeInactive = options?.includeInactive === true;
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToActivities(
      (data) => {
        setActivities(data);
        setLoading(false);
      },
      (err) => {
        setError(err?.message || "Erreur lors du chargement des activites");
        setLoading(false);
      },
      { includeInactive }
    );

    return () => unsubscribe();
  }, [includeInactive]);

  const addActivity = useCallback(async (payload) => {
    try {
      setError(null);
      const docRef = await createActivity(payload);
      return { success: true, id: docRef.id };
    } catch (err) {
      const message = err?.message || "Erreur lors de la creation";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const updateActivityData = useCallback(async (id, payload) => {
    try {
      setError(null);
      await updateActivity(id, payload);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la mise a jour";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const deactivateActivity = useCallback(async (id) => {
    try {
      setError(null);
      await deleteActivity(id);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la desactivation";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  return {
    activities,
    loading,
    error,
    addActivity,
    updateActivity: updateActivityData,
    deactivateActivity,
  };
}
