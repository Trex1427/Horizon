import { useCallback, useEffect, useState } from "react";
import { createWorkProjectFromInvoice, createWorkProjectFromQuote, subscribeToWorkProjects, updateWorkProject } from "../services/workProjectsService.js";

export function useWorkProjects() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => subscribeToWorkProjects(
    (data) => { setProjects(data); setLoading(false); setError(""); },
    (err) => { console.error("work_projects_load_failed", err); setError("Impossible de charger vos dossiers. Réessayez."); setLoading(false); },
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
  const createFromInvoice = useCallback(async (payload) => {
    try { setError(""); return { success: true, value: await createWorkProjectFromInvoice(payload) }; }
    catch (err) { console.error("work_project_invoice_create_failed", err); return { success: false, error: "Impossible de créer le dossier. Réessayez." }; }
  }, []);
  return { projects, loading, error, createFromQuote, createFromInvoice, editProject };
}
