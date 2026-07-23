export const ACTIVITY_KIND_OPTIONS = [
  { value: "profit_center", label: "Centre de profit" },
  { value: "interest_center", label: "Centre d'interet" },
  { value: "mixed", label: "Mixte" },
];

export const THIRD_PARTY_TYPE_OPTIONS = [
  { value: "client", label: "Client" },
  { value: "supplier", label: "Fournisseur" },
  { value: "administration", label: "Administration" },
  { value: "employer", label: "Employeur" },
  { value: "bank", label: "Banque" },
  { value: "social_organization", label: "Organisme social" },
  { value: "individual", label: "Particulier" },
  { value: "other", label: "Autre" },
];

export const DEFAULT_SUBCATEGORY_SEED = [
  { name: "Carburant", categoryName: "Transport", type: "depense" },
  { name: "Assurance vehicule", categoryName: "Transport", type: "depense" },
  { name: "Entretien", categoryName: "Transport", type: "depense" },
  { name: "Reparations", categoryName: "Transport", type: "depense" },
  { name: "Peages", categoryName: "Transport", type: "depense" },
  { name: "Stationnement", categoryName: "Transport", type: "depense" },
  { name: "Loyer", categoryName: "Logement", type: "depense" },
  { name: "Electricite", categoryName: "Logement", type: "depense" },
  { name: "Eau", categoryName: "Logement", type: "depense" },
  { name: "Assurance habitation", categoryName: "Logement", type: "depense" },
  { name: "Entretien", categoryName: "Logement", type: "depense" },
  { name: "Travaux", categoryName: "Logement", type: "depense" },
  { name: "Materiel", categoryName: "Loisirs", type: "depense" },
  { name: "Sorties", categoryName: "Loisirs", type: "depense" },
  { name: "Culture", categoryName: "Loisirs", type: "depense" },
  { name: "Vacances", categoryName: "Loisirs", type: "depense" },
  { name: "Cotisations et permis", categoryName: "Loisirs", type: "depense" },
  { name: "Prestation", categoryName: "Revenus professionnels", type: "revenu" },
  { name: "Vente", categoryName: "Revenus professionnels", type: "revenu" },
  { name: "Acompte", categoryName: "Revenus professionnels", type: "revenu" },
  { name: "Solde de chantier", categoryName: "Revenus professionnels", type: "revenu" },
  { name: "France Travail", categoryName: "Aides et prestations", type: "revenu" },
  { name: "CAF", categoryName: "Aides et prestations", type: "revenu" },
  { name: "CPAM", categoryName: "Aides et prestations", type: "revenu" },
  { name: "Pension d'invalidite", categoryName: "Aides et prestations", type: "revenu" },
  { name: "Prime d'activite", categoryName: "Aides et prestations", type: "revenu" },
];

export const DEFAULT_ACTIVITY_SEED = [
  { name: "Auto-entreprise", kind: "profit_center" },
  { name: "Pet sitting", kind: "profit_center" },
  { name: "Peche", kind: "interest_center" },
  { name: "Chasse", kind: "interest_center" },
  { name: "Sport", kind: "interest_center" },
  { name: "Bricolage", kind: "interest_center" },
  { name: "Jardinage", kind: "interest_center" },
  { name: "Maison", kind: "interest_center" },
  { name: "Personnel", kind: "interest_center" },
  { name: "Animaux", kind: "mixed" },
  { name: "Voyages", kind: "mixed" },
];

export const DEFAULT_PROJECT_SEED = [
  { name: "Chantier Monod" },
  { name: "Portail maman" },
  { name: "Garde Roy" },
];
