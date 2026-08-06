import { useCallback, useEffect, useState } from "react";
import {
  createCategory,
  deleteCategory,
  seedDefaultCategories,
  subscribeToCategories,
  updateCategory,
} from "../services/categoriesService";

export function useCategories(options = {}) {
  const includeInactive = options?.includeInactive === true;
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToCategories(
      (data) => {
        setCategories(data);
        setLoading(false);
      },
      (err) => {
        const message = err?.message || "Erreur lors du chargement des catégories";
        setError(message);
        setLoading(false);
      },
      { includeInactive }
    );

    return () => unsubscribe();
  }, [includeInactive]);

  useEffect(() => {
    seedDefaultCategories().catch(() => {
      // Ignore seed errors; the UI can still work with a manual empty state.
    });
  }, []);

  const addCategory = useCallback(async (payload) => {
    try {
      setError(null);
      const docRef = await createCategory(payload);
      return { success: true, id: docRef.id };
    } catch (err) {
      const message = err?.message || "Erreur lors de la création";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const updateCategoryData = useCallback(async (id, payload) => {
    try {
      setError(null);
      await updateCategory(id, payload);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la mise à jour";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const deleteCategoryData = useCallback(async (id) => {
    try {
      setError(null);
      await deleteCategory(id);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la suppression";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  return {
    categories,
    loading,
    error,
    addCategory,
    updateCategory: updateCategoryData,
    deleteCategory: deleteCategoryData,
  };
}
