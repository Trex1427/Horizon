import { useMemo, useState } from "react";
import { Alert, Box, CircularProgress, Stack, useMediaQuery, useTheme } from "@mui/material";
import { useRecurringIncome } from "../hooks/useRecurringIncome";
import { useAccounts } from "../hooks/useAccounts";
import { useCategories } from "../hooks/useCategories";
import { RecurringIncomeCard } from "../components/RecurringIncomeCard";
import { RecurringIncomeForm } from "../components/RecurringIncomeForm";
import { getRecurringIncomeApplicableAmount } from "../utils/recurringIncomeAmount";
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

function normalizeCategoryName(value) {
  return (value || "").trim().toLowerCase();
}

function normalizeSearch(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function getTodayString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

export default function RevenusRecurrents() {
  const theme = useTheme();
  const enableDesktopDoubleClickEdit = useMediaQuery(theme.breakpoints.up("md"));
  const { recurringIncome, loading, error, addRecurringIncome, updateRecurringIncome, deleteRecurringIncome } =
    useRecurringIncome();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const [formOpen, setFormOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);
  const [searchText, setSearchText] = useState("");

  const accountMap = useMemo(
    () => new Map((accounts || []).map((account) => [account.id, account.name || ""])),
    [accounts]
  );

  const getRecurringIncomeCategoryMeta = (income) => {
    const categoryId = income?.categoryId || "";
    const categoryName = income?.categoryName || income?.category || "";

    if (categoryId) {
      const byId = categories.find((category) => category.id === categoryId);
      if (byId) {
        return byId;
      }
    }

    return categories.find((category) => normalizeCategoryName(category?.name) === normalizeCategoryName(categoryName)) || null;
  };

  const filteredRecurringIncome = useMemo(() => {
    const needle = normalizeSearch(searchText);
    if (!needle) return recurringIncome;

    return recurringIncome.filter((item) => normalizeSearch([
      item.name,
      item.categoryName,
      item.category,
      accountMap.get(item.accountId),
    ].filter(Boolean).join(" ")).includes(needle));
  }, [accountMap, recurringIncome, searchText]);

  const summary = useMemo(() => {
    const active = recurringIncome.filter((item) => item.isActive !== false);
    const inactive = recurringIncome.length - active.length;
    const today = getTodayString();
    const monthlyTotal = active.reduce((sum, item) => {
      const amount = Number(getRecurringIncomeApplicableAmount(item, today) || 0);
      return sum + (item.frequency === "annuel" ? amount / 12 : amount);
    }, 0);

    return { activeCount: active.length, inactiveCount: inactive, monthlyTotal };
  }, [recurringIncome]);

  const handleSubmit = async (payload) => {
    if (editingIncome) {
      return updateRecurringIncome(editingIncome.id, payload);
    }

    return addRecurringIncome(payload);
  };

  const handleEdit = (income) => {
    setEditingIncome(income);
    setFormOpen(true);
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditingIncome(null);
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
        title="Revenus récurrents"
        countLabel={`${recurringIncome.length} revenu(x) · ${summary.activeCount} actif(s)`}
        searchValue={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Rechercher un revenu récurrent"
        onAdd={() => {
          setEditingIncome(null);
          setFormOpen(true);
        }}
      />

      {error && <Alert severity="error">{error}</Alert>}

      <PilotageSummary
        items={[
          { label: "Total mensuel prévu", value: formatCurrency(summary.monthlyTotal), color: PILOTAGE_COLORS.green },
          { label: "Actifs", value: summary.activeCount, color: PILOTAGE_COLORS.blue },
          { label: "Inactifs", value: summary.inactiveCount, color: PILOTAGE_COLORS.muted },
        ]}
      />

      <PilotageSection
        title="Liste principale"
        subtitle={`${filteredRecurringIncome.length} revenu(x) affiché(s)`}
      >
        {filteredRecurringIncome.length === 0 ? (
          <PilotageEmptyState>
            {recurringIncome.length === 0 ? "Aucun revenu récurrent pour le moment." : "Aucune correspondance de recherche."}
          </PilotageEmptyState>
        ) : (
          <Stack spacing={1}>
            {filteredRecurringIncome.map((income) => (
              <RecurringIncomeCard
                key={income.id}
                recurringIncome={income}
                onEdit={handleEdit}
                onDelete={deleteRecurringIncome}
                accounts={accounts}
                categoryMeta={getRecurringIncomeCategoryMeta(income)}
                enableDoubleClickEdit={enableDesktopDoubleClickEdit}
              />
            ))}
          </Stack>
        )}
      </PilotageSection>

      <RecurringIncomeForm
        open={formOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialIncome={editingIncome}
        accounts={accounts}
        categories={categories}
      />
    </PilotagePageShell>
  );
}

