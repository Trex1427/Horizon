export const ANALYSIS_PIE_CHART_COPY = Object.freeze({
  fixedExpenses: Object.freeze({
    title: "Repartition des frais fixes",
    subtitle: "Depenses fixes du mois par categorie",
    totalLabel: "Total",
    emptyMessage: "Aucun frais fixe a afficher sur cette periode.",
    valueLabel: "Frais fixes",
    entityLabelSingular: "frais fixe",
    entityLabelPlural: "frais fixes",
  }),
  variableExpenses: Object.freeze({
    title: "Repartition des depenses variables",
    subtitle: "Depenses du mois par categorie",
    totalLabel: "Total",
    emptyMessage: "Aucune depense variable a afficher sur cette periode.",
    valueLabel: "Depenses variables",
    entityLabelSingular: "depense",
    entityLabelPlural: "depenses",
  }),
  fixedIncome: Object.freeze({
    title: "Répartition des revenus fixes",
    subtitle: "Revenus récurrents par source",
    totalLabel: "Total des revenus fixes",
    emptyMessage: "Aucun revenu fixe sur cette période",
    valueLabel: "Revenus fixes",
    entityLabelSingular: "revenu",
    entityLabelPlural: "revenus",
  }),
  variableIncome: Object.freeze({
    title: "Repartition des revenus variables",
    subtitle: "Revenus du mois par categorie",
    totalLabel: "Total des revenus",
    emptyMessage: "Aucun revenu sur cette periode",
    valueLabel: "Revenus variables",
    entityLabelSingular: "revenu",
    entityLabelPlural: "revenus",
  }),
});

export function getAnalysisPieChartCopy(section) {
  return ANALYSIS_PIE_CHART_COPY[section] || {
    title: "Repartition par categorie",
    subtitle: "",
    totalLabel: "Total",
    emptyMessage: "Aucune donnee a afficher sur cette periode.",
    valueLabel: "Montant",
    entityLabelSingular: "element",
    entityLabelPlural: "elements",
  };
}