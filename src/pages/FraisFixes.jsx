import { useMemo, useState } from "react";
import { Alert, Box, CircularProgress, Stack, useMediaQuery } from "@mui/material";
import { useFixedExpenses } from "../hooks/useFixedExpenses";
import { useAccounts } from "../hooks/useAccounts";
import { useCategories } from "../hooks/useCategories";
import { useSubcategories } from "../hooks/useSubcategories";
import { FixedExpenseCard } from "../components/FixedExpenseCard";
import { FixedExpenseForm } from "../components/FixedExpenseForm";
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

function normalizeSearch(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function FraisFixes() {
  const enableDesktopDoubleClickEdit = useMediaQuery("(min-width:900px)");
  const { fixedExpenses, loading, error, addFixedExpense, updateFixedExpense, deleteFixedExpense } =
    useFixedExpenses();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { subcategories } = useSubcategories();
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [searchText, setSearchText] = useState("");

  const accountMap = useMemo(
    () => new Map((accounts || []).map((account) => [account.id, account.name || ""])),
    [accounts]
  );

  const filteredFixedExpenses = useMemo(() => {
    const needle = normalizeSearch(searchText);
    if (!needle) return fixedExpenses;

    return fixedExpenses.filter((item) => normalizeSearch([
      item.name,
      item.categoryName,
      item.category,
      item.subcategoryName,
      accountMap.get(item.accountId),
    ].filter(Boolean).join(" ")).includes(needle));
  }, [accountMap, fixedExpenses, searchText]);

  const summary = useMemo(() => {
    const active = fixedExpenses.filter((item) => item.isActive !== false);
    const inactive = fixedExpenses.length - active.length;
    const monthlyTotal = active.reduce((sum, item) => {
      const amount = Number(item.initialAmount || item.amount || 0);
      return sum + (item.frequency === "annual" ? amount / 12 : amount);
    }, 0);

    return { activeCount: active.length, inactiveCount: inactive, monthlyTotal };
  }, [fixedExpenses]);

  const handleSubmit = async (payload) => {
    if (editingExpense) {
      return updateFixedExpense(editingExpense.id, payload);
    }

    return addFixedExpense(payload);
  };

  const handleEdit = (fixedExpense) => {
    setEditingExpense(fixedExpense);
    setFormOpen(true);
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditingExpense(null);
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
        title="Frais fixes"
        countLabel={`${fixedExpenses.length} fiche(s) · ${summary.activeCount} active(s)`}
        searchValue={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Rechercher un frais fixe"
        onAdd={() => {
          setEditingExpense(null);
          setFormOpen(true);
        }}
      />

      {error && <Alert severity="error">{error}</Alert>}

      <PilotageSummary
        items={[
          { label: "Total mensuel prévu", value: formatCurrency(summary.monthlyTotal), color: PILOTAGE_COLORS.red },
          { label: "Actifs", value: summary.activeCount, color: PILOTAGE_COLORS.blue },
          { label: "Inactifs", value: summary.inactiveCount, color: PILOTAGE_COLORS.muted },
        ]}
      />

      <PilotageSection
        title="Liste principale"
        subtitle={`${filteredFixedExpenses.length} fiche(s) affichée(s)`}
      >
        {filteredFixedExpenses.length === 0 ? (
          <PilotageEmptyState>
            {fixedExpenses.length === 0 ? "Aucun frais fixe pour le moment." : "Aucune correspondance de recherche."}
          </PilotageEmptyState>
        ) : (
          <Stack spacing={1}>
            {filteredFixedExpenses.map((fixedExpense) => (
              <FixedExpenseCard
                key={fixedExpense.id}
                fixedExpense={fixedExpense}
                onEdit={handleEdit}
                onDelete={deleteFixedExpense}
                accounts={accounts}
                enableDoubleClickEdit={enableDesktopDoubleClickEdit}
              />
            ))}
          </Stack>
        )}
      </PilotageSection>

      <FixedExpenseForm
        open={formOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialExpense={editingExpense}
        isLoading={false}
        accounts={accounts}
        categories={categories}
        subcategories={subcategories}
      />
    </PilotagePageShell>
  );
}

