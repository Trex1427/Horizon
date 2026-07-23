import { useCallback, useEffect, useState } from "react";
import {
  createObjective,
  deleteObjective,
  subscribeToObjectives,
  updateObjective,
} from "../services/objectivesService";
import { OBJECTIVE_STATUS } from "../constants/objectiveStatuses";

export function useObjectives() {
  const [objectives, setObjectives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToObjectives(
      (data) => {
        setObjectives(data);
        setLoading(false);
      },
      (err) => {
        const message = err?.message || "Erreur lors du chargement des objectifs";
        setError(message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const addObjective = useCallback(async (payload) => {
    try {
      setError(null);
      // Calculate status based on currentAmount
      const status =
        payload.currentAmount === 0
          ? OBJECTIVE_STATUS.NOT_STARTED
          : payload.currentAmount >= payload.targetAmount
            ? OBJECTIVE_STATUS.COMPLETED
            : OBJECTIVE_STATUS.IN_PROGRESS;

      await createObjective({
        ...payload,
        status,
      });
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la création";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const updateObjectiveData = useCallback(async (id, payload) => {
    try {
      setError(null);
      // Recalculate status if amounts change
      const updatedPayload = { ...payload };
      if (payload.currentAmount !== undefined && payload.targetAmount !== undefined) {
        updatedPayload.status =
          payload.currentAmount === 0
            ? OBJECTIVE_STATUS.NOT_STARTED
            : payload.currentAmount >= payload.targetAmount
              ? OBJECTIVE_STATUS.COMPLETED
              : OBJECTIVE_STATUS.IN_PROGRESS;
      }

      await updateObjective(id, updatedPayload);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la mise à jour";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const deleteObjectiveData = useCallback(async (id) => {
    try {
      setError(null);
      await deleteObjective(id);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la suppression";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  return {
    objectives,
    loading,
    error,
    addObjective,
    updateObjective: updateObjectiveData,
    deleteObjective: deleteObjectiveData,
  };
}
