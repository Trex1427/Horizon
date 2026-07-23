export const EXPENSE_CATEGORIES = [
  "Alimentation",
  "Produits d’entretien et hygiène",
  "Logement",
  "Assurance logement",
  "Transport",
  "Entretien véhicule",
  "Santé",
  "Animaux",
  "Loisirs",
  "Matériel",
  "Abonnements",
  "Impôts / taxes",
  "Autre dépense",
];

export const INCOME_CATEGORIES = [
  "Salaire",
  "Paysagisme",
  "Peinture",
  "Pet-sitting",
  "Dogi Park",
  "Vente matériel",
  "Remboursement",
  "Aide / allocation",
  "Devis / acomptes",
  "Cadeau",
  "Autre revenu",
];

export function getCategoryOptions(type) {
  return type === "revenu" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function getCompatibleCategory(type, currentCategory) {
  const options = getCategoryOptions(type);

  if (!currentCategory) {
    return options[0];
  }

  return options.includes(currentCategory) ? currentCategory : options[0];
}
