import { useCallback, useEffect, useState } from "react";
import { createVehicle, deleteVehicle, sortVehicles, subscribeVehicles, updateVehicle } from "../services/vehicleService.js";

export function useVehicles(options = {}) {
  const includeDeleted = options.includeDeleted === true;
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => subscribeVehicles(
    (data) => { setVehicles(data); setLoading(false); setError(""); },
    (err) => { setError(err?.message || "Chargement des véhicules impossible."); setLoading(false); },
    { includeDeleted },
  ), [includeDeleted]);
  const run = useCallback(async (operation) => {
    try { setError(""); return { success: true, value: await operation() }; }
    catch (err) { const message = err?.message || "Opération impossible."; setError(message); return { success: false, error: message }; }
  }, []);
  const addVehicle = useCallback(async (payload) => {
    const result = await run(() => createVehicle(payload));
    if (result.success) {
      const createdVehicle = {
        id: result.value.id,
        name: String(payload?.name || "").trim(),
        isDeleted: false,
      };
      setVehicles((previous) => sortVehicles([
        ...previous.filter((vehicle) => vehicle.id !== createdVehicle.id),
        createdVehicle,
      ]));
    }
    return result;
  }, [run]);
  return {
    vehicles, loading, error,
    addVehicle,
    editVehicle: useCallback((id, payload) => run(() => updateVehicle(id, payload)), [run]),
    removeVehicle: useCallback((id) => run(() => deleteVehicle(id)), [run]),
  };
}
