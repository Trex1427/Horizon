import { useMemo, useState } from "react";
import { Alert, Box, CircularProgress, Stack, useMediaQuery } from "@mui/material";
import { useBudgets } from "../hooks/useBudgets";
import { useCategories } from "../hooks/useCategories";
import { useSubcategories } from "../hooks/useSubcategories";
import { useTransactionsContext } from "../context/TransactionsContext";
import { BudgetCard } from "../components/BudgetCard";
import { BudgetForm } from "../components/BudgetForm";
import { calculateBudgetMetrics } from "../services/budgetsService";
import { selectNonOverlappingBudgetsForForecast } from "../services/financeCalculations";
import { buildBudgetComparisonData } from "../utils/chartDataUtils";
import BudgetComparisonChart from "../components/charts/BudgetComparisonChart";
import { getSafeCategoryLabel } from "../utils/displayTextUtils";
import {
  PILOTAGE_COLORS,
  PilotageEmptyState,
  PilotageHeader,
  PilotagePageShell,
  PilotageSection,
  PilotageSummary,
} from "../components/PilotagePageLayout";

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

export default function Budgets() {
  const enableDesktopDoubleClickEdit = useMediaQuery("(min-width:900px)");
  const { budgets, loading, error, addBudget, updateBudget, deleteBudget } = useBudgets();
  const { categories } = useCategories();
  const { subcategories } = useSubcategories();
  const { transactions } = useTransactionsContext();
  const [formOpen, setFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [searchText, setSearchText] = useState("");

  const budgetRows = useMemo(() => (
    (budgets || []).map((budget) => {
      const metrics = calculateBudgetMetrics(budget, transactions);
      return {
        id: budget.id,
        budget,
        name: [getSafeCategoryLabel(budget.categoryName || budget.name, "Sans catégorie"), budget.subcategoryName].filter(Boolean).join(" · "),
        plannedAmount: Number(metrics.plannedAmount || 0),
        spentAmount: Number(metrics.spentAmount || 0),
        remainingAmount: Number(metrics.remainingAmount || 0),
      };
    })
  ), [budgets, transactions]);

  const budgetComparisonData = useMemo(() => buildBudgetComparisonData(
    budgetRows.map((row) => ({
      id: row.id,
      name: row.name,
      plannedAmount: row.plannedAmount,
      spentAmount: row.spentAmount,
    }))
  ), [budgetRows]);

  const filteredBudgetRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return budgetRows;
    }

    return budgetRows.filter((row) => (
      row.name.toLowerCase().includes(query)
      || String(row.budget?.name || "").toLowerCase().includes(query)
      || String(row.budget?.categoryName || "").toLowerCase().includes(query)
      || String(row.budget?.subcategoryName || "").toLowerCase().includes(query)
    ));
  }, [budgetRows, searchText]);

  const summary = useMemo(() => {
    const selectedBudgets = new Set(selectNonOverlappingBudgetsForForecast(budgets));
    return budgetRows
      .filter((row) => selectedBudgets.has(row.budget))
      .reduce((acc, row) => ({
        planned: acc.planned + row.plannedAmount,
        spent: acc.spent + row.spentAmount,
        remaining: acc.remaining + row.remainingAmount,
      }), { planned: 0, spent: 0, remaining: 0 });
  }, [budgetRows, budgets]);

  const handleSubmit = async (payload) => {
    if (editingBudget) {
      return updateBudget(editingBudget.id, payload);
    }

    return addBudget(payload);
  };

  const handleEdit = (budget) => {
    setEditingBudget(budget);
    setFormOpen(true);
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditingBudget(null);
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <PilotagePageShell>
      <PilotageHeader
        title="Budgets"
        countLabel={`${budgets.length} budget(s)`}
        searchValue={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Rechercher un budget"
        onAdd={() => {
          setEditingBudget(null);
          setFormOpen(true);
        }}
      />

      {error && (
        <Alert severity="error">
          {error}
        </Alert>
      )}

      <PilotageSummary
        items={[
          { label: "Total budgété", value: formatCurrency(summary.planned), color: PILOTAGE_COLORS.blue },
          { label: "Consommé", value: formatCurrency(summary.spent), color: summary.spent > summary.planned ? PILOTAGE_COLORS.red : PILOTAGE_COLORS.orange },
          { label: "Restant", value: formatCurrency(summary.remaining), color: summary.remaining >= 0 ? PILOTAGE_COLORS.green : PILOTAGE_COLORS.red },
        ]}
      />

      {!error && budgetComparisonData.length > 0 && (
        <PilotageSection title="KPIs" subtitle="Lecture rapide du budget prévu et consommé.">
          <BudgetComparisonChart data={budgetComparisonData} />
        </PilotageSection>
      )}

      <PilotageSection title="Liste principale" subtitle={`${filteredBudgetRows.length} budget(s) affiché(s)`}>
        {budgets.length === 0 ? (
          <PilotageEmptyState>Aucun budget pour le moment.</PilotageEmptyState>
        ) : filteredBudgetRows.length === 0 ? (
          <PilotageEmptyState>Aucun budget ne correspond à la recherche.</PilotageEmptyState>
        ) : (
          <Stack spacing={1.25}>
            {filteredBudgetRows.map(({ budget }) => (
              <BudgetCard
                key={budget.id}
                budget={budget}
                onEdit={handleEdit}
                onDelete={deleteBudget}
                transactions={transactions}
                enableDoubleClickEdit={enableDesktopDoubleClickEdit}
              />
            ))}
          </Stack>
        )}
      </PilotageSection>

      <BudgetForm
        open={formOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialBudget={editingBudget}
        isLoading={false}
        categories={categories}
        subcategories={subcategories}
      />
    </PilotagePageShell>
  );
}
