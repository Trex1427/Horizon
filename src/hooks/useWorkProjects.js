import { useCallback, useEffect, useState } from "react";
import { createWorkProjectFromQuote, subscribeToWorkProjects, updateWorkProject } from "../services/workProjectsService.js";

export function useWorkProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => subscribeToWorkProjects(
    (data) => { setProjects(data); setLoading(false); setError(""); },
    (err) => { setError(err?.message || "Chargement des dossiers impossible."); setLoading(false); },
  ), []);

  const createFromQuote = useCallback(async (quote, options) => {
    try {
      setError("");
      return { success: true, value: await createWorkProjectFromQuote(quote, options) };
    } catch (err) {
      const message = err?.message || "Création du dossier impossible.";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const editProject = useCallback(async (projectId, payload) => {
    try { setError(""); return { success: true, value: await updateWorkProject(projectId, payload) }; }
    catch (err) { const message = err?.message || "Mise à jour du dossier impossible."; setError(message); return { success: false, error: message }; }
  }, []);
  return { projects, loading, error, createFromQuote, editProject };
}
