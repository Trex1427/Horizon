import { useCallback, useEffect, useState } from "react";
import {
  createSubcategory,
  deleteSubcategory,
  deleteSubcategoryPermanently,
  isSubcategoryUsed,
  subscribeToSubcategories,
  updateSubcategory,
} from "../services/subcategoriesService";

export function useSubcategories(options = {}) {
  const includeInactive = options?.includeInactive === true;
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToSubcategories(
      (data) => {
        setSubcategories(data);
        setLoading(false);
      },
      (err) => {
        setError(err?.message || "Erreur lors du chargement des sous-categories");
        setLoading(false);
      },
      { includeInactive }
    );

    return () => unsubscribe();
  }, [includeInactive]);

  const addSubcategory = useCallback(async (payload) => {
    try {
      setError(null);
      const docRef = await createSubcategory(payload);
      return { success: true, id: docRef.id };
    } catch (err) {
      const message = err?.message || "Erreur lors de la creation";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const updateSubcategoryData = useCallback(async (id, payload) => {
    try {
      setError(null);
      await updateSubcategory(id, payload);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la mise a jour";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const deactivateSubcategoryData = useCallback(async (id) => {
    try {
      setError(null);
      await deleteSubcategory(id);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la desactivation";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  const removeSubcategoryData = useCallback(async (id) => {
    try {
      setError(null);
      const used = await isSubcategoryUsed(id);
      if (used) {
        return { success: false, error: "Sous-categorie deja utilisee dans des transactions." };
      }
      await deleteSubcategoryPermanently(id);
      return { success: true };
    } catch (err) {
      const message = err?.message || "Erreur lors de la suppression";
      setError(message);
      return { success: false, error: message };
    }
  }, []);

  return {
    subcategories,
    loading,
    error,
    addSubcategory,
    updateSubcategory: updateSubcategoryData,
    deactivateSubcategory: deactivateSubcategoryData,
    removeSubcategory: removeSubcategoryData,
  };
}
