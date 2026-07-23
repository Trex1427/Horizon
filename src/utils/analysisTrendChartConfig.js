export function getAnalysisTrendChartCopy(section, granularity = "week") {
  const periodLabel = granularity === "week" ? "hebdomadaire" : "mensuelle";

  if (section === "variableIncome") {
    return {
      title: `Evolution ${periodLabel} des revenus`,
      subtitle: "Revenus variables sur la periode selectionnee",
      emptyMessage: "Aucun revenu variable a afficher sur cette periode.",
      revenueLabel: "Revenus variables",
      hideExpense: true,
    };
  }

  return {
    title: `Evolution ${periodLabel} des depenses`,
    subtitle: "Depenses variables sur la periode selectionnee",
    emptyMessage: "Aucune depense variable a afficher sur cette periode.",
    expenseLabel: "Depenses variables",
    hideRevenue: true,
  };
}
