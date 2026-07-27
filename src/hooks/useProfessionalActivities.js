import { useCallback, useEffect, useState } from "react";
import {
  createProfessionalActivity,
  setProfessionalActivityActive,
  subscribeToProfessionalActivities,
  updateProfessionalActivity,
} from "../services/professionalActivitiesService.js";

export function useProfessionalActivities() {
  const [professionalActivities, setProfessionalActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => subscribeToProfessionalActivities(
    (data) => { setProfessionalActivities(data); setLoading(false); },
    (err) => { setError(err?.message || "Chargement impossible."); setLoading(false); },
  ), []);
  const run = useCallback(async (operation) => {
    try { setError(""); return { success: true, value: await operation() }; }
    catch (err) { const message = err?.message || "Opération impossible."; setError(message); return { success: false, error: message }; }
  }, []);
  return {
    professionalActivities, loading, error,
    addProfessionalActivity: useCallback((payload) => run(() => createProfessionalActivity(payload)), [run]),
    editProfessionalActivity: useCallback((id, payload) => run(() => updateProfessionalActivity(id, payload)), [run]),
    toggleProfessionalActivity: useCallback((id, active) => run(() => setProfessionalActivityActive(id, active)), [run]),
  };
}
