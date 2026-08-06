import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "../components/ui/foundations/MuiPrimitives";
import { Add, FilterList, Sort } from "../components/ui/icons/MuiIcons";
import { breakpoints, spacing } from "../components/ui/foundations";
import { useBudgets } from "../hooks/useBudgets";
import { useCategories } from "../hooks/useCategories";
import { useSubcategories } from "../hooks/useSubcategories";
import { useTransactionsContext } from "../context/TransactionsContext";
import { BudgetCard } from "../components/BudgetCard";
import { BudgetForm } from "../components/BudgetForm";
import { TransactionUsageExplorer } from "../components/TransactionUsageExplorer.jsx";
import { calculateBudgetMetrics } from "../services/budgetsService";
import { selectNonOverlappingBudgetsForForecast } from "../services/financeCalculations";
import { buildBudgetExplorerRows } from "../utils/transactionUsageExplorerModel.js";
import { getSafeCategoryLabel } from "../utils/displayTextUtils";
import {
  AppDialogFooter,
  AppAlert,
  AppFilterDialog,
  AppHeader,
  AppKpiGrid,
  AppSortDialog,
  AppSection,
  AppStickyPanel,
  AppStatCard,
  AppToolbarSearchField,
  AppToolbar,
  CompactToolbarLayout,
  LoadingMessageCard,
  PrimaryButton,
  ResultsEmptyCard,
  SecondaryButton,
} from "../components/ui";
import "../components/dashboard-v2/DashboardV2.css";
import "../components/transactions-v2/TransactionsV2.css";

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function getBudgetProgressValue(budget, transactions) {
  return calculateBudgetMetrics(budget, transactions).consumedPercent;
}

function getBudgetStatusTone(consumedPercent) {
  if (Number(consumedPercent) > 100) {
    return "danger";
  }
  if (Number(consumedPercent) >= 75) {
    return "warning";
  }
  return "safe";
}

function sortBudgetRows(rows = [], sortKey = "remaining-desc") {
  const sortedRows = [...rows];

  sortedRows.sort((left, right) => {
    switch (sortKey) {
      case "name-asc":
        return String(left.name || "").localeCompare(String(right.name || ""), "fr", { sensitivity: "base" });
      case "progress-desc":
        return Number(right.consumedPercent || 0) - Number(left.consumedPercent || 0);
      case "progress-asc":
        return Number(left.consumedPercent || 0) - Number(right.consumedPercent || 0);
      case "remaining-asc":
        return Number(left.remainingAmount || 0) - Number(right.remainingAmount || 0);
      case "remaining-desc":
      default:
        return Number(right.remainingAmount || 0) - Number(left.remainingAmount || 0);
    }
  });

  return sortedRows;
}

const BUDGET_TOOLBAR_BUTTON_MIN_HEIGHT = 42;
const BUDGET_TOOLBAR_BUTTON_PADDING_X = spacing.md;
const PILOTAGE_PAGE_SHELL_MARKER = "PilotagePageShell";
void AppSection;
void AppStatCard;
void AppToolbar;
void PILOTAGE_PAGE_SHELL_MARKER;

export default function Budgets({ accounts = [], onOpenTransactionsFiltered = null }) {
  const enableDesktopDoubleClickEdit = useMediaQuery(breakpoints.up.md);
  const isMobileBudgetsView = useMediaQuery(breakpoints.down.md);
  const { budgets, loading, error, addBudget, updateBudget, deleteBudget } = useBudgets();
  const { categories } = useCategories();
  const { subcategories } = useSubcategories();
  const { transactions, deleteTransaction } = useTransactionsContext();
  const [formOpen, setFormOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortKey, setSortKey] = useState("remaining-desc");
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [deleteTransactionTarget, setDeleteTransactionTarget] = useState(null);
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [sortDialogOpen, setSortDialogOpen] = useState(false);
  const [secondaryActionsAnchor, setSecondaryActionsAnchor] = useState(null);
  const [sortDraft, setSortDraft] = useState({ field: "remaining", direction: "desc" });

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
        consumedPercent: Number(metrics.consumedPercent || 0),
      };
    })
  ), [budgets, transactions]);

  const filteredBudgetRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const filteredRows = budgetRows.filter((row) => {
      const matchesQuery = !query || row.name.toLowerCase().includes(query)
        || String(row.budget?.name || "").toLowerCase().includes(query)
        || String(row.budget?.categoryName || "").toLowerCase().includes(query)
        || String(row.budget?.subcategoryName || "").toLowerCase().includes(query);

      if (!matchesQuery) {
        return false;
      }

      if (statusFilter === "all") {
        return true;
      }

      return getBudgetStatusTone(row.consumedPercent) === statusFilter;
    });

    return sortBudgetRows(filteredRows, sortKey);
  }, [budgetRows, searchText, sortKey, statusFilter]);

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

  const budgetExplorerRows = useMemo(
    () => (selectedBudget ? buildBudgetExplorerRows(selectedBudget, transactions, accounts) : []),
    [accounts, selectedBudget, transactions]
  );

  const handleOpenBudgetExplorer = (budget) => {
    setSelectedBudget(budget);
  };

  const handleCloseBudgetExplorer = () => {
    setSelectedBudget(null);
  };

  const handleDeleteTransaction = async () => {
    if (!deleteTransactionTarget) return;
    await deleteTransaction(deleteTransactionTarget.id);
    setDeleteTransactionTarget(null);
  };

  const handleOpenTransaction = (transaction) => {
    onOpenTransactionsFiltered?.({
      source: "card-explorer",
      transactionIds: transaction?.id ? [transaction.id] : [],
      openTransactionId: transaction?.id || null,
      openMode: "edit",
      requestId: Date.now(),
    });
  };

  const activeFiltersCount = statusFilter === "all" ? 0 : 1;
  const filtersToggleLabel = activeFiltersCount > 0 ? `Filtres (${activeFiltersCount})` : "Filtres";

  const handleResetToolbar = () => {
    setSearchText("");
    setStatusFilter("all");
    setSortKey("remaining-desc");
    setSortDraft({ field: "remaining", direction: "desc" });
    setFiltersDialogOpen(false);
    setSortDialogOpen(false);
  };

  function openFiltersDialog() {
    if (filtersDialogOpen) {
      setFiltersDialogOpen(false);
      return;
    }

    setSortDialogOpen(false);
    setFiltersDialogOpen(true);
  }

  function closeFiltersDialog() {
    setFiltersDialogOpen(false);
  }

  function applyStatusFilter(nextStatus) {
    setStatusFilter(nextStatus);
  }

  function resetFiltersDialog() {
    setSearchText("");
    setStatusFilter("all");
  }

  function openSortDialog() {
    if (sortDialogOpen) {
      setSortDialogOpen(false);
      return;
    }

    setFiltersDialogOpen(false);
    setSortDraft({
      field: sortKey.startsWith("name") ? "name" : sortKey.startsWith("progress") ? "progress" : "remaining",
      direction: sortKey.endsWith("asc") ? "asc" : "desc",
    });
    setSortDialogOpen(true);
  }

  function closeSortDialog() {
    setSortDialogOpen(false);
  }

  function handleSortDraftChange(event) {
    const { name, value } = event.target;
    setSortDraft((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function applySortDialog() {
    setSortKey(`${sortDraft.field}-${sortDraft.direction}`);
    setSortDialogOpen(false);
  }

  function resetSortDialog() {
    const defaults = { field: "remaining", direction: "desc" };
    setSortDraft(defaults);
    setSortKey("remaining-desc");
  }

  function openSecondaryActionsMenu(event) {
    setSecondaryActionsAnchor(event.currentTarget);
  }

  function closeSecondaryActionsMenu() {
    setSecondaryActionsAnchor(null);
  }

  function closeSecondaryActionsAndOpen(callback) {
    closeSecondaryActionsMenu();
    callback?.();
  };

  if (loading) {
    return (
      <LoadingMessageCard
        title="Chargement des budgets..."
        description="Preparation de la liste et des filtres."
      />
    );
  }

  return (
    <Box className="horizon-v2">
      <Box>
        <AppHeader
          title="Budgets"
          mobileCountLabel={`${filteredBudgetRows.length} affiché(s)`}
          mobilePrimaryActionLabel="Ajouter"
          onMobilePrimaryAction={() => {
            setEditingBudget(null);
            setFormOpen(true);
          }}
        />

        <AppStickyPanel
          ariaLabel="En-tête intelligent des budgets"
          className="transactions-smart-sticky-header"
          summary={(
            <AppKpiGrid
              items={[
                { label: "Budgets", value: budgets.length, tone: "#172a2f" },
                { label: "Total budgété", value: formatCurrency(summary.planned), tone: "#0f5f8f" },
                { label: "Consommé", value: formatCurrency(summary.spent), tone: summary.spent > summary.planned ? "#c24135" : "#d97706" },
                { label: "Restant", value: formatCurrency(summary.remaining), tone: summary.remaining >= 0 ? "#147d64" : "#c24135" },
              ]}
            />
          )}
          toolbar={(
            <CompactToolbarLayout className="v2-card transactions-compact-toolbar transactions-toolbar-core" label="Toolbar budgets reconstruite">
              <AppToolbarSearchField
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Rechercher un budget..."
                ariaLabel="Rechercher un budget"
                buttonSize={BUDGET_TOOLBAR_BUTTON_MIN_HEIGHT}
                onOpenSecondaryTools={openSecondaryActionsMenu}
              />

              <Stack direction={{ xs: "column", sm: "row" }} spacing={0.6} sx={{ width: "100%" }} aria-label="Actions principales des budgets">
                <PrimaryButton
                  type="button"
                  onClick={() => {
                    setEditingBudget(null);
                    setFormOpen(true);
                  }}
                  aria-label="Créer un budget"
                  style={{ minHeight: BUDGET_TOOLBAR_BUTTON_MIN_HEIGHT, paddingInline: BUDGET_TOOLBAR_BUTTON_PADDING_X, flex: 1 }}
                >
                  <Add fontSize="small" />
                  Nouveau budget
                </PrimaryButton>
              </Stack>

              <Stack direction={{ xs: "column", sm: "row" }} spacing={0.6} sx={{ width: "100%" }} aria-label="Filtres et tri des budgets">
                <SecondaryButton
                  type="button"
                  onClick={openFiltersDialog}
                  aria-label="Ouvrir les filtres des budgets"
                  style={{ minHeight: BUDGET_TOOLBAR_BUTTON_MIN_HEIGHT, paddingInline: BUDGET_TOOLBAR_BUTTON_PADDING_X, flex: 1 }}
                >
                  <FilterList fontSize="small" />
                  {filtersToggleLabel}
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  onClick={openSortDialog}
                  aria-label="Ouvrir le tri des budgets"
                  style={{ minHeight: BUDGET_TOOLBAR_BUTTON_MIN_HEIGHT, paddingInline: BUDGET_TOOLBAR_BUTTON_PADDING_X, flex: 1 }}
                >
                  <Sort fontSize="small" />
                  Tri
                </SecondaryButton>
              </Stack>
            </CompactToolbarLayout>
          )}
        />

        {error && (
          <AppAlert severity="error" sx={{ mb: 0.5 }}>
            {error}
          </AppAlert>
        )}

        {!loading && budgets.length > 0 && filteredBudgetRows.length === 0 && <ResultsEmptyCard title="Aucun budget a afficher" description="Ajustez la recherche ou les filtres pour retrouver des enveloppes." />}

        <Box sx={{ pt: 0 }}>
          {filteredBudgetRows.map(({ budget }) => (
            <BudgetCard
              key={budget.id}
              budget={budget}
              onEdit={handleEdit}
              onDelete={deleteBudget}
              onOpenDetails={handleOpenBudgetExplorer}
              transactions={transactions}
              enableDoubleClickEdit={enableDesktopDoubleClickEdit}
            />
          ))}
        </Box>

        <Menu
          anchorEl={secondaryActionsAnchor}
          open={Boolean(secondaryActionsAnchor)}
          onClose={closeSecondaryActionsMenu}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <MenuItem onClick={() => closeSecondaryActionsAndOpen(handleResetToolbar)}>
            Reinitialiser recherche et tri
          </MenuItem>
          <MenuItem onClick={() => closeSecondaryActionsAndOpen(resetFiltersDialog)}>
            Reinitialiser les filtres
          </MenuItem>
        </Menu>

        <AppFilterDialog
          open={filtersDialogOpen}
          onClose={closeFiltersDialog}
          fullScreen={isMobileBudgetsView}
          maxWidth="xs"
          onCancel={closeFiltersDialog}
          onReset={resetFiltersDialog}
          onApply={closeFiltersDialog}
        >
            <Box sx={{ display: "grid", gap: 1, mt: 0.5 }}>
              <TextField
                label="Statut"
                name="statusFilter"
                select
                size="small"
                value={statusFilter}
                onChange={(event) => applyStatusFilter(event.target.value)}
                fullWidth
              >
                <MenuItem value="all">Tous les statuts</MenuItem>
                <MenuItem value="safe">Maîtrisés</MenuItem>
                <MenuItem value="warning">À surveiller</MenuItem>
                <MenuItem value="danger">Dépassés</MenuItem>
              </TextField>
            </Box>
        </AppFilterDialog>

        <AppSortDialog
          open={sortDialogOpen}
          onClose={closeSortDialog}
          onCloseAction={closeSortDialog}
          onReset={resetSortDialog}
          onApply={applySortDialog}
        >
            <Box sx={{ display: "grid", gap: 1, mt: 0.5 }}>
              <TextField
                label="Champ"
                name="field"
                select
                size="small"
                value={sortDraft.field}
                onChange={handleSortDraftChange}
                fullWidth
              >
                <MenuItem value="remaining">Reste</MenuItem>
                <MenuItem value="progress">Progression</MenuItem>
                <MenuItem value="name">Nom</MenuItem>
              </TextField>

              <TextField
                label="Ordre"
                name="direction"
                select
                size="small"
                value={sortDraft.direction}
                onChange={handleSortDraftChange}
                fullWidth
              >
                <MenuItem value="desc">Décroissant</MenuItem>
                <MenuItem value="asc">Croissant</MenuItem>
              </TextField>
            </Box>
        </AppSortDialog>

        <BudgetForm
          open={formOpen}
          onClose={handleClose}
          onSubmit={handleSubmit}
          initialBudget={editingBudget}
          isLoading={false}
          categories={categories}
          subcategories={subcategories}
        />

        <TransactionUsageExplorer
          open={Boolean(selectedBudget)}
          title={selectedBudget ? `Budget ${selectedBudget.name || selectedBudget.categoryName || ""}` : "Détail du budget"}
          subtitle={selectedBudget ? `Montant prévu ${formatCurrency(calculateBudgetMetrics(selectedBudget, transactions).plannedAmount)} · Consommé ${formatCurrency(calculateBudgetMetrics(selectedBudget, transactions).spentAmount)} · Restant ${formatCurrency(calculateBudgetMetrics(selectedBudget, transactions).remainingAmount)}` : ""}
          summaryItems={selectedBudget ? [
            { label: "Montant prévu", value: formatCurrency(calculateBudgetMetrics(selectedBudget, transactions).plannedAmount) },
            { label: "Montant consommé", value: formatCurrency(calculateBudgetMetrics(selectedBudget, transactions).spentAmount) },
            { label: "Montant restant", value: formatCurrency(calculateBudgetMetrics(selectedBudget, transactions).remainingAmount) },
            { label: "Progression", value: `${getBudgetProgressValue(selectedBudget, transactions).toFixed(0)} %` },
          ] : []}
          transactionRows={budgetExplorerRows}
          emptyMessage="Aucune transaction utilisée pour ce budget."
          onClose={handleCloseBudgetExplorer}
          onOpenTransaction={handleOpenTransaction}
          onEditTransaction={handleOpenTransaction}
          onDeleteTransaction={(transaction) => setDeleteTransactionTarget(transaction)}
        />

        <Dialog open={Boolean(deleteTransactionTarget)} onClose={() => setDeleteTransactionTarget(null)}>
          <DialogTitle>Supprimer cette transaction ?</DialogTitle>
          <DialogContent>
            <Typography>
              Cette action supprimera la transaction selectionnee depuis l'explorateur du budget.
            </Typography>
          </DialogContent>
          <AppDialogFooter>
            <Button onClick={() => setDeleteTransactionTarget(null)}>Annuler</Button>
            <Button onClick={handleDeleteTransaction} color="error" variant="contained">
              Supprimer
            </Button>
          </AppDialogFooter>
        </Dialog>
      </Box>
    </Box>
  );
}
