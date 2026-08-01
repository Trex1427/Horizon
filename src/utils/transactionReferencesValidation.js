function normalizeId(value) {
  return String(value || "").trim();
}

export function subcategoryBelongsToCategory(subcategory = null, categoryId = "") {
  const normalizedCategoryId = normalizeId(categoryId);
  if (!subcategory || !normalizedCategoryId) {
    return false;
  }

  return normalizeId(subcategory.categoryId) === normalizedCategoryId;
}

export function inferCategoryFromThirdParty() {
  // Third-party only data must never force a category automatically.
  return null;
}

export function validateTransactionReferencesForSave(form = {}, catalogs = {}) {
  const subcategoryMap = catalogs?.subcategoryMap || new Map();
  const activityMap = catalogs?.activityMap || new Map();
  const thirdPartyMap = catalogs?.thirdPartyMap || new Map();
  const projectMap = catalogs?.projectMap || new Map();
  const vehicleMap = catalogs?.vehicleMap || new Map();

  if (form.subcategoryId) {
    const subcategory = subcategoryMap.get(form.subcategoryId);
    if (!subcategory) {
      return "Sous-categorie inexistante";
    }

    if (subcategory.isActive === false) {
      return "Sous-categorie inactive";
    }

    if (!subcategoryBelongsToCategory(subcategory, form.categoryId || "")) {
      return "Sous-categorie incompatible avec la categorie";
    }
  }

  if (form.activityId) {
    const activity = activityMap.get(form.activityId);
    if (!activity) {
      return "Activite inexistante";
    }

    if (activity.isActive === false) {
      return "Activite inactive";
    }
  }

  if (form.thirdPartyId) {
    const thirdParty = thirdPartyMap.get(form.thirdPartyId);
    if (!thirdParty) {
      return "Tiers inexistant";
    }

    if (thirdParty.isActive === false) {
      return "Tiers inactif";
    }
  }

  if (form.projectId) {
    const project = projectMap.get(form.projectId);
    if (!project) {
      return "Projet inexistant";
    }

    if (project.isActive === false) {
      return "Projet inactif";
    }
  }

  if (form.vehicleId) {
    const vehicle = vehicleMap.get(form.vehicleId);
    if (!vehicle) return "Véhicule inexistant";
    if (vehicle.isDeleted === true && catalogs.allowDeletedVehicleId !== form.vehicleId) return "Véhicule supprimé";
  }

  return "";
}
