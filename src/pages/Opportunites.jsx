import { useMemo, useRef, useState } from "react";
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography, useMediaQuery, useTheme } from "@mui/material";
import OpportunityCard from "../components/OpportunityCard";
import OpportunityForm from "../components/OpportunityForm";
import TransactionEditorDialog from "../components/TransactionEditorDialog";
import { useAccounts } from "../hooks/useAccounts";
import { useActivities } from "../hooks/useActivities";
import { useCategories } from "../hooks/useCategories";
import { useOpportunities } from "../hooks/useOpportunities";
import { useProjects } from "../hooks/useProjects";
import { useSubcategories } from "../hooks/useSubcategories";
import { useThirdParties } from "../hooks/useThirdParties";
import { useTransactions } from "../hooks/useTransactions";
import { buildTransactionPayload, validateTransactionForm } from "../utils/transactionDraftMapper";
import { validateTransactionReferencesForSave } from "../utils/transactionReferencesValidation";
import {
  buildOpportunityLinkedTransactionPayload,
  buildOpportunityTransactionDraft,
  createTransactionFromRealizedOpportunity,
  didOpportunityBecomeRealized,
} from "../services/opportunityTransactionLink";
import {
  PILOTAGE_COLORS,
  PilotageEmptyState,
  PilotageHeader,
  PilotagePageShell,
  PilotageSection,
  PilotageSummary,
} from "../components/PilotagePageLayout";

function getInitialTransactionForm() {
  return {
    date: new Date().toISOString().slice(0, 10),
    montant: "",
    categorie: "",
    categoryId: "",
    categoryName: "",
    description: "",
    type: "revenu",
    accountId: "",
    subcategoryId: "",
    subcategoryName: "",
    activityId: "",
    activityName: "",
    thirdPartyId: "",
    thirdPartyName: "",
    projectId: "",
    projectName: "",
    destinationAccountId: "",
    isFixedExpense: false,
    fixedExpenseId: "",
    opportunityId: "",
    opportunityName: "",
    opportunityNotes: "",
  };
}

function getUniqueCategoryOptions(categories = [], currentCategory = "", currentCategoryId = "") {
  const options = categories.filter((category) => category?.type === "revenu" && category?.isActive !== false);
  const hasCurrent = options.some((category) => category.id === currentCategoryId || category.name === currentCategory);
  return currentCategory && !hasCurrent
    ? [{ id: currentCategoryId || "", name: currentCategory }, ...options]
    : options;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function normalizeSearch(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isOpportunityIncluded(opportunity) {
  if (!opportunity || opportunity.isActive === false || opportunity.isDeleted === true) return false;
  const status = String(opportunity.status || "").trim().toLowerCase();
  if (["realise", "réalisé", "abandonne", "abandonné"].includes(status)) return false;
  return Number(opportunity.estimatedAmount || opportunity.amount || 0) > 0;
}

export default function Opportunites() {
  const theme = useTheme();
  const enableDesktopDoubleClickEdit = useMediaQuery(theme.breakpoints.up("md"));
  const {
    opportunities,
    loading,
    error,
    addOpportunity,
    updateOpportunity,
    toggleOpportunityActive,
    deleteOpportunity,
  } = useOpportunities({ includeInactive: true });
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { projects, addProject } = useProjects({ includeInactive: true });
  const { subcategories } = useSubcategories({ includeInactive: true });
  const { thirdParties, addThirdParty } = useThirdParties({ includeInactive: true });
  const { activities, addActivity } = useActivities({ includeInactive: true });
  const { transactions, updateTransaction } = useTransactions();
  const [formOpen, setFormOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState(null);
  const [message, setMessage] = useState("");
  const [proposalOpportunity, setProposalOpportunity] = useState(null);
  const [transactionEditorOpen, setTransactionEditorOpen] = useState(false);
  const [transactionForm, setTransactionForm] = useState(getInitialTransactionForm);
  const [transactionInitialForm, setTransactionInitialForm] = useState(getInitialTransactionForm);
  const [transactionEditorError, setTransactionEditorError] = useState("");
  const [editingLinkedTransaction, setEditingLinkedTransaction] = useState(null);
  const [submittingTransaction, setSubmittingTransaction] = useState(false);
  const [searchText, setSearchText] = useState("");
  const transactionSubmittingRef = useRef(false);

  const accountMap = useMemo(
    () => new Map((accounts || []).map((account) => [account.id, account.name || ""])),
    [accounts]
  );
  const transactionMap = useMemo(
    () => new Map((transactions || []).map((transaction) => [transaction.id, transaction])),
    [transactions]
  );
  const subcategoryMap = useMemo(
    () => new Map((subcategories || []).map((subcategory) => [subcategory.id, subcategory])),
    [subcategories]
  );
  const activityMap = useMemo(
    () => new Map((activities || []).map((activity) => [activity.id, activity])),
    [activities]
  );
  const thirdPartyMap = useMemo(
    () => new Map((thirdParties || []).map((thirdParty) => [thirdParty.id, thirdParty])),
    [thirdParties]
  );
  const projectMap = useMemo(
    () => new Map((projects || []).map((project) => [project.id, project])),
    [projects]
  );
  const activeSubcategories = useMemo(
    () => (subcategories || []).filter((subcategory) => subcategory.isActive !== false),
    [subcategories]
  );
  const activeActivities = useMemo(
    () => (activities || []).filter((activity) => activity.isActive !== false),
    [activities]
  );
  const activeThirdParties = useMemo(
    () => (thirdParties || []).filter((thirdParty) => thirdParty.isActive !== false),
    [thirdParties]
  );
  const activeProjects = useMemo(
    () => (projects || []).filter((project) => project.isActive !== false),
    [projects]
  );
  const transactionCategoryOptions = useMemo(
    () => getUniqueCategoryOptions(categories, transactionForm.categoryName || transactionForm.categorie, transactionForm.categoryId),
    [categories, transactionForm.categoryId, transactionForm.categoryName, transactionForm.categorie]
  );
  const transactionSubcategoryOptions = useMemo(
    () => activeSubcategories.filter((subcategory) => !transactionForm.categoryId || subcategory.categoryId === transactionForm.categoryId),
    [activeSubcategories, transactionForm.categoryId]
  );
  const prioritizedProjectOptions = useMemo(() => {
    return [...activeProjects].sort((left, right) => {
      const leftBoost = transactionForm.activityId && left.activityId === transactionForm.activityId ? -1 : 0;
      const rightBoost = transactionForm.activityId && right.activityId === transactionForm.activityId ? -1 : 0;
      if (leftBoost !== rightBoost) return leftBoost - rightBoost;
      return String(left.name || "").localeCompare(String(right.name || ""), "fr", { sensitivity: "base" });
    });
  }, [activeProjects, transactionForm.activityId]);

  const filteredOpportunities = useMemo(() => {
    const needle = normalizeSearch(searchText);
    if (!needle) return opportunities;

    return opportunities.filter((item) => normalizeSearch([
      item.name,
      item.categoryName,
      item.category,
      accountMap.get(item.accountId),
      item.thirdPartyName,
      item.activityName,
      item.projectName,
      item.status,
    ].filter(Boolean).join(" ")).includes(needle));
  }, [accountMap, opportunities, searchText]);

  const opportunitySummary = useMemo(() => {
    const included = opportunities.filter(isOpportunityIncluded);
    const total = included.reduce((sum, item) => sum + Number(item.estimatedAmount || item.amount || 0), 0);
    const realizedCount = opportunities.filter((item) => String(item.status || "").trim().toLowerCase() === "realise").length;
    const abandonedCount = opportunities.filter((item) => String(item.status || "").trim().toLowerCase() === "abandonne").length;

    return {
      includedCount: included.length,
      total,
      realizedCount,
      openCount: Math.max(0, opportunities.length - realizedCount - abandonedCount),
    };
  }, [opportunities]);

  function handleEdit(opportunity) {
    setEditingOpportunity(opportunity);
    setFormOpen(true);
  }

  function handleClose() {
    setFormOpen(false);
    setEditingOpportunity(null);
  }

  async function handleSubmit(payload) {
    const wasRealized = editingOpportunity;
    if (editingOpportunity) {
      const result = await updateOpportunity(editingOpportunity.id, payload);
      if (result.success && didOpportunityBecomeRealized(wasRealized, payload)) {
        setProposalOpportunity({ ...wasRealized, ...payload, id: wasRealized.id });
      }
      return result;
    }

    return addOpportunity(payload);
  }

  function openTransactionForOpportunity(opportunity) {
    const nextForm = {
      ...getInitialTransactionForm(),
      ...buildOpportunityTransactionDraft(opportunity, {
        categories,
        projects,
        thirdParties,
        activities,
      }, {
        defaultAccountId: accounts[0]?.id || "",
      }),
      opportunityName: opportunity.name || "",
    };

    setEditingLinkedTransaction(null);
    setTransactionForm(nextForm);
    setTransactionInitialForm(nextForm);
    setTransactionEditorError("");
    setTransactionEditorOpen(true);
  }

  function openExistingTransaction(transaction) {
    const nextForm = {
      ...getInitialTransactionForm(),
      date: transaction.date || getInitialTransactionForm().date,
      montant: String(transaction.montant ?? ""),
      categorie: transaction.categoryName || transaction.categorie || "",
      categoryId: transaction.categoryId || "",
      categoryName: transaction.categoryName || transaction.categorie || "",
      description: transaction.description || "",
      type: transaction.type || "revenu",
      accountId: transaction.accountId || accounts[0]?.id || "",
      subcategoryId: transaction.subcategoryId || "",
      subcategoryName: transaction.subcategoryName || "",
      activityId: transaction.activityId || "",
      activityName: transaction.activityName || "",
      thirdPartyId: transaction.thirdPartyId || "",
      thirdPartyName: transaction.thirdPartyName || "",
      projectId: transaction.projectId || "",
      projectName: transaction.projectName || "",
      opportunityId: transaction.opportunityId || "",
      opportunityName: transaction.opportunityName || "",
      opportunityNotes: transaction.opportunityNotes || "",
    };

    setEditingLinkedTransaction(transaction);
    setTransactionForm(nextForm);
    setTransactionInitialForm(nextForm);
    setTransactionEditorError("");
    setTransactionEditorOpen(true);
  }

  function closeTransactionEditor(force = false) {
    if (submittingTransaction && !force) return;
    setTransactionEditorOpen(false);
    setEditingLinkedTransaction(null);
    setTransactionForm(getInitialTransactionForm());
    setTransactionInitialForm(getInitialTransactionForm());
    setTransactionEditorError("");
  }

  function handleTransactionChange(event) {
    const { name, value, checked, type } = event.target;
    const nextValue = type === "checkbox" ? checked : value;

    setTransactionForm((previous) => {
      if (name === "categorie") {
        const category = categories.find((item) => item.id === value);
        return {
          ...previous,
          categorie: category?.name || value,
          categoryId: category?.id || "",
          categoryName: category?.name || value,
          subcategoryId: "",
          subcategoryName: "",
        };
      }

      if (name === "subcategoryId") {
        const subcategory = subcategoryMap.get(value);
        return {
          ...previous,
          subcategoryId: value,
          subcategoryName: subcategory?.name || "",
        };
      }

      if (name === "activityId") {
        const activity = activityMap.get(value);
        return {
          ...previous,
          activityId: value,
          activityName: activity?.name || "",
          projectId: previous.projectId && projectMap.get(previous.projectId)?.activityId === value ? previous.projectId : "",
          projectName: previous.projectId && projectMap.get(previous.projectId)?.activityId === value ? previous.projectName : "",
        };
      }

      if (name === "thirdPartyId") {
        const thirdParty = thirdPartyMap.get(value);
        return {
          ...previous,
          thirdPartyId: value,
          thirdPartyName: thirdParty?.name || "",
        };
      }

      if (name === "projectId") {
        const project = projectMap.get(value);
        return {
          ...previous,
          projectId: value,
          projectName: project?.name || "",
        };
      }

      return {
        ...previous,
        [name]: nextValue,
      };
    });
  }

  async function handleTransactionSubmit(event) {
    event.preventDefault();
    if (transactionSubmittingRef.current) return;

    const validationMessage = validateTransactionForm(transactionForm);
    if (validationMessage) {
      setTransactionEditorError(validationMessage);
      return;
    }

    const referenceValidationMessage = validateTransactionReferencesForSave(transactionForm, {
      subcategoryMap,
      activityMap,
      thirdPartyMap,
      projectMap,
    });
    if (referenceValidationMessage) {
      setTransactionEditorError(`${referenceValidationMessage} ❌`);
      return;
    }

    transactionSubmittingRef.current = true;
    setSubmittingTransaction(true);
    setTransactionEditorError("");

    try {
      const basePayload = {
        ...buildTransactionPayload(transactionForm, accounts[0]?.id || ""),
        subcategoryName: transactionForm.subcategoryName || subcategoryMap.get(transactionForm.subcategoryId || "")?.name || null,
        activityName: transactionForm.activityName || activityMap.get(transactionForm.activityId || "")?.name || null,
        thirdPartyName: transactionForm.thirdPartyName || thirdPartyMap.get(transactionForm.thirdPartyId || "")?.name || null,
        projectName: transactionForm.projectName || projectMap.get(transactionForm.projectId || "")?.name || null,
      };

      if (editingLinkedTransaction) {
        const result = await updateTransaction(editingLinkedTransaction.id, {
          ...basePayload,
          updatedAt: new Date().toISOString(),
        });
        if (!result.success) {
          setTransactionEditorError(result.error || "Erreur lors de la mise a jour ❌");
          return;
        }
        setMessage("Transaction liee mise a jour ✅");
      } else {
        const opportunity = opportunities.find((item) => item.id === transactionForm.opportunityId);
        if (!opportunity) {
          setTransactionEditorError("Opportunite introuvable ❌");
          return;
        }

        const result = await createTransactionFromRealizedOpportunity({
          opportunityId: opportunity.id,
          transactionPayload: buildOpportunityLinkedTransactionPayload(basePayload, opportunity),
        });
        if (result.status === "already_exists") {
          setTransactionEditorError("Transaction deja creee pour cette opportunite.");
          return;
        }
        setMessage("Transaction créée depuis l'opportunite ✅");
      }

      closeTransactionEditor(true);
    } catch (err) {
      setTransactionEditorError(err?.message || "Erreur lors de la creation de la transaction ❌");
    } finally {
      transactionSubmittingRef.current = false;
      setSubmittingTransaction(false);
    }
  }

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
        title="Opportunités"
        countLabel={`${opportunities.length} opportunité(s) · ${formatCurrency(opportunitySummary.total)} prévus`}
        searchValue={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Rechercher une opportunité"
        onAdd={() => {
          setEditingOpportunity(null);
          setFormOpen(true);
        }}
      />

      {error && (
        <Alert severity="error">
          {error}
        </Alert>
      )}
      {message && (
        <Alert severity="success">
          {message}
        </Alert>
      )}

      <PilotageSummary
        items={[
          { label: "Incluses dans la prévision", value: opportunitySummary.includedCount, color: PILOTAGE_COLORS.blue },
          { label: "Montant total prévu", value: formatCurrency(opportunitySummary.total), color: PILOTAGE_COLORS.green },
          { label: "Non réalisées", value: opportunitySummary.openCount, color: PILOTAGE_COLORS.orange },
        ]}
      />

      <PilotageSection
        title="Liste principale"
        subtitle={`${filteredOpportunities.length} opportunité(s) affichée(s)`}
      >
        {filteredOpportunities.length === 0 ? (
          <PilotageEmptyState>
            {opportunities.length === 0 ? "Aucune opportunité enregistrée pour le moment." : "Aucune correspondance de recherche."}
          </PilotageEmptyState>
        ) : (
          <Stack spacing={1}>
            {filteredOpportunities.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                accounts={accounts}
                projects={projects}
                onEdit={handleEdit}
                onToggleActive={toggleOpportunityActive}
                onDelete={deleteOpportunity}
                onCreateTransaction={openTransactionForOpportunity}
                onOpenTransaction={openExistingTransaction}
                linkedTransaction={transactionMap.get(opportunity.realizedTransactionId || "") || null}
                enableDoubleClickEdit={enableDesktopDoubleClickEdit}
              />
            ))}
          </Stack>
        )}
      </PilotageSection>

      <OpportunityForm
        open={formOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialOpportunity={editingOpportunity}
        accounts={accounts}
        categories={categories}
        projects={projects}
        thirdParties={thirdParties}
        activities={activities}
        onRequestCreateThirdParty={addThirdParty}
        onRequestCreateActivity={addActivity}
        onRequestCreateProject={addProject}
      />

      <Dialog open={Boolean(proposalOpportunity)} onClose={() => setProposalOpportunity(null)}>
        <DialogTitle>Opportunité réalisée</DialogTitle>
        <DialogContent>
          <Typography>
            Cette opportunité est désormais réalisée. Souhaitez-vous créer la transaction correspondante ?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProposalOpportunity(null)}>Plus tard</Button>
          <Button
            variant="contained"
            onClick={() => {
              const opportunity = proposalOpportunity;
              setProposalOpportunity(null);
              openTransactionForOpportunity(opportunity);
            }}
          >
            Créer la transaction
          </Button>
        </DialogActions>
      </Dialog>

      <TransactionEditorDialog
        open={transactionEditorOpen}
        title={editingLinkedTransaction ? "Ouvrir la transaction liée" : "Créer la transaction de revenu"}
        form={transactionForm}
        initialForm={transactionInitialForm}
        onChange={handleTransactionChange}
        onSubmit={handleTransactionSubmit}
        onClose={() => closeTransactionEditor()}
        submitLabel={editingLinkedTransaction ? "Enregistrer" : "Creer"}
        submitting={submittingTransaction}
        errorMessage={transactionEditorError}
        accounts={accounts}
        categoryOptions={transactionCategoryOptions}
        subcategoryOptions={transactionSubcategoryOptions}
        activities={activeActivities}
        thirdParties={activeThirdParties}
        projects={activeProjects}
        prioritizedProjectOptions={prioritizedProjectOptions}
        fixedExpenses={[]}
      />
    </PilotagePageShell>
  );
}
