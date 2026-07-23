import { useCallback, useEffect, useState } from "react";
import {
  createProject,
  deleteProject,
  subscribeToProjects,
  updateProject,
} from "../services/projectsService";

export function useProjects(options = {}) {
  const includeInactive = options?.includeInactive === true;
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToProjects(
      (data) => {
        setProjects(data);
        setLoading(false);
      },
      (err) => {
        setError(err?.message || "Erreur lors du chargement des projets");
        setLoading(false);
      },
      { includeInactive }
    );

    return () => unsubscribe();
  }, [includeInactive]);

  const addProject = useCallback(async (payload) => {
    try {
      setError(null);
      const docRef = await createProject(payload);
      return { success: true, id: docRef.id };
    } catch (err) {
      const message = err?.message || "Erreur lors de la creation";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const updateProjectData = useCallback(async (id, payload) => {
    try {
      setError(null);
      await updateProject(id, payload);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la mise a jour";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const deactivateProject = useCallback(async (id) => {
    try {
      setError(null);
      await deleteProject(id);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la desactivation";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  return {
    projects,
    loading,
    error,
    addProject,
    updateProject: updateProjectData,
    deactivateProject,
  };
}
