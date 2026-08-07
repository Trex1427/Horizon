import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Divider,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Menu,
  MenuItem,
  TextField,
  Typography,
  Stack,
  useMediaQuery,
} from "../components/ui/foundations/MuiPrimitives";
import {
  Add,
  CheckBoxOutlined,
  Close,
  Delete,
  Edit,
  FilterList,
  Label,
  LinkIcon,
  Sort,
} from "../components/ui/icons/MuiIcons";
import { useTransactions } from "../hooks/useTransactions";
import { useTransfers } from "../hooks/useTransfers";
import { useAccounts } from "../hooks/useAccounts";
import { useCategories } from "../hooks/useCategories";
import { useSubcategories } from "../hooks/useSubcategories";
import { useActivities } from "../hooks/useActivities";
import { useThirdParties } from "../hooks/useThirdParties";
import { useProjects } from "../hooks/useProjects";
import { useWorkProjects } from "../hooks/useWorkProjects.js";
import { useVehicles } from "../hooks/useVehicles.js";
import { CREATE_VEHICLE_VALUE } from "../constants/transactionVehicleReference.js";
import VehicleFormDialog from "../components/VehicleFormDialog.jsx";
import { sortVehicles } from "../services/vehicleModel.js";
import { useFixedExpenses } from "../hooks/useFixedExpenses";
import { getCategoryOptions } from "../constants/transactionCategories";
import TransactionCard from "../components/TransactionCard";
import TransactionEditorDialog from "../components/TransactionEditorDialog";
import TransactionBulkEditDialog from "../components/TransactionBulkEditDialog";
import SimilarClassificationDialog from "../components/SimilarClassificationDialog";
import TransactionReceiptUploader from "../components/TransactionReceiptUploader";
import TransactionDraftReviewDialog from "../components/TransactionDraftReviewDialog";
import EntityDialog from "../components/EntityDialog";
import { CategoryForm } from "../components/CategoryForm";
import BankingImportWizard from "../features/bankingImport/components/BankingImportWizard";
import ImportHistorySection from "../features/bankingImport/components/ImportHistorySection";
import TransferForm from "../features/transfers/components/TransferForm";
import { createTransfer, deleteTransfer as deleteTransferById, updateTransfer as updateTransferById } from "../features/transfers/services/transfersService";
import { bulkDeleteTransactions, bulkUpdateTransactions } from "../services/transactionBulkUpdateService";
import { associateTransactionsWithFixedExpense } from "../services/transactionFixedExpenseAssociationService";
import { RECEIPT_INTELLIGENCE_DEFAULTS } from "../utils/receiptDraftIntelligence";
import { buildTransactionPayload, validateTransactionForm } from "../utils/transactionDraftMapper";
import {
  CREATE_ACCOUNT_VALUE,
  CREATE_ACTIVITY_VALUE,
  CREATE_CATEGORY_VALUE,
  CREATE_PROJECT_VALUE,
  CREATE_SUBCATEGORY_VALUE,
  CREATE_THIRD_PARTY_VALUE,
} from "../constants/transactionReferenceCreateValues";
import { CREATE_FIXED_EXPENSE_VALUE } from "../constants/transactionFixedExpenseReference";
import { buildIncomeExpenseTrendData } from "../utils/chartDataUtils";
import IncomeExpenseTrendChart from "../components/charts/IncomeExpenseTrendChart";
import { buildVoiceDraftForm, parseVoiceTransactionDraft } from "../services/voiceTransactionParser";
import { ACTIVITY_KIND_OPTIONS, THIRD_PARTY_TYPE_OPTIONS } from "../constants/referenceCatalog";
import {
  getSpeechRecognitionConstructor,
  isSpeechRecognitionAvailable,
  mapSpeechRecognitionError,
} from "../services/speechRecognitionService";
import {
  applyTransactionsNavigationContext,
  filterTransactionsForView,
  getDefaultTransactionSortPreferences,
  getDefaultTransactionsListFilters,
  sortTransactionsForView,
} from "../utils/analysisInteractionUtils";
import { parseTransactionSortPreferences } from "../utils/transactionSortPreferences";
import { getLegacyTransactionType, normalizeTransactionType } from "../utils/transactionTypeUtils";
import { buildLegacyReclassificationPayload } from "../utils/legacyTransactionReview";
import { getSafeCategoryLabel, isTechnicalCategoryDisplayValue } from "../utils/displayTextUtils";
import { validateTransactionReferencesForSave } from "../utils/transactionReferencesValidation";
import { resolveTransactionCategoryMeta } from "../utils/transactionCategoryDisplay";
import {
  resolveVisibleSelectedTransactionIds,
  resolveVisibleSelectedTransactions,
} from "../utils/transactionSelection";
import {
  applyFixedExpenseToTransactionForm,
  buildQuickFixedExpensePayload,
  findMatchingFixedExpenseForTransaction,
} from "../utils/transactionFixedExpenseLinking";
import { buildFixedExpenseDraftFromTransactions } from "../utils/fixedExpenseDraftFromTransactions";
import { TRANSACTION_EDITOR_FOCUS_TARGETS } from "../constants/transactionEditorFocusTargets";
import {
  buildChangedClassificationPatch,
  buildTransactionClassificationSuggestion,
  findSimilarTransactions,
} from "../utils/similarTransactionClassification";
import {
  AppFilterDialog,
  AppAlert,
  AppHeader,
  AppKpiGrid,
  AppSortDialog,
  AppStickyPanel,
  AppToolbarSearchField,
  ActionBar,
  CompactToolbarLayout,
  DangerButton,
  LoadingMessageCard,
  PrimaryButton,
  ResultsEmptyCard,
  SecondaryButton,
} from "../components/ui";
import { breakpoints, colors, radius, spacing, transitions } from "../components/ui/foundations";
const TRANSACTION_PERIOD_LABELS = {
  currentMonth: "Mois courant",
  previousMonth: "Mois précédent",
  currentYear: "Année en cours",
};

function applyTransactionSearch(transactions = [], searchText = "", getAccountLabel = null) {
  const normalizedSearch = String(searchText || "").trim().toLowerCase();
  if (!normalizedSearch) {
    return [...transactions];
  }

  return transactions.filter((transaction) => {
    const searchableFields = [
      transaction.description,
      transaction.categoryName,
      transaction.categorie,
      transaction.category,
      transaction.accountName,
      transaction.accountId,
      typeof getAccountLabel === "function" ? getAccountLabel(transaction.accountId || "") : "",
      transaction.type,
      transaction.subcategoryName,
      transaction.activityName,
      transaction.thirdPartyName,
      transaction.projectName,
    ];

    return searchableFields
      .map((value) => String(value || "").trim().toLowerCase())
      .some((value) => value.includes(normalizedSearch));
  });
}

function formatSummaryAmount(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function buildTransactionsSummary(transactions = []) {
  return transactions.reduce((summary, transaction) => {
    const amount = Math.abs(Number(transaction?.montant ?? transaction?.amount ?? 0));
    const normalizedType = normalizeTransactionType(transaction?.type);

    if (normalizedType === "depense") {
      return {
        ...summary,
        expenses: summary.expenses + amount,
        net: summary.net - amount,
      };
    }

    if (normalizedType === "revenu") {
      return {
        ...summary,
        revenues: summary.revenues + amount,
        net: summary.net + amount,
      };
    }

    return summary;
  }, {
    count: transactions.length,
    expenses: 0,
    revenues: 0,
    net: 0,
  });
}

function getInitialForm() {
  return {
    date: new Date().toISOString().slice(0, 10),
    montant: "",
    categorie: "",
    categoryId: "",
    categoryName: "",
    description: "",
    type: "depense",
    accountId: "",
    subcategoryId: "",
    subcategoryName: "",
    activityId: "",
    activityName: "",
    thirdPartyId: "",
    thirdPartyName: "",
    projectId: "",
    projectName: "",
    workProjectId: "",
    vehicleId: "",
    destinationAccountId: "",
    isFixedExpense: false,
    fixedExpenseId: "",
    ...RECEIPT_INTELLIGENCE_DEFAULTS,
  };
}

function normalizeCategoryName(value) {
  return (value || "").trim().toLowerCase();
}

function getCurrentScrollY() {
  if (typeof window === "undefined") {
    return 0;
  }

  return window.scrollY;
}

function resolveTransactionEditorFocusTarget(focusTarget = "") {
  return Object.values(TRANSACTION_EDITOR_FOCUS_TARGETS).includes(focusTarget) ? focusTarget : "";
}

function countActiveListFilters(filters = {}, defaults = {}) {
  const keys = ["period", "type", "accountId", "categoryId", "categoryName", "subcategoryId", "activityId", "thirdPartyId", "projectId"];

  return keys.reduce((count, key) => {
    if (key === "categoryName" && filters.categoryId !== "all") {
      return count;
    }

    const current = filters?.[key];
    const baseline = defaults?.[key];

    return current !== baseline ? count + 1 : count;
  }, 0);
}

function getCategoryFilterValue(filters = {}) {
  if (filters.categoryId !== "all") {
    return `id:${filters.categoryId}`;
  }

  if (filters.categoryName !== "all") {
    return `name:${filters.categoryName}`;
  }

  return "all";
}

function getUniqueCategoryOptions(options = [], currentCategory = "", currentCategoryId = "") {
  const deduped = [];
  const seen = new Set();

  options.forEach((option) => {
    if (!option?.name) {
      return;
    }

    const key = normalizeCategoryName(option.name);
    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);
    deduped.push(option);
  });

  const hasCurrent = deduped.some(
    (option) => option.id === currentCategoryId || normalizeCategoryName(option.name) === normalizeCategoryName(currentCategory)
  );

  if (currentCategory && !hasCurrent) {
    return [
      {
        id: currentCategoryId || "",
        name: currentCategory,
      },
      ...deduped,
    ];
  }

  return deduped;
}

const TRANSACTIONS_SORT_PREFERENCES_STORAGE_KEY = "horizon.transactions.sort.preferences.v1";

export default function Transactions({
  openReceiptImportRequestId = 0,
  openBankImportRequestId = 0,
  navigationContext = null,
  onNavigationContextApplied,
}) {
  const enableDesktopDoubleClickEdit = useMediaQuery(breakpoints.up.md);
  const isMobileTransactionsView = useMediaQuery(breakpoints.down.sm);
  const [form, setForm] = useState(getInitialForm);
  const [transactionEditorInitialForm, setTransactionEditorInitialForm] = useState(getInitialForm);
  const [transactionEditorScrollRestorePosition, setTransactionEditorScrollRestorePosition] = useState(0);
  const [transactionEditorFocusTarget, setTransactionEditorFocusTarget] = useState("");
  const [transactionEditorError, setTransactionEditorError] = useState("");
  const [ignoredClassificationSuggestionKey, setIgnoredClassificationSuggestionKey] = useState("");
  const [appliedClassificationSuggestionKey, setAppliedClassificationSuggestionKey] = useState("");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [transactionEditorOpen, setTransactionEditorOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [transactionToDelete, setTransactionToDelete] = useState(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [actionMenuTransaction, setActionMenuTransaction] = useState(null);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [draftTransactionForm, setDraftTransactionForm] = useState(null);
  const [isCreatingFromDraft, setIsCreatingFromDraft] = useState(false);
  const [bankImportOpen, setBankImportOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState(null);
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [legacyTransferSource, setLegacyTransferSource] = useState(null);
  const [trendPeriod, setTrendPeriod] = useState("currentYear");
  const [listFilters, setListFilters] = useState(getDefaultTransactionsListFilters);
  const [sortPreferences, setSortPreferences] = useState(getDefaultTransactionSortPreferences);
  const [voiceStatus, setVoiceStatus] = useState("idle");
  const [voiceMessage, setVoiceMessage] = useState("");
  const [, setVoiceTranscript] = useState("");
  const [filtersDialogOpen, setFiltersDialogOpen] = useState(false);
  const [sortDialogOpen, setSortDialogOpen] = useState(false);
  const [filtersDraft, setFiltersDraft] = useState(getDefaultTransactionsListFilters);
  const [sortDraft, setSortDraft] = useState(getDefaultTransactionSortPreferences);
  const [quickCategoryOpen, setQuickCategoryOpen] = useState(false);
  const [quickCategoryDraft, setQuickCategoryDraft] = useState(null);
  const [quickThirdPartyOpen, setQuickThirdPartyOpen] = useState(false);
  const [quickThirdPartyForm, setQuickThirdPartyForm] = useState({ name: "", type: "supplier", notes: "" });
  const [quickThirdPartyError, setQuickThirdPartyError] = useState("");
  const [quickSubcategoryOpen, setQuickSubcategoryOpen] = useState(false);
  const [quickSubcategoryForm, setQuickSubcategoryForm] = useState({ name: "", categoryId: "", type: "depense" });
  const [quickSubcategoryError, setQuickSubcategoryError] = useState("");
  const [quickAccountOpen, setQuickAccountOpen] = useState(false);
  const [quickAccountForm, setQuickAccountForm] = useState({ name: "", type: "standard", icon: "", color: "#1976d2", initialBalance: "0", displayOrder: "0" });
  const [quickAccountError, setQuickAccountError] = useState("");
  const [quickAccountSubmitting, setQuickAccountSubmitting] = useState(false);
  const quickAccountSubmittingRef = useRef(false);
  const [quickActivityOpen, setQuickActivityOpen] = useState(false);
  const [quickActivityForm, setQuickActivityForm] = useState({ name: "", kind: "profit_center" });
  const [quickActivityError, setQuickActivityError] = useState("");
  const [quickProjectOpen, setQuickProjectOpen] = useState(false);
  const [quickProjectForm, setQuickProjectForm] = useState({ name: "", activityId: "", startDate: "", endDate: "", notes: "" });
  const [quickProjectError, setQuickProjectError] = useState("");
  const [quickFixedExpenseOpen, setQuickFixedExpenseOpen] = useState(false);
  const [quickFixedExpenseSourceForm, setQuickFixedExpenseSourceForm] = useState(getInitialForm);
  const [quickFixedExpenseSourceTransactionIds, setQuickFixedExpenseSourceTransactionIds] = useState([]);
  const [quickFixedExpenseApplyClassificationToSource, setQuickFixedExpenseApplyClassificationToSource] = useState(true);
  const [quickVehicleOpen, setQuickVehicleOpen] = useState(false);
  const [quickFixedExpenseForm, setQuickFixedExpenseForm] = useState({ name: "", frequency: "monthly", startDate: "", endDate: "", description: "" });
  const [quickFixedExpenseAutoFocusSelector, setQuickFixedExpenseAutoFocusSelector] = useState('input[name="quick-fixed-expense-name"]');
  const [quickFixedExpenseError, setQuickFixedExpenseError] = useState("");
  const [quickFixedExpenseSubmitting, setQuickFixedExpenseSubmitting] = useState(false);
  const quickFixedExpenseSubmittingRef = useRef(false);
  const quickFixedExpenseCreateResolverRef = useRef(null);
  const importQuickCreateRef = useRef(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [bulkEditMode, setBulkEditMode] = useState("advanced");
  const [selectedTransactionIds, setSelectedTransactionIds] = useState([]);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  const [similarClassificationSuggestion, setSimilarClassificationSuggestion] = useState(null);
  const [similarClassificationLoading, setSimilarClassificationLoading] = useState(false);
  const similarClassificationSubmittingRef = useRef(false);
  const [secondaryActionsAnchor, setSecondaryActionsAnchor] = useState(null);
  const [periodMenuAnchor, setPeriodMenuAnchor] = useState(null);
  const [receiptUploaderDialogOpen, setReceiptUploaderDialogOpen] = useState(false);
  const [importHistoryDialogOpen, setImportHistoryDialogOpen] = useState(false);
  const [transfersDialogOpen, setTransfersDialogOpen] = useState(false);
  const [legacyReviewDialogOpen, setLegacyReviewDialogOpen] = useState(false);
  const [smartHeaderCollapseProgress, setSmartHeaderCollapseProgress] = useState(0);
  const recognitionRef = useRef(null);
  const transcriptCapturedRef = useRef(false);
  const transactionEditorScrollRestoreTimeoutRef = useRef(null);
  const { transactions, loading, error, addTransaction, updateTransaction, deleteTransaction } = useTransactions();
  const { transfers = [], loading: transfersLoading } = useTransfers();
  const { accounts, defaultAccount, addAccount } = useAccounts();
  const { categories = [], addCategory } = useCategories();
  const { subcategories = [], addSubcategory } = useSubcategories({ includeInactive: true });
  const { activities = [], addActivity } = useActivities({ includeInactive: true });
  const { thirdParties = [], addThirdParty } = useThirdParties({ includeInactive: true });
  const { projects = [], addProject } = useProjects({ includeInactive: true });
  const { projects: workProjects = [] } = useWorkProjects();
  const { vehicles = [], addVehicle } = useVehicles({ includeDeleted: true });
  const { fixedExpenses = [], addFixedExpense } = useFixedExpenses();
  const voiceParserCategories = useMemo(
    () => categories
      .filter((category) => String(category?.id || "").trim())
      .map((category) => ({ id: String(category.id).trim(), name: category.name, type: category.type })),
    [categories]
  );
  const receiptAvailableCategories = categories.length
    ? categories.map((category) => ({ id: category.id, name: category.name, type: category.type }))
    : [
        ...getCategoryOptions("depense").map((name) => ({ id: "", name, type: "depense" })),
        ...getCategoryOptions("revenu").map((name) => ({ id: "", name, type: "revenu" })),
      ];

  const getAccountLabel = (accountId) => {
    if (!accountId) {
      return "Compte courant";
    }

    return accounts.find((account) => account.id === accountId)?.name || "Compte inconnu";
  };

  function buildClassificationSuggestionFormPatch(patch = {}) {
    const category = categories.find((item) => item.id === patch.categoryId);
    const subcategory = subcategoryMap.get(patch.subcategoryId || "");
    const thirdParty = thirdPartyMap.get(patch.thirdPartyId || "");
    const activity = activityMap.get(patch.activityId || "");
    const project = projectMap.get(patch.projectId || "");

    return {
      ...(patch.categoryId ? {
        categoryId: patch.categoryId,
        categoryName: category?.name || "",
        categorie: category?.name || "",
      } : {}),
      ...(patch.subcategoryId ? {
        subcategoryId: patch.subcategoryId,
        subcategoryName: subcategory?.name || "",
      } : {}),
      ...(patch.thirdPartyId ? {
        thirdPartyId: patch.thirdPartyId,
        thirdPartyName: thirdParty?.name || "",
      } : {}),
      ...(patch.activityId ? {
        activityId: patch.activityId,
        activityName: activity?.name || "",
      } : {}),
      ...(patch.projectId ? {
        projectId: patch.projectId,
        projectName: project?.name || "",
      } : {}),
      ...(patch.accountId ? { accountId: patch.accountId } : {}),
    };
  }

  function scheduleTransactionEditorScrollRestore(nextScrollPosition = transactionEditorScrollRestorePosition) {
    if (typeof window === "undefined") {
      return;
    }

    if (transactionEditorScrollRestoreTimeoutRef.current !== null) {
      window.clearTimeout(transactionEditorScrollRestoreTimeoutRef.current);
    }

    transactionEditorScrollRestoreTimeoutRef.current = window.setTimeout(() => {
      window.scrollTo({ top: nextScrollPosition, behavior: "auto" });
      transactionEditorScrollRestoreTimeoutRef.current = null;
    }, 300);
  }

  useEffect(() => () => {
    if (transactionEditorScrollRestoreTimeoutRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(transactionEditorScrollRestoreTimeoutRef.current);
    }
  }, []);

  const activeSubcategories = useMemo(
    () => subcategories.filter((subcategory) => subcategory.isActive !== false),
    [subcategories]
  );
  const activeActivities = useMemo(
    () => activities.filter((activity) => activity.isActive !== false),
    [activities]
  );
  const activeThirdParties = useMemo(
    () => thirdParties.filter((thirdParty) => thirdParty.isActive !== false),
    [thirdParties]
  );
  const activeWorkProjects = useMemo(() => workProjects.filter((project) => !["completed", "cancelled"].includes(project.status)), [workProjects]);
  const vehicleMap = useMemo(() => new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])), [vehicles]);
  const activeVehicles = useMemo(() => vehicles.filter((vehicle) => vehicle.isDeleted !== true), [vehicles]);
  const formVehicleOptions = useMemo(() => {
    const selected = vehicleMap.get(form.vehicleId);
    if (!selected?.isDeleted) return activeVehicles;
    return sortVehicles([...activeVehicles, { ...selected, name: `${selected.name} (supprimé)` }]);
  }, [activeVehicles, form.vehicleId, vehicleMap]);
  const activeProjects = useMemo(
    () => projects.filter((project) => project.isActive !== false),
    [projects]
  );

  const subcategoryMap = useMemo(
    () => new Map(subcategories.map((subcategory) => [subcategory.id, subcategory])),
    [subcategories]
  );
  const activityMap = useMemo(
    () => new Map(activities.map((activity) => [activity.id, activity])),
    [activities]
  );
  const thirdPartyMap = useMemo(
    () => new Map(thirdParties.map((thirdParty) => [thirdParty.id, thirdParty])),
    [thirdParties]
  );
  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts]
  );
  const projectMap = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );
  const fixedExpenseMap = useMemo(
    () => new Map((fixedExpenses || []).map((fixedExpense) => [fixedExpense.id, fixedExpense])),
    [fixedExpenses]
  );
  const manualClassificationSuggestion = useMemo(() => {
    if (editingId || !transactionEditorOpen) {
      return null;
    }

    return buildTransactionClassificationSuggestion(transactions, form);
  }, [editingId, form.accountId, form.description, form.type, transactionEditorOpen, transactions]);
  const manualClassificationSuggestionKey = useMemo(() => (
    manualClassificationSuggestion
      ? JSON.stringify({
          description: form.description,
          type: form.type,
          accountId: form.accountId,
          score: manualClassificationSuggestion.score,
          patch: manualClassificationSuggestion.patch,
        })
      : ""
  ), [form.accountId, form.description, form.type, manualClassificationSuggestion]);

  useEffect(() => {
    if (
      !manualClassificationSuggestion
      || !manualClassificationSuggestionKey
      || manualClassificationSuggestionKey === ignoredClassificationSuggestionKey
      || manualClassificationSuggestionKey === appliedClassificationSuggestionKey
    ) {
      return;
    }

    const protectedFields = ["categoryId", "subcategoryId", "thirdPartyId", "activityId", "projectId"];
    if (protectedFields.some((field) => String(form[field] || "").trim())) {
      return;
    }

    setForm((previous) => ({
      ...previous,
      ...buildClassificationSuggestionFormPatch(manualClassificationSuggestion.patch),
    }));
    setAppliedClassificationSuggestionKey(manualClassificationSuggestionKey);
  }, [
    appliedClassificationSuggestionKey,
    form,
    ignoredClassificationSuggestionKey,
    manualClassificationSuggestion,
    manualClassificationSuggestionKey,
  ]);

  const formCategoryOptions = useMemo(() => {
    const currentOptions = getTransactionCategoryOptions(form.type, form.categorie, form.categoryId);

    if (!form.categoryId || currentOptions.some((category) => category.id === form.categoryId || category.name === form.categorie)) {
      return currentOptions;
    }

    return [{ id: form.categoryId, name: form.categoryName || form.categorie || "Categorie" }, ...currentOptions];
  }, [categories, form.type, form.categorie, form.categoryId, form.categoryName]);

  const formSubcategoryOptions = useMemo(() => {
    const filteredSubcategories = activeSubcategories.filter((subcategory) => subcategory.categoryId === form.categoryId);

    if (!form.subcategoryId || filteredSubcategories.some((subcategory) => subcategory.id === form.subcategoryId)) {
      return filteredSubcategories;
    }

    return [
      {
        id: form.subcategoryId,
        name: form.subcategoryName || subcategoryMap.get(form.subcategoryId)?.name || "Sous-categorie",
        categoryId: form.categoryId,
      },
      ...filteredSubcategories,
    ];
  }, [activeSubcategories, form.categoryId, form.subcategoryId, form.subcategoryName, subcategoryMap]);
  const formThirdPartyOptions = useMemo(() => {
    if (!form.thirdPartyId || activeThirdParties.some((thirdParty) => thirdParty.id === form.thirdPartyId)) {
      return activeThirdParties;
    }

    return [
      {
        id: form.thirdPartyId,
        name: form.thirdPartyName || thirdPartyMap.get(form.thirdPartyId)?.name || "Tiers",
      },
      ...activeThirdParties,
    ];
  }, [activeThirdParties, form.thirdPartyId, form.thirdPartyName, thirdPartyMap]);
  const formActivityOptions = useMemo(() => {
    if (!form.activityId || activeActivities.some((activity) => activity.id === form.activityId)) {
      return activeActivities;
    }

    return [
      {
        id: form.activityId,
        name: form.activityName || activityMap.get(form.activityId)?.name || "Activite",
      },
      ...activeActivities,
    ];
  }, [activeActivities, form.activityId, form.activityName, activityMap]);
  const formAccountOptions = useMemo(() => {
    if (!form.accountId || accounts.some((account) => account.id === form.accountId)) {
      return accounts;
    }

    return [
      {
        id: form.accountId,
        name: accountMap.get(form.accountId)?.name || "Compte",
        icon: accountMap.get(form.accountId)?.icon || "💳",
      },
      ...accounts,
    ];
  }, [accounts, form.accountId, accountMap]);
  const prioritizedProjectOptions = useMemo(() => {
    if (!form.activityId) {
      if (!form.projectId || activeProjects.some((project) => project.id === form.projectId)) {
        return activeProjects;
      }

      return [
        {
          id: form.projectId,
          name: form.projectName || projectMap.get(form.projectId)?.name || "Projet",
          activityId: form.activityId || null,
        },
        ...activeProjects,
      ];
    }

    const linked = activeProjects.filter((project) => project.activityId === form.activityId);
    const unlinked = activeProjects.filter((project) => project.activityId !== form.activityId);
    const sortedProjects = [...linked, ...unlinked];

    if (!form.projectId || sortedProjects.some((project) => project.id === form.projectId)) {
      return sortedProjects;
    }

    return [
      {
        id: form.projectId,
        name: form.projectName || projectMap.get(form.projectId)?.name || "Projet",
        activityId: form.activityId || null,
      },
      ...sortedProjects,
    ];
  }, [activeProjects, form.activityId, form.projectId, form.projectName, projectMap]);

  const quickFixedExpenseCategoryOptions = useMemo(() => {
    const depenseCategories = categories
      .filter((category) => category.type === "depense")
      .map((category) => ({ id: category.id, name: category.name }))
      .filter((category) => Boolean(String(category.name || "").trim()));

    const fallbackName = String(quickFixedExpenseSourceForm.categoryName || quickFixedExpenseSourceForm.categorie || "").trim();
    if (
      quickFixedExpenseSourceForm.categoryId
      && !depenseCategories.some((category) => category.id === quickFixedExpenseSourceForm.categoryId)
    ) {
      depenseCategories.unshift({
        id: quickFixedExpenseSourceForm.categoryId,
        name: fallbackName || "Categorie",
      });
    }

    if (!quickFixedExpenseSourceForm.categoryId && fallbackName && !depenseCategories.some((category) => category.name === fallbackName)) {
      depenseCategories.unshift({ id: "", name: fallbackName });
    }

    return depenseCategories;
  }, [categories, quickFixedExpenseSourceForm.categoryId, quickFixedExpenseSourceForm.categoryName, quickFixedExpenseSourceForm.categorie]);

  const quickFixedExpenseSubcategoryOptions = useMemo(() => {
    const filteredSubcategories = activeSubcategories.filter((subcategory) => subcategory.categoryId === quickFixedExpenseSourceForm.categoryId);
    if (!quickFixedExpenseSourceForm.subcategoryId || filteredSubcategories.some((subcategory) => subcategory.id === quickFixedExpenseSourceForm.subcategoryId)) {
      return filteredSubcategories;
    }

    return [
      {
        id: quickFixedExpenseSourceForm.subcategoryId,
        name: quickFixedExpenseSourceForm.subcategoryName || subcategoryMap.get(quickFixedExpenseSourceForm.subcategoryId)?.name || "Sous-categorie",
        categoryId: quickFixedExpenseSourceForm.categoryId,
      },
      ...filteredSubcategories,
    ];
  }, [activeSubcategories, quickFixedExpenseSourceForm.categoryId, quickFixedExpenseSourceForm.subcategoryId, quickFixedExpenseSourceForm.subcategoryName, subcategoryMap]);

  const quickFixedExpenseActivityOptions = useMemo(() => {
    if (!quickFixedExpenseSourceForm.activityId || activeActivities.some((activity) => activity.id === quickFixedExpenseSourceForm.activityId)) {
      return activeActivities;
    }

    return [
      {
        id: quickFixedExpenseSourceForm.activityId,
        name: quickFixedExpenseSourceForm.activityName || activityMap.get(quickFixedExpenseSourceForm.activityId)?.name || "Activite",
      },
      ...activeActivities,
    ];
  }, [activeActivities, quickFixedExpenseSourceForm.activityId, quickFixedExpenseSourceForm.activityName, activityMap]);

  const quickFixedExpenseThirdPartyOptions = useMemo(() => {
    if (!quickFixedExpenseSourceForm.thirdPartyId || activeThirdParties.some((thirdParty) => thirdParty.id === quickFixedExpenseSourceForm.thirdPartyId)) {
      return activeThirdParties;
    }

    return [
      {
        id: quickFixedExpenseSourceForm.thirdPartyId,
        name: quickFixedExpenseSourceForm.thirdPartyName || thirdPartyMap.get(quickFixedExpenseSourceForm.thirdPartyId)?.name || "Tiers",
      },
      ...activeThirdParties,
    ];
  }, [activeThirdParties, quickFixedExpenseSourceForm.thirdPartyId, quickFixedExpenseSourceForm.thirdPartyName, thirdPartyMap]);

  const quickFixedExpenseProjectOptions = useMemo(() => {
    const sourceActivityId = quickFixedExpenseSourceForm.activityId;
    const sortedProjects = !sourceActivityId
      ? activeProjects
      : [
          ...activeProjects.filter((project) => project.activityId === sourceActivityId),
          ...activeProjects.filter((project) => project.activityId !== sourceActivityId),
        ];

    if (!quickFixedExpenseSourceForm.projectId || sortedProjects.some((project) => project.id === quickFixedExpenseSourceForm.projectId)) {
      return sortedProjects;
    }

    return [
      {
        id: quickFixedExpenseSourceForm.projectId,
        name: quickFixedExpenseSourceForm.projectName || projectMap.get(quickFixedExpenseSourceForm.projectId)?.name || "Projet",
        activityId: sourceActivityId || null,
      },
      ...sortedProjects,
    ];
  }, [activeProjects, quickFixedExpenseSourceForm.activityId, quickFixedExpenseSourceForm.projectId, quickFixedExpenseSourceForm.projectName, projectMap]);

  const subcategoryFilterOptions = useMemo(() => {
    const seen = new Set();
    const options = [];

    transactions.forEach((transaction) => {
      if (!transaction?.subcategoryId) {
        return;
      }

      const label = transaction.subcategoryName || subcategoryMap.get(transaction.subcategoryId)?.name || "Sous-categorie";
      if (seen.has(transaction.subcategoryId)) {
        return;
      }

      seen.add(transaction.subcategoryId);
      options.push({ value: transaction.subcategoryId, label });
    });

    activeSubcategories.forEach((subcategory) => {
      if (seen.has(subcategory.id)) {
        return;
      }

      seen.add(subcategory.id);
      options.push({ value: subcategory.id, label: subcategory.name });
    });

    return options.sort((left, right) => String(left.label).localeCompare(String(right.label), "fr", { sensitivity: "base" }));
  }, [transactions, activeSubcategories, subcategoryMap]);

  const activityFilterOptions = useMemo(() => {
    const seen = new Set();
    const options = [];

    transactions.forEach((transaction) => {
      if (!transaction?.activityId) {
        return;
      }

      const label = transaction.activityName || activityMap.get(transaction.activityId)?.name || "Activite";
      if (seen.has(transaction.activityId)) {
        return;
      }

      seen.add(transaction.activityId);
      options.push({ value: transaction.activityId, label });
    });

    activeActivities.forEach((activity) => {
      if (seen.has(activity.id)) {
        return;
      }

      seen.add(activity.id);
      options.push({ value: activity.id, label: activity.name });
    });

    return options.sort((left, right) => String(left.label).localeCompare(String(right.label), "fr", { sensitivity: "base" }));
  }, [transactions, activeActivities, activityMap]);

  const thirdPartyFilterOptions = useMemo(() => {
    const seen = new Set();
    const options = [];

    transactions.forEach((transaction) => {
      if (!transaction?.thirdPartyId) {
        return;
      }

      const label = transaction.thirdPartyName || thirdPartyMap.get(transaction.thirdPartyId)?.name || "Tiers";
      if (seen.has(transaction.thirdPartyId)) {
        return;
      }

      seen.add(transaction.thirdPartyId);
      options.push({ value: transaction.thirdPartyId, label });
    });

    activeThirdParties.forEach((thirdParty) => {
      if (seen.has(thirdParty.id)) {
        return;
      }

      seen.add(thirdParty.id);
      options.push({ value: thirdParty.id, label: thirdParty.name });
    });

    return options.sort((left, right) => String(left.label).localeCompare(String(right.label), "fr", { sensitivity: "base" }));
  }, [transactions, activeThirdParties, thirdPartyMap]);

  const projectFilterOptions = useMemo(() => {
    const seen = new Set();
    const options = [];

    transactions.forEach((transaction) => {
      if (!transaction?.projectId) {
        return;
      }

      const label = transaction.projectName || projectMap.get(transaction.projectId)?.name || "Projet";
      if (seen.has(transaction.projectId)) {
        return;
      }

      seen.add(transaction.projectId);
      options.push({ value: transaction.projectId, label });
    });

    activeProjects.forEach((project) => {
      if (seen.has(project.id)) {
        return;
      }

      seen.add(project.id);
      options.push({ value: project.id, label: project.name });
    });

    return options.sort((left, right) => String(left.label).localeCompare(String(right.label), "fr", { sensitivity: "base" }));
  }, [transactions, activeProjects, projectMap]);

  useEffect(() => {
    if (!form.accountId && defaultAccount?.id) {
      setForm((oldForm) => ({
        ...oldForm,
        accountId: oldForm.accountId || defaultAccount.id,
      }));
    }
  }, [defaultAccount, form.accountId]);

  useEffect(() => {
    if (!form.subcategoryId) {
      return;
    }

    const selected = subcategoryMap.get(form.subcategoryId);
    if (!selected || selected.categoryId !== form.categoryId) {
      setForm((previous) => ({
        ...previous,
        subcategoryId: "",
        subcategoryName: "",
      }));
    }
  }, [form.subcategoryId, form.categoryId, subcategoryMap]);

  const listFiltersWithoutSearch = useMemo(
    () => ({
      ...listFilters,
      searchText: "",
    }),
    [listFilters]
  );

  const filteredTransactions = useMemo(
    () => filterTransactionsForView(transactions, listFiltersWithoutSearch, new Date(), { getAccountLabel }),
    [transactions, listFiltersWithoutSearch, accounts]
  );

  const searchedTransactions = useMemo(
    () => applyTransactionSearch(filteredTransactions, listFilters.searchText, getAccountLabel),
    [filteredTransactions, listFilters.searchText, accounts]
  );

  const displayedTransactions = useMemo(
    () => sortTransactionsForView(searchedTransactions, sortPreferences, { getAccountLabel }),
    [searchedTransactions, sortPreferences, accounts]
  );

  const displayedTransactionsSummary = useMemo(() => buildTransactionsSummary(displayedTransactions), [displayedTransactions]);

  const displayedTransactionIdSet = useMemo(
    () => new Set(displayedTransactions.map((transaction) => transaction.id)),
    [displayedTransactions]
  );

  const visibleSelectedTransactionIds = useMemo(
    () => resolveVisibleSelectedTransactionIds(selectedTransactionIds, displayedTransactions),
    [displayedTransactions, selectedTransactionIds]
  );
  const selectedTransactions = useMemo(
    () => resolveVisibleSelectedTransactions(visibleSelectedTransactionIds, displayedTransactions),
    [displayedTransactions, visibleSelectedTransactionIds]
  );
  const displayedTransactionsCount = displayedTransactions.length;
  const selectedTransactionsCount = visibleSelectedTransactionIds.length;
  const isSelectionEmpty = selectedTransactionsCount === 0;
  const isSelectionComplete = displayedTransactionsCount > 0 && selectedTransactionsCount === displayedTransactionsCount;
  const isSelectionPartial = !isSelectionEmpty && !isSelectionComplete;
  const selectedTransactionsSummary = useMemo(() => buildTransactionsSummary(selectedTransactions), [selectedTransactions]);

  const trendData = useMemo(
    () => buildIncomeExpenseTrendData(filteredTransactions, trendPeriod),
    [filteredTransactions, trendPeriod]
  );
  const hasTrendValues = useMemo(
    () => trendData.some((row) => Number(row.depense || 0) > 0 || Number(row.revenu || 0) > 0),
    [trendData]
  );
  const legacyTransactionsCount = useMemo(
    () => transactions.filter((transaction) => Boolean(getLegacyTransactionType(transaction?.type))).length,
    [transactions]
  );
  const legacyTransactions = useMemo(
    () => transactions.filter((transaction) => Boolean(getLegacyTransactionType(transaction?.type))),
    [transactions]
  );
  const voiceAvailable = useMemo(() => isSpeechRecognitionAvailable(), []);

  useEffect(() => {
    try {
      const rawPreferences = localStorage.getItem(TRANSACTIONS_SORT_PREFERENCES_STORAGE_KEY);
      const defaultPreferences = getDefaultTransactionSortPreferences();
      setSortPreferences(parseTransactionSortPreferences(rawPreferences, defaultPreferences));
    } catch (storageError) {
      console.warn("Impossible de restaurer les preferences de tri.", storageError);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(TRANSACTIONS_SORT_PREFERENCES_STORAGE_KEY, JSON.stringify(sortPreferences));
    } catch (storageError) {
      console.warn("Impossible de sauvegarder les preferences de tri.", storageError);
    }
  }, [sortPreferences]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onstart = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (!navigationContext || navigationContext.source !== "analysis") {
      return;
    }

    setListFilters(applyTransactionsNavigationContext(navigationContext));
    setTrendPeriod(navigationContext.period || "currentYear");
    setMessage("Filtres appliques depuis Analyse ✅");
    onNavigationContextApplied?.();
  }, [navigationContext, onNavigationContextApplied]);

  useEffect(() => {
    if (!openBankImportRequestId) {
      return;
    }

    setBankImportOpen(true);
  }, [openBankImportRequestId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    let animationFrameId = null;
    let ticking = false;
    const collapseStart = 24;
    const collapseDistance = 160;

    const updateCollapseProgress = () => {
      const scrollY = getCurrentScrollY();
      const nextProgress = Math.max(0, Math.min(1, (scrollY - collapseStart) / collapseDistance));
      setSmartHeaderCollapseProgress((previous) => (Math.abs(previous - nextProgress) < 0.01 ? previous : nextProgress));
      ticking = false;
    };

    const handleScroll = () => {
      if (ticking) {
        return;
      }

      ticking = true;
      animationFrameId = window.requestAnimationFrame(updateCollapseProgress);
    };

    updateCollapseProgress();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!selectionMode) {
      setSelectedTransactionIds([]);
      return;
    }

    setSelectedTransactionIds((previous) => previous.filter((transactionId) => displayedTransactionIdSet.has(transactionId)));
  }, [selectionMode, displayedTransactionIdSet]);

  const filterCategoryOptions = useMemo(() => {
    const options = [];
    const seen = new Set();

    categories.forEach((category) => {
      const id = String(category?.id || "").trim();
      const name = String(category?.name || "").trim();
      if (!id || !name || isTechnicalCategoryDisplayValue(name) || seen.has(`id:${id}`)) {
        return;
      }

      options.push({ value: `id:${id}`, label: getSafeCategoryLabel(name) });
      seen.add(`id:${id}`);
    });

    transactions.forEach((transaction) => {
      const name = String(transaction?.categoryName || transaction?.categorie || transaction?.category || "").trim();
      if (!name || isTechnicalCategoryDisplayValue(name) || seen.has(`name:${name.toLowerCase()}`)) {
        return;
      }

      options.push({ value: `name:${name}`, label: getSafeCategoryLabel(name) });
      seen.add(`name:${name.toLowerCase()}`);
    });

    if (listFilters.categoryId !== "all" && !seen.has(`id:${listFilters.categoryId}`)) {
      options.unshift({ value: `id:${listFilters.categoryId}`, label: listFilters.categoryName !== "all" ? listFilters.categoryName : "Categorie" });
    }

    if (listFilters.categoryId === "all" && listFilters.categoryName !== "all") {
      const key = `name:${String(listFilters.categoryName).toLowerCase()}`;
      if (!seen.has(key)) {
        options.unshift({ value: `name:${listFilters.categoryName}`, label: listFilters.categoryName });
      }
    }

    return options;
  }, [categories, transactions, listFilters.categoryId, listFilters.categoryName]);

  const draftCategoryFilterValue = useMemo(
    () => getCategoryFilterValue(filtersDraft),
    [filtersDraft.categoryId, filtersDraft.categoryName]
  );
  const draftSubcategoryFilterValue = filtersDraft.subcategoryId || "all";
  const draftActivityFilterValue = filtersDraft.activityId || "all";
  const draftThirdPartyFilterValue = filtersDraft.thirdPartyId || "all";
  const draftProjectFilterValue = filtersDraft.projectId || "all";
  const activeFiltersCount = useMemo(
    () => countActiveListFilters(listFilters, getDefaultTransactionsListFilters()),
    [listFilters]
  );
  const filtersToggleLabel = activeFiltersCount > 0 ? `Filtres (${activeFiltersCount})` : "Filtres";

  const showFilterTransactionIdsHint = Array.isArray(listFilters.transactionIds) && listFilters.transactionIds.length > 0;

  function handleChange(event) {
    const { name, value, type, checked } = event.target;
    const nextValue = type === "checkbox" ? checked : value;

    setTransactionEditorError("");

    if (name === "categorie" && value === CREATE_CATEGORY_VALUE) {
      openQuickCategoryDialog();
      return;
    }

    if (name === "accountId" && value === CREATE_ACCOUNT_VALUE) {
      openQuickAccountDialog();
      return;
    }

    if (name === "activityId" && value === CREATE_ACTIVITY_VALUE) {
      openQuickActivityDialog();
      return;
    }

    if (name === "projectId" && value === CREATE_PROJECT_VALUE) {
      openQuickProjectDialog();
      return;
    }

    if (name === "subcategoryId" && value === CREATE_SUBCATEGORY_VALUE) {
      if (form.categoryId) {
        openQuickSubcategoryDialog();
      }
      return;
    }

    if (name === "thirdPartyId" && value === CREATE_THIRD_PARTY_VALUE) {
      openQuickThirdPartyDialog();
      return;
    }

    if (name === "vehicleId" && value === CREATE_VEHICLE_VALUE) {
      setQuickVehicleOpen(true);
      return;
    }

    if (name === "fixedExpenseId" && value === CREATE_FIXED_EXPENSE_VALUE) {
      openQuickFixedExpenseDialog([], oldForm);
      return;
    }

    setForm((oldForm) => {
      if (name === "type") {
        const nextType = value;
        const nextCategory = getTransactionCategoryOptions(nextType, oldForm.categorie, oldForm.categoryId)[0] || {
          id: "",
          name: "",
        };

        return {
          ...oldForm,
          type: nextType,
          categorie: nextCategory.name || "",
          categoryId: nextCategory.id || "",
          categoryName: nextCategory.name || "",
          subcategoryId: "",
          subcategoryName: "",
          isFixedExpense: nextType === "depense" ? oldForm.isFixedExpense : false,
          fixedExpenseId: nextType === "depense" ? oldForm.fixedExpenseId : "",
        };
      }

      if (name === "isFixedExpense") {
        return {
          ...oldForm,
          isFixedExpense: Boolean(nextValue),
          fixedExpenseId: nextValue ? oldForm.fixedExpenseId : "",
        };
      }

      if (name === "fixedExpenseId") {
        const selectedFixedExpense = fixedExpenseMap.get(value);
        if (!selectedFixedExpense) {
          return {
            ...oldForm,
            fixedExpenseId: value,
          };
        }

        return applyFixedExpenseToTransactionForm(oldForm, selectedFixedExpense, oldForm.date);
      }

      if (name === "categorie") {
        const categoryOptions = getTransactionCategoryOptions(oldForm.type, oldForm.categorie, oldForm.categoryId);
        const selectedCategory = categoryOptions.find((option) => (option.id || option.name) === value);
        const categoryName = selectedCategory?.name || value;

        return {
          ...oldForm,
          categorie: categoryName,
          categoryName,
          categoryId: selectedCategory?.id || "",
          subcategoryId: "",
          subcategoryName: "",
        };
      }

      if (name === "subcategoryId") {
        const selectedSubcategory = activeSubcategories.find((subcategory) => subcategory.id === value);
        return {
          ...oldForm,
          subcategoryId: value,
          subcategoryName: selectedSubcategory?.name || "",
        };
      }

      if (name === "activityId") {
        const selectedActivity = activeActivities.find((activity) => activity.id === value);
        return {
          ...oldForm,
          activityId: value,
          activityName: selectedActivity?.name || "",
        };
      }

      if (name === "thirdPartyId") {
        const selectedThirdParty = activeThirdParties.find((thirdParty) => thirdParty.id === value);
        return {
          ...oldForm,
          thirdPartyId: value,
          thirdPartyName: selectedThirdParty?.name || "",
        };
      }

      if (name === "projectId") {
        const selectedProject = activeProjects.find((project) => project.id === value);
        return {
          ...oldForm,
          projectId: value,
          projectName: selectedProject?.name || "",
        };
      }

      return {
        ...oldForm,
        [name]: nextValue,
      };
    });
  }

  function handleListFilterChange(event) {
    const { name, value } = event.target;

    if (name === "categoryFilter") {
      if (value === "all") {
        setListFilters((previous) => ({
          ...previous,
          categoryId: "all",
          categoryName: "all",
          transactionIds: [],
        }));
        return;
      }

      if (String(value).startsWith("id:")) {
        const categoryId = String(value).slice(3);
        const categoryName = categories.find((category) => category.id === categoryId)?.name || "all";
        setListFilters((previous) => ({
          ...previous,
          categoryId,
          categoryName,
          transactionIds: [],
        }));
        return;
      }

      const categoryName = String(value).slice(5);
      setListFilters((previous) => ({
        ...previous,
        categoryId: "all",
        categoryName,
        transactionIds: [],
      }));
      return;
    }

    if (["subcategoryId", "activityId", "thirdPartyId", "projectId"].includes(name)) {
      setListFilters((previous) => ({
        ...previous,
        [name]: value,
        transactionIds: [],
      }));
      return;
    }

    setListFilters((previous) => ({
      ...previous,
      [name]: value,
      transactionIds: name === "period" || name === "type" || name === "accountId" ? [] : previous.transactionIds,
    }));

    if (name === "period") {
      setTrendPeriod(value);
    }
  }

  function openFiltersDialog() {
    if (filtersDialogOpen) {
      setFiltersDialogOpen(false);
      return;
    }

    setSortDialogOpen(false);
    setFiltersDraft(listFilters);
    setFiltersDialogOpen(true);
  }

  function closeFiltersDialog() {
    setFiltersDialogOpen(false);
  }

  function handleFiltersDraftChange(event) {
    const { name, value } = event.target;

    function computeNextFilters(previous) {
      if (name === "categoryFilter") {
        if (value === "all") {
          return {
            ...previous,
            categoryId: "all",
            categoryName: "all",
            transactionIds: [],
          };
        }

        if (String(value).startsWith("id:")) {
          const categoryId = String(value).slice(3);
          const categoryName = categories.find((category) => category.id === categoryId)?.name || "all";
          return {
            ...previous,
            categoryId,
            categoryName,
            transactionIds: [],
          };
        }

        const categoryName = String(value).slice(5);
        return {
          ...previous,
          categoryId: "all",
          categoryName,
          transactionIds: [],
        };
      }

      if (["subcategoryId", "activityId", "thirdPartyId", "projectId"].includes(name)) {
        return {
          ...previous,
          [name]: value,
          transactionIds: [],
        };
      }

      return {
        ...previous,
        [name]: value,
        transactionIds: name === "period" || name === "type" || name === "accountId" ? [] : previous.transactionIds,
      };
    }

    setFiltersDraft((previous) => computeNextFilters(previous));
  }

  function applyFiltersDialog() {
    setListFilters(filtersDraft);
    setTrendPeriod(filtersDraft.period || "currentYear");
    setFiltersDialogOpen(false);
  }

  function resetFiltersDialog() {
    const defaultFilters = getDefaultTransactionsListFilters();
    setFiltersDraft(defaultFilters);
    setListFilters(defaultFilters);
    setTrendPeriod(defaultFilters.period || "currentYear");
  }

  function openSortDialog() {
    if (sortDialogOpen) {
      setSortDialogOpen(false);
      return;
    }

    setFiltersDialogOpen(false);
    setSortDraft(sortPreferences);
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
    setSortPreferences((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function resetSortDialog() {
    const defaults = getDefaultTransactionSortPreferences();
    setSortDraft(defaults);
    setSortPreferences(defaults);
  }

  function getTransactionCategoryOptions(type, currentCategory = "") {
    const expectedType = type === "revenu" ? "revenu" : "depense";
    const firestoreCategories = categories
      .filter((category) => category.type === expectedType)
      .map((category) => ({ id: category.id, name: category.name }))
      .filter((category) => Boolean(category.name));

    if (firestoreCategories.length > 0) {
      return getUniqueCategoryOptions(firestoreCategories, currentCategory, form.categoryId);
    }

    return getUniqueCategoryOptions(
      getCategoryOptions(type).map((categoryName) => ({ id: "", name: categoryName })),
      currentCategory,
      form.categoryId
    );
  }

  function handleCancelEdit() {
    scheduleTransactionEditorScrollRestore();
    setEditingId(null);
    setTransactionEditorOpen(false);
    setTransactionEditorFocusTarget("");
    setIgnoredClassificationSuggestionKey("");
    setAppliedClassificationSuggestionKey("");
    setForm(getInitialForm());
    setTransactionEditorInitialForm(getInitialForm());
    setTransactionEditorError("");
    setMessage("");
  }

  function ignoreManualClassificationSuggestion() {
    if (!manualClassificationSuggestion || !manualClassificationSuggestionKey) {
      return;
    }

    const clearPatch = {};
    Object.keys(manualClassificationSuggestion.patch || {}).forEach((field) => {
      if (field !== "accountId" && String(form[field] || "") === String(manualClassificationSuggestion.patch[field] || "")) {
        clearPatch[field] = "";
      }
    });

    setIgnoredClassificationSuggestionKey(manualClassificationSuggestionKey);
    setForm((previous) => ({
      ...previous,
      ...clearPatch,
      ...(clearPatch.categoryId !== undefined ? { categorie: "", categoryName: "", subcategoryId: "", subcategoryName: "" } : {}),
      ...(clearPatch.subcategoryId !== undefined ? { subcategoryName: "" } : {}),
      ...(clearPatch.thirdPartyId !== undefined ? { thirdPartyName: "" } : {}),
      ...(clearPatch.activityId !== undefined ? { activityName: "" } : {}),
      ...(clearPatch.projectId !== undefined ? { projectName: "" } : {}),
    }));
  }

  function openCreateTransactionDialog() {
    const nextForm = {
      ...getInitialForm(),
      accountId: defaultAccount?.id || "",
    };

    setTransactionEditorScrollRestorePosition(getCurrentScrollY());
    setEditingId(null);
    setForm(nextForm);
    setTransactionEditorInitialForm(nextForm);
    setTransactionEditorFocusTarget("");
    setIgnoredClassificationSuggestionKey("");
    setAppliedClassificationSuggestionKey("");
    setTransactionEditorError("");
    setTransactionEditorOpen(true);
    setMessage("");
  }

  function handleReceiptDraftReady(parsedReceipt) {
    const parsedDraft = parsedReceipt?.draft || {};

    setDraftTransactionForm({
      ...getInitialForm(),
      ...parsedDraft,
      accountId: parsedDraft.accountId || defaultAccount?.id || "",
    });
    setDraftDialogOpen(true);
    setMessage("");
  }

  function handleReceiptDraftError(errorMessage) {
    setMessage(errorMessage || "Erreur lors de l'analyse du ticket ❌");
  }

  function handleVoiceTranscript(transcript) {
    const parsed = parseVoiceTransactionDraft(transcript, {
      categories: voiceParserCategories,
      accounts,
    });

    const parsedCategoryName = parsed.categoryName || "";

    setDraftTransactionForm(buildVoiceDraftForm({
      ...parsed,
      categoryName: parsedCategoryName,
      categorie: parsedCategoryName,
      categoryId: parsed.categoryId || "",
      accountId: parsed.accountId || defaultAccount?.id || "",
      type: parsed.type || "depense",
      date: parsed.date || getInitialForm().date,
      description: parsed.description || "",
      rawTranscript: parsed.rawTranscript,
    }, getInitialForm()));

    setDraftDialogOpen(true);
  }

  function stopVoiceRecognition() {
    if (!recognitionRef.current) {
      return;
    }

    recognitionRef.current.stop();
  }

  function startVoiceRecognition() {
    if (!voiceAvailable) {
      setVoiceStatus("unavailable");
      setVoiceMessage("La saisie vocale n'est pas disponible sur cet appareil.");
      return;
    }

    const SpeechCtor = getSpeechRecognitionConstructor();
    if (!SpeechCtor) {
      setVoiceStatus("unavailable");
      setVoiceMessage("La saisie vocale n'est pas disponible sur cet appareil.");
      return;
    }

    transcriptCapturedRef.current = false;
    const recognition = new SpeechCtor();
    recognition.lang = "fr-FR";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setVoiceStatus("listening");
      setVoiceMessage("Je vous ecoute...");
    };

    recognition.onresult = (event) => {
      const transcript = String(event?.results?.[0]?.[0]?.transcript || "").trim();
      if (!transcript) {
        return;
      }

      transcriptCapturedRef.current = true;
      setVoiceTranscript(transcript);
      setVoiceStatus("transcribed");
      setVoiceMessage("Transcription recue.");
      handleVoiceTranscript(transcript);
    };

    recognition.onerror = (event) => {
      setVoiceStatus("error");
      setVoiceMessage(mapSpeechRecognitionError(event?.error));
    };

    recognition.onend = () => {
      if (transcriptCapturedRef.current) {
        return;
      }

      setVoiceStatus("idle");
      if (!voiceMessage) {
        setVoiceMessage("Session vocale terminee.");
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function closeDraftDialog() {
    if (isCreatingFromDraft) {
      return;
    }

    setDraftDialogOpen(false);
    setDraftTransactionForm(null);
  }

  function handleEdit(transaction, uiContext = {}) {
    if (transactionEditorOpen) {
      return;
    }

    if (transaction?.isAdjustment) {
      setMessage("Les ajustements de solde sont consultables et supprimables depuis l'historique.");
      return;
    }

    const transactionCategoryMeta = getTransactionCategoryMeta(transaction);
    const transactionCategoryName = transactionCategoryMeta?.name || transaction.categoryName || transaction.categorie || "";
    const matchingFixedExpense = findMatchingFixedExpenseForTransaction(transaction, fixedExpenses);
    const nextForm = {
      date: transaction.date || getInitialForm().date,
      montant: String(transaction.montant),
      categorie: transactionCategoryName,
      categoryId: transaction.categoryId || transactionCategoryMeta?.id || "",
      categoryName: transactionCategoryName,
      description: transaction.description || "",
      type: transaction.type || "depense",
      accountId: transaction.accountId || defaultAccount?.id || "",
      subcategoryId: transaction.subcategoryId || "",
      subcategoryName: transaction.subcategoryName || subcategoryMap.get(transaction.subcategoryId || "")?.name || "",
      activityId: transaction.activityId || "",
      activityName: transaction.activityName || activityMap.get(transaction.activityId || "")?.name || "",
      thirdPartyId: transaction.thirdPartyId || "",
      thirdPartyName: transaction.thirdPartyName || thirdPartyMap.get(transaction.thirdPartyId || "")?.name || "",
      projectId: transaction.projectId || "",
      projectName: transaction.projectName || projectMap.get(transaction.projectId || "")?.name || "",
      workProjectId: transaction.workProjectId || "",
      vehicleId: transaction.vehicleId || "",
      destinationAccountId: transaction.destinationAccountId || "",
      isFixedExpense: Boolean(matchingFixedExpense),
      fixedExpenseId: matchingFixedExpense?.id || "",
    };

    setTransactionEditorScrollRestorePosition(getCurrentScrollY());
    setEditingId(transaction.id);
    setTransactionEditorOpen(true);
    setTransactionEditorFocusTarget(resolveTransactionEditorFocusTarget(uiContext.focusTarget));
    setIgnoredClassificationSuggestionKey("");
    setAppliedClassificationSuggestionKey("");
    setForm(nextForm);
    setTransactionEditorInitialForm(nextForm);
    setTransactionEditorError("");
    setMessage("");
  }

  useEffect(() => {
    if (!navigationContext || navigationContext.source !== "card-explorer" || !navigationContext.openTransactionId) {
      return;
    }

    const transaction = transactions.find((item) => item.id === navigationContext.openTransactionId);
    if (!transaction) {
      return;
    }

    handleEdit(transaction, {
      focusTarget: navigationContext.openMode === "edit" ? "description" : "",
    });
    setMessage("Transaction ouverte depuis une carte ✅");
    onNavigationContextApplied?.();
  }, [navigationContext, onNavigationContextApplied, transactions]);

  function openSelectionMode() {
    setSelectionMode(true);
    setSelectedTransactionIds([]);
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setBulkEditMode("advanced");
    setSelectedTransactionIds([]);
    setBulkEditDialogOpen(false);
    setBulkDeleteDialogOpen(false);
  }

  function toggleTransactionSelection(transactionId) {
    setSelectionMode(true);
    setSelectedTransactionIds((previous) => (
      previous.includes(transactionId)
        ? previous.filter((currentId) => currentId !== transactionId)
        : [...previous, transactionId]
    ));
  }

  function selectDisplayedTransactions() {
    setSelectionMode(true);
    setSelectedTransactionIds(displayedTransactions.map((transaction) => transaction.id));
  }

  function deselectAllTransactions() {
    setSelectedTransactionIds([]);
  }

  function openBulkEditDialog(mode = "advanced") {
    if (!selectedTransactionsCount) {
      return;
    }

    setBulkEditMode(mode);
    setBulkEditDialogOpen(true);
  }

  function openBulkDeleteDialog() {
    if (!selectedTransactionsCount) {
      return;
    }

    setBulkDeleteDialogOpen(true);
  }

  async function handleBulkUpdate(patch, options = {}) {
    if (!visibleSelectedTransactionIds.length) {
      setMessage("Aucune transaction affichée n’est sélectionnée.");
      return { success: false, error: "Aucune transaction affichée n’est sélectionnée." };
    }

    try {
      const isClassificationMode = options.mode === "classification";

      setBulkOperationLoading(true);

      const result = await bulkUpdateTransactions({
        transactionIds: visibleSelectedTransactionIds,
        patch,
        transactions,
        catalogs: {
          categoryMap: new Map(categories.map((category) => [category.id, category])),
          subcategoryMap,
          activityMap,
          thirdPartyMap,
          projectMap,
          workProjectMap: new Map(workProjects.map((project) => [project.id, project])),
          accountMap: new Map(accounts.map((account) => [account.id, account])),
        },
        clearIncompatibleSubcategories: Boolean(options.clearIncompatibleSubcategories),
      });

      const categoryLabel = String(options.categoryName || "").trim();

      if (result.updatedCount > 0 && result.failedCount === 0) {
        if (isClassificationMode && categoryLabel) {
          setMessage(`${result.updatedCount} transaction(s) classee(s) dans ${categoryLabel}. ✅`);
        } else {
          setMessage(`${result.updatedCount} transaction(s) mises a jour ✅`);
        }
        exitSelectionMode();
        setBulkEditDialogOpen(false);
        return { success: true, result };
      }

      if (result.updatedCount > 0 && result.failedCount > 0) {
        if (isClassificationMode && categoryLabel) {
          setMessage(`${result.updatedCount} transaction(s) classee(s) dans ${categoryLabel}, ${result.failedCount} echec(s) ❌`);
        } else {
          setMessage(`${result.updatedCount} mise(s) a jour, ${result.failedCount} echec(s) ❌`);
        }
        setSelectedTransactionIds(result.failedIds);
        setSelectionMode(result.failedIds.length > 0);
        return { success: false, error: "Certaines transactions n’ont pas pu être modifiées.", result };
      }

      setMessage(isClassificationMode ? "Aucune transaction n'a pu etre classee ❌" : "Aucune transaction n'a pu etre mise a jour ❌");
      setSelectedTransactionIds(result.failedIds);
      setSelectionMode(result.failedIds.length > 0);
      return { success: false, error: "Aucune transaction n’a pu être modifiée.", result };
    } catch (bulkError) {
      console.error(bulkError);
      setMessage("Erreur lors de la mise a jour de masse ❌");
      return { success: false, error: bulkError?.message || "Erreur lors de la mise à jour de masse." };
    } finally {
      setBulkOperationLoading(false);
    }
  }

  async function handleBulkDeleteConfirm() {
    if (!visibleSelectedTransactionIds.length) {
      setMessage("Aucune transaction affichée n’est sélectionnée.");
      return;
    }

    try {
      setBulkOperationLoading(true);
      const result = await bulkDeleteTransactions({ transactionIds: visibleSelectedTransactionIds });

      if (result.updatedCount > 0 && result.failedCount === 0) {
        setMessage(`${result.updatedCount} transaction(s) supprimée(s) ✅`);
        exitSelectionMode();
        return;
      }

      if (result.updatedCount > 0 && result.failedCount > 0) {
        setMessage(`${result.updatedCount} suppression(s) reussie(s), ${result.failedCount} echec(s) ❌`);
        setSelectedTransactionIds(result.failedIds);
        setSelectionMode(result.failedIds.length > 0);
        return;
      }

      setMessage("Aucune transaction n'a pu être supprimée ❌");
      setSelectedTransactionIds(result.failedIds);
      setSelectionMode(result.failedIds.length > 0);
    } catch (bulkError) {
      console.error(bulkError);
      setMessage("Erreur lors de la suppression de masse ❌");
    } finally {
      setBulkOperationLoading(false);
      setBulkDeleteDialogOpen(false);
    }
  }

  function openDeleteDialog(transaction) {
    setTransactionToDelete(transaction);
    setDeleteDialogOpen(true);
  }

  function closeDeleteDialog() {
    setDeleteDialogOpen(false);
    setTransactionToDelete(null);
  }

  function openActionMenu(event, transaction) {
    setActionMenuAnchor(event.currentTarget);
    setActionMenuTransaction(transaction);
  }

  function closeActionMenu() {
    setActionMenuAnchor(null);
    setActionMenuTransaction(null);
  }

  function getTransactionCategoryMeta(transaction) {
    return resolveTransactionCategoryMeta(transaction, categories);
  }

  function validateTransactionReferences(formValues) {
    const validationMessage = validateTransactionReferencesForSave(formValues, {
      subcategoryMap,
      activityMap,
      thirdPartyMap,
      projectMap,
      vehicleMap,
      allowDeletedVehicleId: editingId ? transactionEditorInitialForm.vehicleId : "",
    });

    return validationMessage ? `${validationMessage} ❌` : "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const validationMessage = validateTransactionForm(form);
    if (validationMessage) {
      setTransactionEditorError(validationMessage);
      return;
    }

    const referenceValidationMessage = validateTransactionReferences(form);
    if (referenceValidationMessage) {
      setTransactionEditorError(referenceValidationMessage);
      return;
    }

    if (form.type === "depense" && form.isFixedExpense && !String(form.fixedExpenseId || "").trim()) {
      setTransactionEditorError("Selectionnez ou creez un frais fixe avant d'enregistrer cette depense ❌");
      return;
    }

    try {
      setTransactionEditorError("");
      let result;

      const payload = {
        ...buildTransactionPayload(form, defaultAccount?.id || ""),
        subcategoryName: form.subcategoryName || subcategoryMap.get(form.subcategoryId || "")?.name || null,
        activityName: form.activityName || activityMap.get(form.activityId || "")?.name || null,
        thirdPartyName: form.thirdPartyName || thirdPartyMap.get(form.thirdPartyId || "")?.name || null,
        projectName: form.projectName || projectMap.get(form.projectId || "")?.name || null,
      };

      if (editingId) {
        const sourceTransactionId = editingId;
        const classificationPatch = buildChangedClassificationPatch(transactionEditorInitialForm, form);
        result = await updateTransaction(editingId, {
          ...payload,
          updatedAt: new Date().toISOString(),
        });

        if (result.success) {
          setMessage("Transaction mise a jour ✅");

          const similarTransactions = Object.keys(classificationPatch).length > 0
            ? findSimilarTransactions(displayedTransactions, {
              id: sourceTransactionId,
              description: payload.description,
              type: payload.type,
            })
            : [];

          if (similarTransactions.length > 0) {
            const fieldDefinitions = [
              ["categoryId", "Categorie", payload.categoryName || payload.categorie],
              ["subcategoryId", "Sous-categorie", payload.subcategoryName],
              ["thirdPartyId", "Tiers", payload.thirdPartyName],
              ["activityId", "Activite", payload.activityName],
              ["projectId", "Projet", payload.projectName],
              ["accountId", "Compte", getAccountLabel(payload.accountId)],
            ];

            setSimilarClassificationSuggestion({
              transactions: similarTransactions,
              patch: classificationPatch,
              title: payload.description,
              typeLabel: payload.type === "depense" ? "Dépense" : "Revenu",
              periodLabel: TRANSACTION_PERIOD_LABELS[listFilters.period] || listFilters.period,
              fields: fieldDefinitions
                .filter(([key]) => Object.prototype.hasOwnProperty.call(classificationPatch, key))
                .map(([key, label, value]) => ({ key, label, value: value || classificationPatch[key] })),
            });
          }
        } else {
          setTransactionEditorError(result.error || "Erreur lors de la mise a jour ❌");
        }
      } else {
        result = await addTransaction({
          ...payload,
          createdAt: new Date().toISOString(),
        });

        if (result.success) {
          setMessage("Transaction enregistrée dans Firebase ✅");
        } else {
          setTransactionEditorError(result.error || "Erreur lors de l'enregistrement ❌");
        }
      }

      if (result.success) {
        scheduleTransactionEditorScrollRestore();
        setEditingId(null);
        setTransactionEditorOpen(false);
        setTransactionEditorFocusTarget("");
        setIgnoredClassificationSuggestionKey("");
        setAppliedClassificationSuggestionKey("");
        setForm(getInitialForm());
        setTransactionEditorInitialForm(getInitialForm());
        setTransactionEditorError("");
      }
    } catch (catchError) {
      console.error(catchError);
      setTransactionEditorError(editingId ? "Erreur lors de la mise a jour ❌" : "Erreur lors de l'enregistrement ❌");
    }
  }

  function closeSimilarClassificationSuggestion() {
    if (!similarClassificationSubmittingRef.current) {
      setSimilarClassificationSuggestion(null);
    }
  }

  async function handleSimilarClassificationConfirm() {
    const suggestion = similarClassificationSuggestion;
    if (!suggestion || similarClassificationSubmittingRef.current) {
      return;
    }

    similarClassificationSubmittingRef.current = true;
    setSimilarClassificationLoading(true);

    try {
      const result = await bulkUpdateTransactions({
        transactionIds: suggestion.transactions.map((transaction) => transaction.id),
        patch: suggestion.patch,
        transactions: suggestion.transactions,
        catalogs: {
          categoryMap: new Map(categories.map((category) => [category.id, category])),
          subcategoryMap,
          activityMap,
          thirdPartyMap,
          projectMap,
          workProjectMap: new Map(workProjects.map((project) => [project.id, project])),
          accountMap: new Map(accounts.map((account) => [account.id, account])),
        },
      });

      if (result.updatedCount > 0 && result.failedCount === 0) {
        setMessage(`${result.updatedCount} transaction${result.updatedCount > 1 ? "s" : ""} mise${result.updatedCount > 1 ? "s" : ""} à jour. ✅`);
      } else if (result.updatedCount > 0) {
        setMessage(`${result.updatedCount} transaction(s) mise(s) à jour, ${result.failedCount} échec(s) ❌`);
      } else {
        setMessage("Aucune transaction similaire n'a pu être mise a jour ❌");
      }
    } catch (bulkError) {
      console.error(bulkError);
      setMessage("Erreur lors de l'application du classement aux transactions similaires ❌");
    } finally {
      setSimilarClassificationSuggestion(null);
      setSimilarClassificationLoading(false);
      similarClassificationSubmittingRef.current = false;
    }
  }

  async function handleCreateFromDraft(validatedDraftForm) {
    const validationMessage = validateTransactionForm(validatedDraftForm);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    const referenceValidationMessage = validateTransactionReferences(validatedDraftForm);
    if (referenceValidationMessage) {
      setMessage(referenceValidationMessage);
      return;
    }

    try {
      setIsCreatingFromDraft(true);

      const payload = {
        ...buildTransactionPayload(validatedDraftForm, defaultAccount?.id || ""),
        subcategoryName: validatedDraftForm.subcategoryName || subcategoryMap.get(validatedDraftForm.subcategoryId || "")?.name || null,
        activityName: validatedDraftForm.activityName || activityMap.get(validatedDraftForm.activityId || "")?.name || null,
        thirdPartyName: validatedDraftForm.thirdPartyName || thirdPartyMap.get(validatedDraftForm.thirdPartyId || "")?.name || null,
        projectName: validatedDraftForm.projectName || projectMap.get(validatedDraftForm.projectId || "")?.name || null,
      };
      const result = await addTransaction({
        ...payload,
        createdAt: new Date().toISOString(),
      });

      if (result.success) {
        setMessage("Transaction enregistree dans Firebase ✅");
        setDraftDialogOpen(false);
        setDraftTransactionForm(null);
      } else {
        setMessage(result.error || "Erreur lors de l'enregistrement ❌");
      }
    } catch (catchError) {
      console.error(catchError);
      setMessage("Erreur lors de l'enregistrement ❌");
    } finally {
      setIsCreatingFromDraft(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!transactionToDelete) {
      return;
    }

    try {
      const result = await deleteTransaction(transactionToDelete.id);
      if (result.success) {
        setMessage("Transaction supprimée ✅");
      } else {
        setMessage(result.error || "Erreur lors de la suppression ❌");
      }
      closeDeleteDialog();
    } catch (catchError) {
      console.error(catchError);
      setMessage("Erreur lors de la suppression ❌");
      closeDeleteDialog();
    }
  }

  async function handleCreateOrUpdateTransfer(payload) {
    try {
      setTransferSubmitting(true);

      if (editingTransfer?.id) {
        await updateTransferById(editingTransfer.id, payload);
        setMessage("Transfert mis a jour ✅");
      } else {
        await createTransfer(payload);
        setMessage("Transfert enregistre ✅");
      }

      setTransferDialogOpen(false);
      setEditingTransfer(null);
    } catch (transferError) {
      console.error(transferError);
      setMessage("Erreur lors de l'enregistrement du transfert ❌");
    } finally {
      setTransferSubmitting(false);
    }
  }

  async function handleDeleteTransfer(transfer) {
    try {
      await deleteTransferById(transfer.id);
      setMessage("Transfert supprime ✅");
    } catch (transferError) {
      console.error(transferError);
      setMessage("Erreur lors de la suppression du transfert ❌");
    }
  }

  function openCreateTransferDialog() {
    setLegacyTransferSource(null);
    setEditingTransfer(null);
    setTransferDialogOpen(true);
  }

  function openEditTransferDialog(transfer) {
    setLegacyTransferSource(null);
    setEditingTransfer(transfer);
    setTransferDialogOpen(true);
  }

  async function handleConvertLegacyToTransfer(payload) {
    if (!legacyTransferSource) {
      return;
    }

    try {
      setTransferSubmitting(true);
      await createTransfer(payload);
      const deleteResult = await deleteTransaction(legacyTransferSource.id);

      if (!deleteResult?.success) {
        throw new Error(deleteResult?.error || "Erreur lors de l'archivage de la transaction legacy");
      }

      setMessage("Transaction legacy convertie en transfert ✅");
      setLegacyTransferSource(null);
      setTransferDialogOpen(false);
    } catch (legacyError) {
      console.error(legacyError);
      setMessage("Erreur lors de la conversion en transfert ❌");
    } finally {
      setTransferSubmitting(false);
    }
  }

  async function handleReclassifyLegacyTransaction(transaction, nextType) {
    const fallbackCategory = getTransactionCategoryOptions(nextType, transaction?.categoryName || transaction?.categorie || "")[0];

    try {
      const result = await updateTransaction(
        transaction.id,
        buildLegacyReclassificationPayload(transaction, nextType, {
          fallbackCategory,
          defaultAccountId: defaultAccount?.id || "",
        })
      );

      if (!result.success) {
        throw new Error(result.error || "Erreur de reclassement");
      }

      setMessage(`Transaction legacy reclasssee en ${nextType} ✅`);
    } catch (legacyError) {
      console.error(legacyError);
      setMessage("Erreur lors du reclassement legacy ❌");
    }
  }

  async function handleQuickThirdPartyCreate() {
    const trimmedName = quickThirdPartyForm.name.trim();

    if (!trimmedName) {
      setQuickThirdPartyError("Le nom du tiers est obligatoire.");
      return;
    }

    const result = await addThirdParty({
      name: trimmedName,
      type: quickThirdPartyForm.type,
      notes: quickThirdPartyForm.notes,
      isActive: true,
    });

    if (!result.success) {
      setQuickThirdPartyError(result.error || "Erreur lors de la creation du tiers.");
      return;
    }

    if (!consumeImportQuickCreate("thirdParty", { id: result.id, name: trimmedName })) {
      setForm((previous) => ({
        ...previous,
        thirdPartyId: result.id || previous.thirdPartyId,
        thirdPartyName: trimmedName,
      }));
    }

    setQuickThirdPartyOpen(false);
    setQuickThirdPartyForm({ name: "", type: "supplier", notes: "" });
    setQuickThirdPartyError("");
  }

  function consumeImportQuickCreate(kind, entity) {
    const pending = importQuickCreateRef.current;
    if (!pending || pending.kind !== kind) {
      return false;
    }

    pending.onCreated?.(entity);
    importQuickCreateRef.current = null;
    return true;
  }

  function openImportQuickCreate(kind, payload = {}) {
    importQuickCreateRef.current = {
      kind,
      onCreated: payload.onCreated,
    };

    if (kind === "category") {
      openQuickCategoryDialog(payload.type || "depense");
      return;
    }

    if (kind === "subcategory") {
      openQuickSubcategoryDialog(payload.categoryId || "", payload.type || "depense");
      return;
    }

    if (kind === "activity") {
      openQuickActivityDialog();
      return;
    }

    if (kind === "thirdParty") {
      openQuickThirdPartyDialog();
      return;
    }

    if (kind === "project") {
      openQuickProjectDialog(payload.activityId || "");
      return;
    }

    if (kind === "account") {
      openQuickAccountDialog();
    }
  }

  function openQuickCategoryDialog(categoryType = form.type) {
    const safeType = categoryType === "revenu" ? "revenu" : "depense";
    setQuickCategoryDraft({
      name: "",
      type: safeType,
      icon: "",
      color: "#2196F3",
      displayOrder: 0,
    });
    setQuickCategoryOpen(true);
  }

  async function handleQuickCategoryCreate(payload) {
    const result = await addCategory(payload);

    if (!result.success) {
      setTransactionEditorError(result.error || "Erreur lors de la creation de la categorie.");
      return result;
    }

    if (!consumeImportQuickCreate("category", { id: result.id, name: payload.name })) {
      setForm((previous) => ({
        ...previous,
        categorie: payload.name,
        categoryId: result.id || previous.categoryId,
        categoryName: payload.name,
        subcategoryId: "",
        subcategoryName: "",
      }));
    }
    setQuickCategoryOpen(false);
    setQuickCategoryDraft(null);
    setTransactionEditorError("");
    return result;
  }

  function openQuickThirdPartyDialog() {
    setQuickThirdPartyForm({ name: "", type: "supplier", notes: "" });
    setQuickThirdPartyError("");
    setQuickThirdPartyOpen(true);
  }

  function openQuickSubcategoryDialog(categoryId = form.categoryId, categoryType = form.type) {
    const safeCategoryId = String(categoryId || "").trim();
    if (!safeCategoryId) {
      return;
    }

    setQuickSubcategoryForm({
      name: "",
      categoryId: safeCategoryId,
      type: categoryType === "revenu" ? "revenu" : "depense",
    });
    setQuickSubcategoryError("");
    setQuickSubcategoryOpen(true);
  }

  function openQuickAccountDialog() {
    setQuickAccountForm({ name: "", type: "standard", icon: "", color: "#1976d2", initialBalance: "0", displayOrder: "0" });
    setQuickAccountError("");
    setQuickAccountOpen(true);
  }

  async function handleQuickAccountCreate() {
    if (quickAccountSubmittingRef.current) {
      return;
    }

    const trimmedName = quickAccountForm.name.trim();

    if (!trimmedName) {
      setQuickAccountError("Le nom du compte est obligatoire.");
      return;
    }

    const initialBalance = Number(quickAccountForm.initialBalance);
    const displayOrder = Number(quickAccountForm.displayOrder);
    if (Number.isNaN(initialBalance) || Number.isNaN(displayOrder)) {
      setQuickAccountError("Le solde initial et l'ordre d'affichage doivent etre numeriques.");
      return;
    }

    quickAccountSubmittingRef.current = true;
    setQuickAccountSubmitting(true);

    let result;
    try {
      result = await addAccount({
        name: trimmedName,
        type: quickAccountForm.type,
        icon: quickAccountForm.icon.trim(),
        color: quickAccountForm.color.trim() || "#1976d2",
        initialBalance,
        displayOrder,
        isActive: true,
        createdAt: new Date().toISOString(),
      });
    } finally {
      quickAccountSubmittingRef.current = false;
      setQuickAccountSubmitting(false);
    }

    if (!result.success) {
      setQuickAccountError(result.error || "Erreur lors de la creation du compte.");
      return;
    }

    if (!consumeImportQuickCreate("account", { id: result.id, name: trimmedName })) {
      setForm((previous) => ({
        ...previous,
        accountId: result.id || previous.accountId,
      }));
    }
    setQuickAccountOpen(false);
    setQuickAccountForm({ name: "", type: "standard", icon: "", color: "#1976d2", initialBalance: "0", displayOrder: "0" });
    setQuickAccountError("");
  }

  function openQuickActivityDialog() {
    setQuickActivityForm({ name: "", kind: "profit_center" });
    setQuickActivityError("");
    setQuickActivityOpen(true);
  }

  async function handleQuickActivityCreate() {
    const trimmedName = quickActivityForm.name.trim();

    if (!trimmedName) {
      setQuickActivityError("Le nom de l'activite est obligatoire.");
      return;
    }

    const result = await addActivity({
      name: trimmedName,
      kind: quickActivityForm.kind,
      isActive: true,
    });

    if (!result.success) {
      setQuickActivityError(result.error || "Erreur lors de la creation de l'activite.");
      return;
    }

    if (!consumeImportQuickCreate("activity", { id: result.id, name: trimmedName })) {
      setForm((previous) => ({
        ...previous,
        activityId: result.id || previous.activityId,
        activityName: trimmedName,
      }));
    }
    setQuickActivityOpen(false);
    setQuickActivityForm({ name: "", kind: "profit_center" });
    setQuickActivityError("");
  }

  function openQuickProjectDialog(activityId = form.activityId) {
    setQuickProjectForm({ name: "", activityId: activityId || "", startDate: "", endDate: "", notes: "" });
    setQuickProjectError("");
    setQuickProjectOpen(true);
  }

  function openQuickCategoryFromBulk(payload = {}) {
    const normalizedPayload = typeof payload === "string" ? { type: payload } : payload;
    openImportQuickCreate("category", normalizedPayload || {});
  }

  function openQuickSubcategoryFromBulk(payload = {}) {
    if (typeof payload === "string") {
      openImportQuickCreate("subcategory", { categoryId: payload, type: "depense" });
      return;
    }

    openImportQuickCreate("subcategory", payload || {});
  }

  function openQuickActivityFromBulk(payload = {}) {
    openImportQuickCreate("activity", payload || {});
  }

  function openQuickThirdPartyFromBulk(payload = {}) {
    openImportQuickCreate("thirdParty", payload || {});
  }

  function openQuickProjectFromBulk(payload = {}) {
    if (typeof payload === "string") {
      openImportQuickCreate("project", { activityId: payload });
      return;
    }

    openImportQuickCreate("project", payload || {});
  }

  function openQuickAccountFromBulk(payload = {}) {
    openImportQuickCreate("account", payload || {});
  }

  function openQuickFixedExpenseDialog(sourceTransactions = [], sourceForm = null) {
    const selectedSourceForm = sourceForm || buildFixedExpenseDraftFromTransactions(sourceTransactions);
    const sourceTransactionIds = (Array.isArray(sourceTransactions) ? sourceTransactions : []).map((transaction) => transaction?.id).filter(Boolean);

    setQuickFixedExpenseSourceForm({
      ...getInitialForm(),
      ...selectedSourceForm,
      type: "depense",
      montant: String(selectedSourceForm.initialAmount ?? selectedSourceForm.montant ?? form.montant ?? ""),
    });
    setQuickFixedExpenseSourceTransactionIds(sourceTransactionIds);
    setQuickFixedExpenseApplyClassificationToSource(sourceTransactionIds.length > 0);
    setQuickFixedExpenseAutoFocusSelector('input[name="quick-fixed-expense-name"]');
    setQuickFixedExpenseForm({
      name: selectedSourceForm.name || form.description || "",
      frequency: selectedSourceForm.frequency || "monthly",
      startDate: selectedSourceForm.startDate || form.date || new Date().toISOString().slice(0, 10),
      endDate: selectedSourceForm.endDate || "",
      description: selectedSourceForm.description || "",
    });
    setQuickFixedExpenseError("");
    setQuickFixedExpenseOpen(true);
  }

  function buildQuickFixedExpenseClassificationPatch(source = quickFixedExpenseSourceForm) {
    const categoryName = String(source.categoryName || source.categorie || "").trim();
    const patch = {
      subcategoryId: source.subcategoryId || null,
      subcategoryName: source.subcategoryName || null,
      thirdPartyId: source.thirdPartyId || null,
      activityId: source.activityId || null,
      projectId: source.projectId || null,
    };

    if (source.categoryId) {
      patch.categoryId = source.categoryId;
      patch.categoryName = categoryName;
      patch.categorie = categoryName;
    }

    return patch;
  }

  function requestQuickFixedExpenseReferenceCreate(kind, payload = {}) {
    const focusSelectorByKind = {
      category: 'input[name="quick-fixed-expense-category"]',
      subcategory: 'input[name="quick-fixed-expense-subcategory"]',
      thirdParty: 'input[name="quick-fixed-expense-third-party"]',
      activity: 'input[name="quick-fixed-expense-activity"]',
      project: 'input[name="quick-fixed-expense-project"]',
    };

    openImportQuickCreate(kind, {
      ...payload,
      onCreated: (entity = {}) => {
        if (kind === "category") {
          const nextName = entity.name || "";
          setQuickFixedExpenseSourceForm((previous) => ({
            ...previous,
            categoryId: entity.id || "",
            categoryName: nextName,
            categorie: nextName,
            subcategoryId: "",
            subcategoryName: "",
          }));
          setQuickFixedExpenseAutoFocusSelector(focusSelectorByKind.subcategory);
          return;
        }

        if (kind === "subcategory") {
          setQuickFixedExpenseSourceForm((previous) => ({
            ...previous,
            subcategoryId: entity.id || "",
            subcategoryName: entity.name || "",
          }));
          setQuickFixedExpenseAutoFocusSelector(focusSelectorByKind.subcategory);
          return;
        }

        if (kind === "thirdParty") {
          setQuickFixedExpenseSourceForm((previous) => ({
            ...previous,
            thirdPartyId: entity.id || "",
            thirdPartyName: entity.name || "",
          }));
          setQuickFixedExpenseAutoFocusSelector(focusSelectorByKind.thirdParty);
          return;
        }

        if (kind === "activity") {
          setQuickFixedExpenseSourceForm((previous) => {
            const nextActivityId = entity.id || "";
            const nextActivityName = entity.name || "";
            const shouldClearProject = previous.projectId
              && projectMap.get(previous.projectId)?.activityId
              && projectMap.get(previous.projectId)?.activityId !== nextActivityId;

            return {
              ...previous,
              activityId: nextActivityId,
              activityName: nextActivityName,
              ...(shouldClearProject ? { projectId: "", projectName: "" } : {}),
            };
          });
          setQuickFixedExpenseAutoFocusSelector(focusSelectorByKind.activity);
          return;
        }

        if (kind === "project") {
          setQuickFixedExpenseSourceForm((previous) => ({
            ...previous,
            projectId: entity.id || "",
            projectName: entity.name || "",
          }));
          setQuickFixedExpenseAutoFocusSelector(focusSelectorByKind.project);
        }
      },
    });
  }

  function handleQuickFixedExpenseSourceChange(event) {
    const { name, value } = event.target;
    const fieldName = {
      "quick-fixed-expense-category": "categoryId",
      "quick-fixed-expense-subcategory": "subcategoryId",
      "quick-fixed-expense-third-party": "thirdPartyId",
      "quick-fixed-expense-activity": "activityId",
      "quick-fixed-expense-project": "projectId",
    }[name] || name;

    if (fieldName === "categoryId" && value === CREATE_CATEGORY_VALUE) {
      requestQuickFixedExpenseReferenceCreate("category", { type: "depense" });
      return;
    }

    if (fieldName === "subcategoryId" && value === CREATE_SUBCATEGORY_VALUE) {
      if (quickFixedExpenseSourceForm.categoryId) {
        requestQuickFixedExpenseReferenceCreate("subcategory", {
          categoryId: quickFixedExpenseSourceForm.categoryId,
          type: "depense",
        });
      }
      return;
    }

    if (fieldName === "thirdPartyId" && value === CREATE_THIRD_PARTY_VALUE) {
      requestQuickFixedExpenseReferenceCreate("thirdParty");
      return;
    }

    if (fieldName === "activityId" && value === CREATE_ACTIVITY_VALUE) {
      requestQuickFixedExpenseReferenceCreate("activity");
      return;
    }

    if (fieldName === "projectId" && value === CREATE_PROJECT_VALUE) {
      requestQuickFixedExpenseReferenceCreate("project", { activityId: quickFixedExpenseSourceForm.activityId || "" });
      return;
    }

    setQuickFixedExpenseSourceForm((previous) => {
      if (fieldName === "categoryId") {
        const category = quickFixedExpenseCategoryOptions.find((item) => (item.id || item.name) === value);
        const categoryName = category?.name || "";
        return {
          ...previous,
          categoryId: category?.id || "",
          categoryName,
          categorie: categoryName,
          subcategoryId: "",
          subcategoryName: "",
        };
      }

      if (fieldName === "subcategoryId") {
        const subcategory = quickFixedExpenseSubcategoryOptions.find((item) => item.id === value);
        return {
          ...previous,
          subcategoryId: value,
          subcategoryName: subcategory?.name || "",
        };
      }

      if (fieldName === "thirdPartyId") {
        const thirdParty = quickFixedExpenseThirdPartyOptions.find((item) => item.id === value);
        return {
          ...previous,
          thirdPartyId: value,
          thirdPartyName: thirdParty?.name || "",
        };
      }

      if (fieldName === "activityId") {
        const activity = quickFixedExpenseActivityOptions.find((item) => item.id === value);
        const shouldClearProject = previous.projectId
          && projectMap.get(previous.projectId)?.activityId
          && projectMap.get(previous.projectId)?.activityId !== value;

        return {
          ...previous,
          activityId: value,
          activityName: activity?.name || "",
          ...(shouldClearProject ? { projectId: "", projectName: "" } : {}),
        };
      }

      if (fieldName === "projectId") {
        const project = quickFixedExpenseProjectOptions.find((item) => item.id === value);
        return {
          ...previous,
          projectId: value,
          projectName: project?.name || "",
        };
      }

      return previous;
    });
  }

  function requestQuickFixedExpenseCreation(sourcePayload = []) {
    const sourceTransactions = Array.isArray(sourcePayload)
      ? sourcePayload
      : [sourcePayload?.sourceRow, ...(Array.isArray(sourcePayload?.selectedRows) ? sourcePayload.selectedRows : [])].filter(Boolean);
    const sourceForm = Array.isArray(sourcePayload) ? null : (sourcePayload?.sourceForm || null);

    return new Promise((resolve) => {
      quickFixedExpenseCreateResolverRef.current = resolve;
      openQuickFixedExpenseDialog(sourceTransactions, sourceForm || buildFixedExpenseDraftFromTransactions(sourceTransactions));
    });
  }

  async function handleQuickFixedExpenseCreate() {
    console.log("[CREATE FIXED]", "service =", "Transactions");
    console.log("[CREATE FIXED]", "function =", "handleQuickFixedExpenseCreate");
    if (quickFixedExpenseSubmittingRef.current) {
      return;
    }

    if (quickFixedExpenseSourceForm.type !== "depense") {
      setQuickFixedExpenseError("Un frais fixe ne peut etre cree que pour une depense.");
      return;
    }

    if (!String(quickFixedExpenseForm.name || "").trim()) {
      setQuickFixedExpenseError("Le nom du frais fixe est obligatoire.");
      return;
    }

    if (!quickFixedExpenseSourceForm.categoryId && !String(quickFixedExpenseSourceForm.categoryName || quickFixedExpenseSourceForm.categorie || "").trim()) {
      setQuickFixedExpenseError("Sélectionnez une categorie de dépense avant de créer un frais fixe.");
      return;
    }

    if (!String(quickFixedExpenseSourceForm.accountId || "").trim()) {
      setQuickFixedExpenseError("Sélectionnez un compte avant de créer un frais fixe.");
      return;
    }

    if (!(Number(quickFixedExpenseSourceForm.montant) > 0)) {
      setQuickFixedExpenseError("Le montant de la depense doit etre superieur a 0.");
      return;
    }

    const payload = buildQuickFixedExpensePayload(quickFixedExpenseSourceForm, quickFixedExpenseForm);
    quickFixedExpenseSubmittingRef.current = true;
    setQuickFixedExpenseSubmitting(true);
    console.log("[CREATE FIXED]", "next =", "addFixedExpense(payload)");
    const result = await addFixedExpense(payload);
    quickFixedExpenseSubmittingRef.current = false;
    setQuickFixedExpenseSubmitting(false);

    if (!result.success) {
      setQuickFixedExpenseError(result.existingId
        ? "Une fiche compatible existe déjà. Fermez ce dialogue et sélectionnez-la dans la liste."
        : (result.error || "Erreur lors de la creation du frais fixe."));
      return;
    }

    setForm((previous) => ({
      ...previous,
      isFixedExpense: true,
      fixedExpenseId: result.id || previous.fixedExpenseId,
    }));

    if (quickFixedExpenseSourceTransactionIds.length > 0) {
      await associateTransactionsWithFixedExpense({
        transactionIds: quickFixedExpenseSourceTransactionIds,
        fixedExpenseId: result.id,
      });

      if (quickFixedExpenseApplyClassificationToSource) {
        const propagationResult = await bulkUpdateTransactions({
          transactionIds: quickFixedExpenseSourceTransactionIds,
          patch: buildQuickFixedExpenseClassificationPatch(quickFixedExpenseSourceForm),
          transactions,
          catalogs: {
            categories,
            categoryMap: new Map(categories.map((category) => [category.id, category])),
            subcategoryMap,
            activityMap,
            thirdPartyMap,
            projectMap,
          },
          clearIncompatibleSubcategories: true,
        });

        if (propagationResult.failedCount > 0) {
          setMessage(`Frais fixe créé ✅ Classement appliqué à ${propagationResult.updatedCount} transaction(s), ${propagationResult.failedCount} en échec.`);
        } else {
          setMessage(`Frais fixe créé ✅ Classement appliqué à ${propagationResult.updatedCount} transaction(s).`);
        }
      }
    }

    if (quickFixedExpenseCreateResolverRef.current) {
      quickFixedExpenseCreateResolverRef.current(result.id || "");
      quickFixedExpenseCreateResolverRef.current = null;
    }

    setQuickFixedExpenseOpen(false);
    setQuickFixedExpenseForm({ name: "", frequency: "monthly", startDate: "", endDate: "", description: "" });
    setQuickFixedExpenseSourceTransactionIds([]);
    setQuickFixedExpenseApplyClassificationToSource(true);
    setQuickFixedExpenseSourceForm(getInitialForm());
    setQuickFixedExpenseAutoFocusSelector('input[name="quick-fixed-expense-name"]');
    setQuickFixedExpenseError("");
  }

  async function handleQuickProjectCreate() {
    const trimmedName = quickProjectForm.name.trim();

    if (!trimmedName) {
      setQuickProjectError("Le nom du projet est obligatoire.");
      return;
    }

    const result = await addProject({
      name: trimmedName,
      activityId: quickProjectForm.activityId || null,
      startDate: quickProjectForm.startDate || null,
      endDate: quickProjectForm.endDate || null,
      notes: quickProjectForm.notes,
      isActive: true,
    });

    if (!result.success) {
      setQuickProjectError(result.error || "Erreur lors de la creation du projet.");
      return;
    }

    if (!consumeImportQuickCreate("project", { id: result.id, name: trimmedName })) {
      setForm((previous) => ({
        ...previous,
        projectId: result.id || previous.projectId,
        projectName: trimmedName,
      }));
    }
    setQuickProjectOpen(false);
    setQuickProjectForm({ name: "", activityId: "", startDate: "", endDate: "", notes: "" });
    setQuickProjectError("");
  }

  async function handleQuickSubcategoryCreate() {
    const trimmedName = quickSubcategoryForm.name.trim();

    if (!trimmedName) {
      setQuickSubcategoryError("Le nom de la sous-categorie est obligatoire.");
      return;
    }

    if (!quickSubcategoryForm.categoryId) {
      setQuickSubcategoryError("La categorie de rattachement est obligatoire.");
      return;
    }

    const result = await addSubcategory({
      name: trimmedName,
      categoryId: quickSubcategoryForm.categoryId,
      type: quickSubcategoryForm.type,
      isActive: true,
    });

    if (!result.success) {
      setQuickSubcategoryError(result.error || "Erreur lors de la creation de la sous-categorie.");
      return;
    }

    if (!consumeImportQuickCreate("subcategory", { id: result.id, name: trimmedName })) {
      setForm((previous) => ({
        ...previous,
        subcategoryId: result.id || previous.subcategoryId,
        subcategoryName: trimmedName,
      }));
    }

    setQuickSubcategoryOpen(false);
    setQuickSubcategoryForm({ name: "", categoryId: "", type: "depense" });
    setQuickSubcategoryError("");
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
  }

  function openPeriodMenu(event) {
    setPeriodMenuAnchor(event.currentTarget);
  }

  function closePeriodMenu() {
    setPeriodMenuAnchor(null);
  }

  function handleQuickPeriodChange(period) {
    const nextPeriod = period || "currentMonth";
    setListFilters((previous) => ({
      ...previous,
      period: nextPeriod,
      transactionIds: [],
    }));
    setTrendPeriod(nextPeriod);
    closePeriodMenu();
  }

  const compactToolbarButtonMinHeight = 44;
  const commandBarTransition = `opacity ${transitions.fast}, transform ${transitions.fast}`;
  const smartHeaderKpiOpacity = Math.max(0, 1 - smartHeaderCollapseProgress * 1.35);
  const smartHeaderKpiMaxHeight = Math.max(0, Math.round(136 * (1 - smartHeaderCollapseProgress)));
  const selectionSummaryNetTone = selectedTransactionsSummary.net >= 0 ? colors.status.success : colors.status.danger;
  const compactToolbarActionPaddingX = spacing.sm;
  const currentPeriodLabel = TRANSACTION_PERIOD_LABELS[listFilters.period] || "Mois courant";

  return (
    <Box>
      <AppHeader
        title="Transactions"
        mobileCountLabel={`${displayedTransactions.length} affichée(s)`}
        mobilePrimaryActionLabel="Ajouter"
        onMobilePrimaryAction={openCreateTransactionDialog}
      />

      {message && (
        <AppAlert severity={message.includes("Erreur") ? "error" : "success"} sx={{ mb: 1.25 }}>
          {message}
        </AppAlert>
      )}

      {error && (
        <AppAlert severity="error" sx={{ mb: 1.25 }}>
          {error}
        </AppAlert>
      )}

      <AppStickyPanel
        ariaLabel="En-tête intelligent des transactions"
        className="transactions-smart-sticky-header"
        summary={(
          <AppKpiGrid
            ariaHidden={smartHeaderKpiMaxHeight <= 10}
            wrapperSx={{
              overflow: "hidden",
              maxHeight: `${smartHeaderKpiMaxHeight}px`,
              opacity: smartHeaderKpiOpacity,
              transform: `translateY(${Math.round(-10 * smartHeaderCollapseProgress)}px)`,
              transformOrigin: "top center",
              transition: "max-height 260ms ease, opacity 180ms ease, transform 220ms ease, margin-bottom 220ms ease",
              mb: smartHeaderKpiMaxHeight > 10 ? 0.8 : 0,
            }}
            items={[
              { label: "Transactions", value: displayedTransactionsSummary.count, tone: "#172a2f" },
              { label: "Dépenses", value: formatSummaryAmount(displayedTransactionsSummary.expenses), tone: "#c24135" },
              { label: "Revenus", value: formatSummaryAmount(displayedTransactionsSummary.revenues), tone: "#147d64" },
              { label: "Net", value: formatSummaryAmount(displayedTransactionsSummary.net), tone: displayedTransactionsSummary.net >= 0 ? "#147d64" : "#c24135" },
            ]}
          />
        )}
        toolbar={(
          <CompactToolbarLayout className="v2-card transactions-compact-toolbar transactions-toolbar-core" label="Toolbar transactions reconstruite">
              <AppToolbarSearchField
                value={listFilters.searchText}
                onChange={handleListFilterChange}
                placeholder="Rechercher une transaction..."
                ariaLabel="Rechercher une transaction"
                buttonSize={compactToolbarButtonMinHeight}
                onOpenSecondaryTools={openSecondaryActionsMenu}
              />

              {selectionMode ? (
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={0.6}
                  sx={{ alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between" }}
                >
                  <SecondaryButton
                    type="button"
                    onClick={exitSelectionMode}
                    disabled={bulkOperationLoading}
                    aria-label="Annuler le mode sélection"
                    style={{ minHeight: compactToolbarButtonMinHeight, paddingInline: compactToolbarActionPaddingX }}
                  >
                    <Close fontSize="small" />
                    Annuler
                  </SecondaryButton>
                  <Typography variant="body2" sx={{ fontWeight: 800, color: "#172a2f" }} aria-live="polite">
                    {selectedTransactionsCount} transaction(s) sélectionnée(s)
                  </Typography>
                </Stack>
              ) : (
                <Stack direction="row" spacing={0.6} sx={{ width: "100%" }} aria-label="Actions principales des transactions">
                  <PrimaryButton
                    type="button"
                    onClick={openCreateTransactionDialog}
                    aria-label="Ajouter une transaction"
                    style={{ minHeight: compactToolbarButtonMinHeight, paddingInline: compactToolbarActionPaddingX, flex: 1 }}
                  >
                    <Add fontSize="small" />
                    Ajouter une transaction
                  </PrimaryButton>
                  <SecondaryButton
                    type="button"
                    onClick={openSelectionMode}
                    aria-label="Activer le mode sélection"
                    style={{ minHeight: compactToolbarButtonMinHeight, paddingInline: compactToolbarActionPaddingX, flex: 1 }}
                  >
                    <CheckBoxOutlined fontSize="small" />
                    Sélection
                  </SecondaryButton>
                </Stack>
              )}

              <Stack direction="row" spacing={0.6} sx={{ width: "100%" }} aria-label="Filtres Tri Période">
                <SecondaryButton
                  type="button"
                  onClick={openFiltersDialog}
                  aria-label="Ouvrir les filtres"
                  style={{ minHeight: compactToolbarButtonMinHeight, paddingInline: compactToolbarActionPaddingX, flex: 1 }}
                >
                  <FilterList fontSize="small" />
                  {filtersToggleLabel}
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  onClick={openSortDialog}
                  aria-label="Ouvrir le tri"
                  style={{ minHeight: compactToolbarButtonMinHeight, paddingInline: compactToolbarActionPaddingX, flex: 1 }}
                >
                  <Sort fontSize="small" />
                  Tri
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  onClick={openPeriodMenu}
                  aria-label={`Choisir la période (${currentPeriodLabel})`}
                  style={{ minHeight: compactToolbarButtonMinHeight, paddingInline: compactToolbarActionPaddingX, flex: 1 }}
                >
                  {isMobileTransactionsView ? "Période" : `Période: ${currentPeriodLabel}`}
                </SecondaryButton>
              </Stack>
          </CompactToolbarLayout>
        )}
        footer={selectionMode ? (
          <ActionBar className="v2-card transactions-compact-toolbar-actions" unstyled label="Actions de sélection des transactions">
            <Stack spacing={0.85} sx={{ width: "100%", transition: commandBarTransition }}>
              <Card
                variant="outlined"
                sx={{ borderRadius: `${radius.sm}px`, borderColor: "rgba(15, 118, 110, 0.25)", bgcolor: "rgba(240, 253, 250, 0.6)" }}
                aria-live="polite"
                aria-label="Résumé de la sélection"
              >
                <CardContent sx={{ py: 0.85, px: 1.1, "&:last-child": { pb: 0.85 } }}>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={{ xs: 0.3, sm: 1.2 }} sx={{ flexWrap: "wrap" }}>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: "#0f3f3c" }}>
                      {selectedTransactionsSummary.count} transaction(s) sélectionnée(s)
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: colors.status.danger }}>
                      Dépenses: {formatSummaryAmount(selectedTransactionsSummary.expenses)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: colors.status.success }}>
                      Revenus: {formatSummaryAmount(selectedTransactionsSummary.revenues)}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: selectionSummaryNetTone }}>
                      Net: {formatSummaryAmount(selectedTransactionsSummary.net)}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>

              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={0.6}
                sx={{ width: "100%" }}
                aria-label="Actions de sélection rapides"
              >
                {(isSelectionEmpty || isSelectionPartial) && (
                  <SecondaryButton
                    type="button"
                    onClick={selectDisplayedTransactions}
                    disabled={bulkOperationLoading || displayedTransactionsCount === 0}
                    aria-label="Tout sélectionner les transactions affichées"
                    style={{ minHeight: compactToolbarButtonMinHeight, paddingInline: compactToolbarActionPaddingX }}
                  >
                    Tout sélectionner
                  </SecondaryButton>
                )}

                {(isSelectionPartial || isSelectionComplete) && (
                  <SecondaryButton
                    type="button"
                    onClick={deselectAllTransactions}
                    disabled={bulkOperationLoading || displayedTransactionsCount === 0}
                    aria-label="Tout désélectionner les transactions affichées"
                    style={{ minHeight: compactToolbarButtonMinHeight, paddingInline: compactToolbarActionPaddingX }}
                  >
                    Tout désélectionner
                  </SecondaryButton>
                )}
              </Stack>

              <Stack direction="row" spacing={0.6} sx={{ flexWrap: "wrap", width: "100%" }}>
                <SecondaryButton
                  type="button"
                  onClick={() => openBulkEditDialog("advanced")}
                  disabled={bulkOperationLoading || selectedTransactionsCount === 0}
                  aria-label="Modifier les transactions sélectionnées"
                  style={{ minHeight: compactToolbarButtonMinHeight, paddingInline: compactToolbarActionPaddingX }}
                >
                  <Edit fontSize="small" />
                  Modifier
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  onClick={() => openBulkEditDialog("classification")}
                  disabled={bulkOperationLoading || selectedTransactionsCount === 0}
                  aria-label="Classer les transactions sélectionnées"
                  style={{ minHeight: compactToolbarButtonMinHeight, paddingInline: compactToolbarActionPaddingX }}
                >
                  <Label fontSize="small" />
                  Classer
                </SecondaryButton>
                <SecondaryButton
                  type="button"
                  onClick={() => openQuickFixedExpenseDialog(resolveVisibleSelectedTransactions(selectedTransactionIds, displayedTransactions))}
                  disabled={bulkOperationLoading || selectedTransactionsCount === 0}
                  aria-label="Créer un frais fixe depuis la sélection"
                  style={{ minHeight: compactToolbarButtonMinHeight, paddingInline: compactToolbarActionPaddingX }}
                >
                  <LinkIcon fontSize="small" />
                  Créer un frais fixe
                </SecondaryButton>
                <DangerButton
                  type="button"
                  onClick={openBulkDeleteDialog}
                  disabled={bulkOperationLoading || selectedTransactionsCount === 0}
                  aria-label="Supprimer les transactions sélectionnées"
                  style={{ minHeight: compactToolbarButtonMinHeight, paddingInline: compactToolbarActionPaddingX }}
                >
                  <Delete fontSize="small" />
                  Supprimer
                </DangerButton>
              </Stack>
            </Stack>
          </ActionBar>
        ) : null}
      />

      {legacyTransactionsCount > 0 && (
        <AppAlert severity="warning" sx={{ mb: 1.25 }}>
          {legacyTransactionsCount} transaction(s) legacy avec un type non supporte (ex: virement/transfer/transfert) detectee(s). Elles sont conservees, affichees et a revoir, mais exclues des analyses revenus/depenses.
        </AppAlert>
      )}

      {showFilterTransactionIdsHint && (
        <AppAlert severity="info" sx={{ mb: 1.25 }}>
          Filtre affine par transactions correspondantes applique.
        </AppAlert>
      )}

      <AppFilterDialog
        open={filtersDialogOpen}
        onClose={closeFiltersDialog}
        fullScreen={isMobileTransactionsView}
        maxWidth="md"
        ariaLabelledby="transaction-filters-title"
        onCancel={closeFiltersDialog}
        onReset={resetFiltersDialog}
        onApply={applyFiltersDialog}
      >
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, mt: 0.5 }}>
            <TextField
              label="Periode"
              name="period"
              select
              size="small"
              value={filtersDraft.period}
              onChange={handleFiltersDraftChange}
              fullWidth
            >
              <MenuItem value="currentMonth">Mois courant</MenuItem>
              <MenuItem value="previousMonth">Mois precedent</MenuItem>
              <MenuItem value="last3Months">3 derniers mois</MenuItem>
              <MenuItem value="currentYear">Annee en cours</MenuItem>
            </TextField>

            <TextField
              label="Type"
              name="type"
              select
              size="small"
              value={filtersDraft.type}
              onChange={handleFiltersDraftChange}
              fullWidth
            >
              <MenuItem value="all">Tous</MenuItem>
              <MenuItem value="depense">Dépenses</MenuItem>
              <MenuItem value="revenu">Revenus</MenuItem>
            </TextField>

            <TextField
              label="Compte"
              name="accountId"
              select
              size="small"
              value={filtersDraft.accountId}
              onChange={handleFiltersDraftChange}
              fullWidth
            >
              <MenuItem value="all">Tous les comptes</MenuItem>
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>{account.name}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Categorie"
              name="categoryFilter"
              select
              size="small"
              value={draftCategoryFilterValue}
              onChange={handleFiltersDraftChange}
              fullWidth
            >
              <MenuItem value="all">Toutes les categories</MenuItem>
              <MenuItem value="id:__uncategorized__">Sans catégorie</MenuItem>
              {filterCategoryOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Sous-categorie"
              name="subcategoryId"
              select
              size="small"
              value={draftSubcategoryFilterValue}
              onChange={handleFiltersDraftChange}
              fullWidth
            >
              <MenuItem value="all">Toutes</MenuItem>
              {subcategoryFilterOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Activite"
              name="activityId"
              select
              size="small"
              value={draftActivityFilterValue}
              onChange={handleFiltersDraftChange}
              fullWidth
            >
              <MenuItem value="all">Toutes</MenuItem>
              {activityFilterOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Tiers"
              name="thirdPartyId"
              select
              size="small"
              value={draftThirdPartyFilterValue}
              onChange={handleFiltersDraftChange}
              fullWidth
            >
              <MenuItem value="all">Tous</MenuItem>
              {thirdPartyFilterOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              label="Projet"
              name="projectId"
              select
              size="small"
              value={draftProjectFilterValue}
              onChange={handleFiltersDraftChange}
              fullWidth
            >
              <MenuItem value="all">Tous</MenuItem>
              {projectFilterOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>
          </Box>
      </AppFilterDialog>

      <AppSortDialog
        open={sortDialogOpen}
        onClose={closeSortDialog}
        onCloseAction={closeSortDialog}
        onReset={resetSortDialog}
      >
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: "1fr", mt: 0.5 }}>
            <TextField
              label="Trier par"
              name="field"
              select
              size="small"
              value={sortDraft.field}
              onChange={handleSortDraftChange}
              fullWidth
            >
              <MenuItem value="date">Date</MenuItem>
              <MenuItem value="amount">Montant</MenuItem>
              <MenuItem value="description">Description</MenuItem>
              <MenuItem value="category">Categorie</MenuItem>
              <MenuItem value="account">Compte</MenuItem>
              <MenuItem value="type">Type</MenuItem>
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
              <MenuItem value="desc">Decroissant</MenuItem>
              <MenuItem value="asc">Croissant</MenuItem>
            </TextField>
          </Box>
      </AppSortDialog>

      {!selectionMode && (
        <Box sx={{ mb: 1.5 }}>
        {!loading && hasTrendValues && (
          <IncomeExpenseTrendChart
            data={trendData}
            title={
              trendPeriod === "currentYear"
                ? "Evolution mensuelle des revenus et depenses"
                : "Evolution hebdomadaire des revenus et depenses"
            }
          />
        )}

        {!loading && !hasTrendValues && (
          <AppAlert severity="info" sx={{ py: 0.5 }}>
            Aucune donnée suffisante pour afficher l'evolution sur cette periode.
          </AppAlert>
        )}
        </Box>
      )}

      {loading && (
        <LoadingMessageCard
          title="Chargement des transactions..."
          description="Preparation de la liste et des filtres."
        />
      )}

      {!loading && displayedTransactions.length === 0 && <ResultsEmptyCard title="Aucune transaction a afficher" description="Ajustez la recherche ou les filtres pour retrouver des mouvements." />}

      <Box sx={{ pt: selectionMode ? { xs: 1.5, sm: 2 } : 0 }}>
        {displayedTransactions.map((transaction) => (
          <TransactionCard
            key={transaction.id}
            transaction={transaction}
            getAccountLabel={getAccountLabel}
            categoryMeta={getTransactionCategoryMeta(transaction)}
            subcategory={transaction.subcategoryId ? subcategoryMap.get(transaction.subcategoryId) : null}
            activity={transaction.activityId ? activityMap.get(transaction.activityId) : null}
            thirdParty={transaction.thirdPartyId ? thirdPartyMap.get(transaction.thirdPartyId) : null}
            project={transaction.projectId ? projectMap.get(transaction.projectId) : null}
            selectionMode={selectionMode}
            selected={selectedTransactionIds.includes(transaction.id)}
            onSelectionToggle={() => toggleTransactionSelection(transaction.id)}
            onEditClick={() => handleEdit(transaction)}
            onFieldDoubleClick={(focusTarget) => handleEdit(transaction, { focusTarget })}
            onMenuClick={(event) => openActionMenu(event, transaction)}
            enableDoubleClickEdit={enableDesktopDoubleClickEdit}
          />
        ))}
      </Box>

      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={closeActionMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        {!actionMenuTransaction?.isAdjustment && (
        <MenuItem
          onClick={() => {
            if (!actionMenuTransaction) {
              closeActionMenu();
              return;
            }

            handleEdit(actionMenuTransaction);
            closeActionMenu();
          }}
        >
          Modifier
        </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            if (!actionMenuTransaction) {
              closeActionMenu();
              return;
            }

            openDeleteDialog(actionMenuTransaction);
            closeActionMenu();
          }}
          sx={{ color: "error.main" }}
        >
          Supprimer
        </MenuItem>
      </Menu>

      <Menu
        anchorEl={secondaryActionsAnchor}
        open={Boolean(secondaryActionsAnchor)}
        onClose={closeSecondaryActionsMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={() => closeSecondaryActionsAndOpen(() => setReceiptUploaderDialogOpen(true))}>Ajouter depuis ticket</MenuItem>
        <MenuItem onClick={() => closeSecondaryActionsAndOpen(() => setBankImportOpen(true))}>Importer un releve bancaire</MenuItem>
        <MenuItem onClick={() => closeSecondaryActionsAndOpen(() => setImportHistoryDialogOpen(true))}>Historique des imports</MenuItem>
        <MenuItem onClick={() => closeSecondaryActionsAndOpen(() => setTransfersDialogOpen(true))}>Transfert entre comptes</MenuItem>
        <MenuItem
          onClick={() => closeSecondaryActionsAndOpen(() => {
            if (!voiceAvailable && voiceStatus !== "listening") {
              return;
            }

            if (voiceStatus === "listening") {
              stopVoiceRecognition();
            } else {
              startVoiceRecognition();
            }
          })}
          disabled={!voiceAvailable && voiceStatus !== "listening"}
        >
          {voiceStatus === "listening" ? "Arreter la saisie vocale" : "Saisie vocale"}
        </MenuItem>
        {legacyTransactions.length > 0 && (
          <MenuItem onClick={() => closeSecondaryActionsAndOpen(() => setLegacyReviewDialogOpen(true))}>
            Revue des transactions legacy
          </MenuItem>
        )}
      </Menu>

      <Menu
        anchorEl={periodMenuAnchor}
        open={Boolean(periodMenuAnchor)}
        onClose={closePeriodMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <MenuItem selected={listFilters.period === "currentMonth"} onClick={() => handleQuickPeriodChange("currentMonth")}>
          Mois courant
        </MenuItem>
        <MenuItem selected={listFilters.period === "previousMonth"} onClick={() => handleQuickPeriodChange("previousMonth")}>
          Mois précédent
        </MenuItem>
        <MenuItem selected={listFilters.period === "currentYear"} onClick={() => handleQuickPeriodChange("currentYear")}>
          Année en cours
        </MenuItem>
        <MenuItem selected={listFilters.period === "last3Months"} onClick={() => handleQuickPeriodChange("last3Months")}>
          3 derniers mois
        </MenuItem>
      </Menu>

      <Dialog open={receiptUploaderDialogOpen} onClose={() => setReceiptUploaderDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Ajouter depuis ticket</DialogTitle>
        <DialogContent>
          <TransactionReceiptUploader
            onDraftReady={handleReceiptDraftReady}
            onError={handleReceiptDraftError}
            autoOpenTrigger={openReceiptImportRequestId}
            availableCategories={receiptAvailableCategories}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceiptUploaderDialogOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={importHistoryDialogOpen} onClose={() => setImportHistoryDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Historique des imports</DialogTitle>
        <DialogContent>
          <ImportHistorySection accounts={accounts} transactions={transactions} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportHistoryDialogOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={transfersDialogOpen} onClose={() => setTransfersDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Transferts entre comptes</DialogTitle>
        <DialogContent>
          {transfersLoading && (
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              Chargement des transferts...
            </Typography>
          )}

          {!transfersLoading && transfers.length === 0 && (
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              Aucun transfert enregistre.
            </Typography>
          )}

          <Stack spacing={1} sx={{ mt: 0.5 }}>
            {transfers.map((transfer) => (
              <Box
                key={transfer.id}
                onDoubleClick={(event) => {
                  if (!enableDesktopDoubleClickEdit || event.target.closest("button, a, input, textarea, select, [role='button']")) return;
                  openEditTransferDialog(transfer);
                }}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 1.25,
                  cursor: enableDesktopDoubleClickEdit ? "pointer" : "default",
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {transfer.date} • {getAccountLabel(transfer.sourceAccountId)} → {getAccountLabel(transfer.destinationAccountId)} • {Number(transfer.amount || 0).toFixed(2)} €
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                  {transfer.description || "Sans description"}
                </Typography>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75}>
                  <Button size="small" variant="outlined" onClick={() => openEditTransferDialog(transfer)}>Modifier</Button>
                  <Button size="small" color="error" variant="outlined" onClick={() => handleDeleteTransfer(transfer)}>Supprimer</Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setTransfersDialogOpen(false);
            openCreateTransferDialog();
          }}>
            Nouveau transfert
          </Button>
          <Button onClick={() => setTransfersDialogOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={legacyReviewDialogOpen} onClose={() => setLegacyReviewDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Revue des transactions legacy</DialogTitle>
        <DialogContent>
          {legacyTransactions.length === 0 ? (
            <Typography color="text.secondary">Aucune transaction legacy.</Typography>
          ) : (
            <Stack spacing={1} sx={{ mt: 0.5 }}>
              {legacyTransactions.map((transaction) => (
                <Box key={transaction.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.25 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    {transaction.date || "Date inconnue"} • {transaction.description || "Sans description"} • {Number(transaction.montant || 0).toFixed(2)} €
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                    Type legacy detecte: {getLegacyTransactionType(transaction.type) || transaction.type || "inconnu"}
                  </Typography>
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setEditingTransfer(null);
                        setLegacyTransferSource(transaction);
                        setTransferDialogOpen(true);
                        setLegacyReviewDialogOpen(false);
                      }}
                    >
                      Convertir en transfert
                    </Button>
                    <Button size="small" variant="outlined" onClick={() => handleReclassifyLegacyTransaction(transaction, "depense")}>Reclasser en depense</Button>
                    <Button size="small" variant="outlined" onClick={() => handleReclassifyLegacyTransaction(transaction, "revenu")}>Reclasser en revenu</Button>
                  </Stack>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLegacyReviewDialogOpen(false)}>Fermer</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={closeDeleteDialog}>
        <DialogTitle>Supprimer cette transaction ?</DialogTitle>
        <DialogContent>
          <Typography>
            Cette action est irréversible. La transaction sera supprimée définitivement.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog}>Annuler</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkDeleteDialogOpen} onClose={() => setBulkDeleteDialogOpen(false)}>
        <DialogTitle>Supprimer en masse ?</DialogTitle>
        <DialogContent>
          <Typography>
            {selectedTransactionsCount} transaction(s) seront supprimée(s) définitivement. Cette action est irréversible.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialogOpen(false)} disabled={bulkOperationLoading}>Annuler</Button>
          <Button onClick={handleBulkDeleteConfirm} color="error" variant="contained" disabled={bulkOperationLoading}>
            Supprimer
          </Button>
        </DialogActions>
      </Dialog>

      <VehicleFormDialog
        open={quickVehicleOpen}
        title="Ajouter un véhicule"
        onClose={() => setQuickVehicleOpen(false)}
        onSave={async (name) => {
          const result = await addVehicle({ name });
          if (result.success) setForm((previous) => ({ ...previous, vehicleId: result.value.id }));
          return result;
        }}
      />

      <TransactionEditorDialog
        open={transactionEditorOpen}
        title={editingId ? "Modifier une transaction" : "Ajouter une transaction"}
        form={form}
        initialForm={transactionEditorInitialForm}
        onChange={handleChange}
        onSubmit={handleSubmit}
        onClose={handleCancelEdit}
        submitLabel={editingId ? "Enregistrer" : "Creer"}
        errorMessage={transactionEditorError}
        accounts={formAccountOptions}
        categoryOptions={formCategoryOptions}
        subcategoryOptions={formSubcategoryOptions}
        activities={formActivityOptions}
        thirdParties={formThirdPartyOptions}
        projects={prioritizedProjectOptions}
        prioritizedProjectOptions={prioritizedProjectOptions}
        workProjects={activeWorkProjects}
        vehicles={formVehicleOptions}
        fixedExpenses={fixedExpenses}
        helperText={form.categoryId ? "Facultatif" : "Choisir une categorie d'abord"}
        scrollRestorePosition={transactionEditorScrollRestorePosition}
        initialFocusTarget={transactionEditorFocusTarget}
        classificationSuggestion={manualClassificationSuggestionKey === ignoredClassificationSuggestionKey ? null : manualClassificationSuggestion}
        onIgnoreClassificationSuggestion={ignoreManualClassificationSuggestion}
      />

      <CategoryForm
        open={quickCategoryOpen}
        onClose={() => {
          importQuickCreateRef.current = null;
          setQuickCategoryOpen(false);
          setQuickCategoryDraft(null);
          setTransactionEditorError("");
        }}
        onSubmit={handleQuickCategoryCreate}
        initialCategory={null}
        initialDraft={quickCategoryDraft}
        lockedType={form.type === "revenu" ? "revenu" : "depense"}
        errorMessage={transactionEditorError}
        isLoading={false}
      />

      <TransactionBulkEditDialog
        open={bulkEditDialogOpen}
        mode={bulkEditMode === "classification" ? "classification" : "advanced"}
        selectedTransactions={selectedTransactions}
        categories={categories}
        subcategories={activeSubcategories}
        activities={activeActivities}
        thirdParties={activeThirdParties}
        projects={activeProjects}
        workProjects={activeWorkProjects}
        accounts={accounts}
        onRequestCreateCategory={openQuickCategoryFromBulk}
        onRequestCreateSubcategory={openQuickSubcategoryFromBulk}
        onRequestCreateActivity={openQuickActivityFromBulk}
        onRequestCreateThirdParty={openQuickThirdPartyFromBulk}
        onRequestCreateProject={openQuickProjectFromBulk}
        onRequestCreateAccount={openQuickAccountFromBulk}
        onClose={() => {
          setBulkEditDialogOpen(false);
          setBulkEditMode("advanced");
        }}
        onApply={handleBulkUpdate}
        submitting={bulkOperationLoading}
      />

      <SimilarClassificationDialog
        open={Boolean(similarClassificationSuggestion)}
        suggestion={similarClassificationSuggestion}
        loading={similarClassificationLoading}
        onCancel={closeSimilarClassificationSuggestion}
        onConfirm={handleSimilarClassificationConfirm}
      />

      <EntityDialog
        open={quickThirdPartyOpen}
        title="Creation rapide d'un tiers"
        onClose={() => {
          importQuickCreateRef.current = null;
          setQuickThirdPartyOpen(false);
          setQuickThirdPartyError("");
        }}
        onSubmit={handleQuickThirdPartyCreate}
        formId="quick-third-party-form"
        errorMessage={quickThirdPartyError}
        submitLabel="Creer"
        maxWidth="sm"
        isDirty={Boolean(quickThirdPartyForm.name || quickThirdPartyForm.notes || quickThirdPartyForm.type !== "supplier")}
        autoFocusSelector='input[name="quick-third-party-name"]'
      >
        <form
          id="quick-third-party-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleQuickThirdPartyCreate();
          }}
        >
          <Box sx={{ display: "grid", gap: 1, mt: 0.5 }}>
            <TextField
              label="Nom"
              name="quick-third-party-name"
              size="small"
              value={quickThirdPartyForm.name}
              onChange={(event) => setQuickThirdPartyForm((previous) => ({ ...previous, name: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Type"
              select
              size="small"
              value={quickThirdPartyForm.type}
              onChange={(event) => setQuickThirdPartyForm((previous) => ({ ...previous, type: event.target.value }))}
              fullWidth
            >
              {THIRD_PARTY_TYPE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Notes"
              size="small"
              value={quickThirdPartyForm.notes}
              onChange={(event) => setQuickThirdPartyForm((previous) => ({ ...previous, notes: event.target.value }))}
              fullWidth
            />
          </Box>
        </form>
      </EntityDialog>

      <EntityDialog
        open={quickSubcategoryOpen}
        title="Creation rapide d'une sous-categorie"
        onClose={() => {
          importQuickCreateRef.current = null;
          setQuickSubcategoryOpen(false);
          setQuickSubcategoryError("");
        }}
        onSubmit={handleQuickSubcategoryCreate}
        formId="quick-subcategory-form"
        errorMessage={quickSubcategoryError}
        submitLabel="Creer"
        maxWidth="sm"
        isDirty={Boolean(quickSubcategoryForm.name)}
        autoFocusSelector='input[name="quick-subcategory-name"]'
      >
        <form
          id="quick-subcategory-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleQuickSubcategoryCreate();
          }}
        >
          <Box sx={{ display: "grid", gap: 1, mt: 0.5 }}>
            <TextField
              label="Nom"
              name="quick-subcategory-name"
              size="small"
              value={quickSubcategoryForm.name}
              onChange={(event) => setQuickSubcategoryForm((previous) => ({ ...previous, name: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Categorie"
              size="small"
              value={categories.find((category) => category.id === quickSubcategoryForm.categoryId)?.name || form.categoryName || form.categorie || ""}
              fullWidth
              disabled
            />
          </Box>
        </form>
      </EntityDialog>

      <EntityDialog
        open={quickAccountOpen}
        title="Creation rapide d'un compte"
        onClose={() => {
          importQuickCreateRef.current = null;
          setQuickAccountOpen(false);
          setQuickAccountError("");
          quickAccountSubmittingRef.current = false;
          setQuickAccountSubmitting(false);
        }}
        onSubmit={handleQuickAccountCreate}
        formId="quick-account-form"
        errorMessage={quickAccountError}
        submitting={quickAccountSubmitting}
        submitLabel="Creer"
        maxWidth="sm"
        isDirty={Boolean(quickAccountForm.name || quickAccountForm.icon || quickAccountForm.color !== "#1976d2" || quickAccountForm.initialBalance !== "0" || quickAccountForm.displayOrder !== "0" || quickAccountForm.type !== "standard")}
        autoFocusSelector='input[name="quick-account-name"]'
      >
        <form id="quick-account-form" onSubmit={(event) => {
          event.preventDefault();
          handleQuickAccountCreate();
        }}>
          <Box sx={{ display: "grid", gap: 1, mt: 0.5 }}>
            <TextField label="Nom" name="quick-account-name" size="small" value={quickAccountForm.name} onChange={(event) => setQuickAccountForm((previous) => ({ ...previous, name: event.target.value }))} fullWidth />
            <TextField label="Type" select size="small" value={quickAccountForm.type} onChange={(event) => setQuickAccountForm((previous) => ({ ...previous, type: event.target.value }))} fullWidth>
              <MenuItem value="standard">Standard</MenuItem>
              <MenuItem value="savings">Epargne</MenuItem>
              <MenuItem value="business">Professionnel</MenuItem>
              <MenuItem value="cash">Especes</MenuItem>
              <MenuItem value="digital">Numerique</MenuItem>
            </TextField>
            <TextField label="Icone" size="small" value={quickAccountForm.icon} onChange={(event) => setQuickAccountForm((previous) => ({ ...previous, icon: event.target.value }))} fullWidth />
            <TextField label="Couleur" size="small" value={quickAccountForm.color} onChange={(event) => setQuickAccountForm((previous) => ({ ...previous, color: event.target.value }))} fullWidth />
            <TextField label="Solde initial" size="small" type="number" value={quickAccountForm.initialBalance} onChange={(event) => setQuickAccountForm((previous) => ({ ...previous, initialBalance: event.target.value }))} fullWidth />
            <TextField label="Ordre d'affichage" size="small" type="number" value={quickAccountForm.displayOrder} onChange={(event) => setQuickAccountForm((previous) => ({ ...previous, displayOrder: event.target.value }))} fullWidth />
          </Box>
        </form>
      </EntityDialog>

      <EntityDialog
        open={quickActivityOpen}
        title="Creation rapide d'une activite"
        onClose={() => {
          importQuickCreateRef.current = null;
          setQuickActivityOpen(false);
          setQuickActivityError("");
        }}
        onSubmit={handleQuickActivityCreate}
        formId="quick-activity-form"
        errorMessage={quickActivityError}
        submitLabel="Creer"
        maxWidth="sm"
        isDirty={Boolean(quickActivityForm.name || quickActivityForm.kind !== "profit_center")}
        autoFocusSelector='input[name="quick-activity-name"]'
      >
        <form id="quick-activity-form" onSubmit={(event) => {
          event.preventDefault();
          handleQuickActivityCreate();
        }}>
          <Box sx={{ display: "grid", gap: 1, mt: 0.5 }}>
            <TextField label="Nom" name="quick-activity-name" size="small" value={quickActivityForm.name} onChange={(event) => setQuickActivityForm((previous) => ({ ...previous, name: event.target.value }))} fullWidth />
            <TextField label="Type" select size="small" value={quickActivityForm.kind} onChange={(event) => setQuickActivityForm((previous) => ({ ...previous, kind: event.target.value }))} fullWidth>
              {ACTIVITY_KIND_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>
          </Box>
        </form>
      </EntityDialog>

      <EntityDialog
        open={quickProjectOpen}
        title="Creation rapide d'un projet"
        onClose={() => {
          importQuickCreateRef.current = null;
          setQuickProjectOpen(false);
          setQuickProjectError("");
        }}
        onSubmit={handleQuickProjectCreate}
        formId="quick-project-form"
        errorMessage={quickProjectError}
        submitLabel="Creer"
        maxWidth="sm"
        isDirty={Boolean(quickProjectForm.name || quickProjectForm.activityId || quickProjectForm.startDate || quickProjectForm.endDate || quickProjectForm.notes)}
        autoFocusSelector='input[name="quick-project-name"]'
      >
        <form id="quick-project-form" onSubmit={(event) => {
          event.preventDefault();
          handleQuickProjectCreate();
        }}>
          <Box sx={{ display: "grid", gap: 1, mt: 0.5 }}>
            <TextField label="Nom" name="quick-project-name" size="small" value={quickProjectForm.name} onChange={(event) => setQuickProjectForm((previous) => ({ ...previous, name: event.target.value }))} fullWidth />
            <TextField label="Activite" select size="small" value={quickProjectForm.activityId} onChange={(event) => setQuickProjectForm((previous) => ({ ...previous, activityId: event.target.value }))} fullWidth>
              <MenuItem value="">Aucune</MenuItem>
              {formActivityOptions.map((activity) => (
                <MenuItem key={activity.id} value={activity.id}>{activity.name}</MenuItem>
              ))}
            </TextField>
            <TextField label="Date de debut" type="date" size="small" value={quickProjectForm.startDate} onChange={(event) => setQuickProjectForm((previous) => ({ ...previous, startDate: event.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Date de fin" type="date" size="small" value={quickProjectForm.endDate} onChange={(event) => setQuickProjectForm((previous) => ({ ...previous, endDate: event.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField label="Notes" size="small" value={quickProjectForm.notes} onChange={(event) => setQuickProjectForm((previous) => ({ ...previous, notes: event.target.value }))} fullWidth />
          </Box>
        </form>
      </EntityDialog>

      <EntityDialog
        open={quickFixedExpenseOpen}
        title="Creation rapide d'un frais fixe"
        onClose={() => {
          setQuickFixedExpenseOpen(false);
          setQuickFixedExpenseError("");
          setQuickFixedExpenseSourceTransactionIds([]);
          setQuickFixedExpenseApplyClassificationToSource(true);
          setQuickFixedExpenseSourceForm(getInitialForm());
          setQuickFixedExpenseAutoFocusSelector('input[name="quick-fixed-expense-name"]');
          if (quickFixedExpenseCreateResolverRef.current) {
            quickFixedExpenseCreateResolverRef.current("");
            quickFixedExpenseCreateResolverRef.current = null;
          }
        }}
        onSubmit={handleQuickFixedExpenseCreate}
        formId="quick-fixed-expense-form"
        errorMessage={quickFixedExpenseError}
        submitLabel="Creer"
        submitting={quickFixedExpenseSubmitting}
        maxWidth="sm"
        isDirty={Boolean(
          quickFixedExpenseForm.name
          || quickFixedExpenseForm.startDate
          || quickFixedExpenseForm.endDate
          || quickFixedExpenseForm.description
          || quickFixedExpenseSourceForm.categoryId
          || quickFixedExpenseSourceForm.subcategoryId
          || quickFixedExpenseSourceForm.thirdPartyId
          || quickFixedExpenseSourceForm.activityId
          || quickFixedExpenseSourceForm.projectId
        )}
        autoFocusSelector={quickFixedExpenseAutoFocusSelector}
      >
        <form id="quick-fixed-expense-form" onSubmit={(event) => {
          event.preventDefault();
          handleQuickFixedExpenseCreate();
        }}>
          <Box sx={{ display: "grid", gap: 1, mt: 0.5, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" } }}>
            <TextField
              label="Nom"
              name="quick-fixed-expense-name"
              size="small"
              value={quickFixedExpenseForm.name}
              onChange={(event) => setQuickFixedExpenseForm((previous) => ({ ...previous, name: event.target.value }))}
              sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
              fullWidth
            />
            <TextField
              label="Frequence"
              select
              size="small"
              value={quickFixedExpenseForm.frequency}
              onChange={(event) => setQuickFixedExpenseForm((previous) => ({ ...previous, frequency: event.target.value }))}
              fullWidth
            >
              <MenuItem value="monthly">Mensuel</MenuItem>
              <MenuItem value="annual">Annuel</MenuItem>
            </TextField>
            <TextField
              label="Montant du modele"
              size="small"
              value={`${Number(quickFixedExpenseSourceForm.montant || 0).toFixed(2)} €`}
              fullWidth
              disabled
            />
            <TextField
              label="Catégorie"
              name="quick-fixed-expense-category"
              select
              size="small"
              value={quickFixedExpenseSourceForm.categoryId || quickFixedExpenseSourceForm.categoryName || quickFixedExpenseSourceForm.categorie || ""}
              onChange={handleQuickFixedExpenseSourceChange}
              sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
              fullWidth
            >
              <MenuItem value="">Aucune</MenuItem>
              {quickFixedExpenseCategoryOptions.map((category) => (
                <MenuItem key={`${category.id || "legacy"}:${category.name}`} value={category.id || category.name}>{category.name}</MenuItem>
              ))}
              <Divider />
              <MenuItem value={CREATE_CATEGORY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
                Créer cette catégorie
              </MenuItem>
            </TextField>
            <TextField
              label="Sous-catégorie"
              name="quick-fixed-expense-subcategory"
              select
              size="small"
              value={quickFixedExpenseSourceForm.subcategoryId || ""}
              onChange={handleQuickFixedExpenseSourceChange}
              disabled={!quickFixedExpenseSourceForm.categoryId}
              fullWidth
            >
              <MenuItem value="">Aucune</MenuItem>
              {quickFixedExpenseSubcategoryOptions.map((subcategory) => (
                <MenuItem key={subcategory.id} value={subcategory.id}>{subcategory.name}</MenuItem>
              ))}
              <Divider />
              <MenuItem value={CREATE_SUBCATEGORY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }} disabled={!quickFixedExpenseSourceForm.categoryId}>
                Créer cette sous-catégorie
              </MenuItem>
            </TextField>
            <TextField
              label="Tiers"
              name="quick-fixed-expense-third-party"
              select
              size="small"
              value={quickFixedExpenseSourceForm.thirdPartyId || ""}
              onChange={handleQuickFixedExpenseSourceChange}
              fullWidth
            >
              <MenuItem value="">Aucun</MenuItem>
              {quickFixedExpenseThirdPartyOptions.map((thirdParty) => (
                <MenuItem key={thirdParty.id} value={thirdParty.id}>{thirdParty.name}</MenuItem>
              ))}
              <Divider />
              <MenuItem value={CREATE_THIRD_PARTY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
                Créer ce tiers
              </MenuItem>
            </TextField>
            <TextField
              label="Activité"
              name="quick-fixed-expense-activity"
              select
              size="small"
              value={quickFixedExpenseSourceForm.activityId || ""}
              onChange={handleQuickFixedExpenseSourceChange}
              fullWidth
            >
              <MenuItem value="">Aucune</MenuItem>
              {quickFixedExpenseActivityOptions.map((activity) => (
                <MenuItem key={activity.id} value={activity.id}>{activity.name}</MenuItem>
              ))}
              <Divider />
              <MenuItem value={CREATE_ACTIVITY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
                Créer cette activité
              </MenuItem>
            </TextField>
            <TextField
              label="Projet"
              name="quick-fixed-expense-project"
              select
              size="small"
              value={quickFixedExpenseSourceForm.projectId || ""}
              onChange={handleQuickFixedExpenseSourceChange}
              sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
              fullWidth
            >
              <MenuItem value="">Aucun</MenuItem>
              {quickFixedExpenseProjectOptions.map((project) => (
                <MenuItem key={project.id} value={project.id}>{project.name}</MenuItem>
              ))}
              <Divider />
              <MenuItem value={CREATE_PROJECT_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
                Créer ce projet
              </MenuItem>
            </TextField>
            <TextField
              label="Date de debut"
              type="date"
              size="small"
              value={quickFixedExpenseForm.startDate}
              onChange={(event) => setQuickFixedExpenseForm((previous) => ({ ...previous, startDate: event.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Date de fin"
              type="date"
              size="small"
              value={quickFixedExpenseForm.endDate}
              onChange={(event) => setQuickFixedExpenseForm((previous) => ({ ...previous, endDate: event.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Description"
              size="small"
              value={quickFixedExpenseForm.description}
              onChange={(event) => setQuickFixedExpenseForm((previous) => ({ ...previous, description: event.target.value }))}
              sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
              fullWidth
            />
            {quickFixedExpenseSourceTransactionIds.length > 0 && (
              <FormControlLabel
                sx={{
                  gridColumn: { xs: "auto", sm: "1 / -1" },
                  ml: 0,
                  mr: 0,
                  minHeight: 44,
                  alignItems: "flex-start",
                  "& .MuiFormControlLabel-label": { mt: 0.25 },
                }}
                control={(
                  <Checkbox
                    name="quick-fixed-expense-propagate-selection"
                    checked={quickFixedExpenseApplyClassificationToSource}
                    onChange={(event) => setQuickFixedExpenseApplyClassificationToSource(event.target.checked)}
                  />
                )}
                label="Appliquer immédiatement ce classement aux transactions sélectionnées"
              />
            )}
          </Box>
        </form>
      </EntityDialog>

      <TransactionDraftReviewDialog
        open={draftDialogOpen}
        initialDraft={draftTransactionForm}
        accounts={accounts}
        categories={categories}
        subcategories={activeSubcategories}
        activities={activeActivities}
        thirdParties={activeThirdParties}
        projects={activeProjects}
        vehicles={activeVehicles}
        defaultAccount={defaultAccount}
        submitting={isCreatingFromDraft}
        onClose={closeDraftDialog}
        onConfirm={handleCreateFromDraft}
        onCreateVehicle={addVehicle}
      />

      {console.log("TRANSACTIONS accounts =", accounts)}
      {console.log("TRANSACTIONS length =", accounts?.length)}
      <BankingImportWizard
        open={bankImportOpen}
        onClose={() => setBankImportOpen(false)}
        accounts={accounts}
        defaultAccountId={defaultAccount?.id || ""}
        existingTransactions={transactions}
        categories={categories}
        subcategories={activeSubcategories}
        activities={activeActivities}
        thirdParties={activeThirdParties}
        projects={activeProjects}
        onRequestCreateCategory={(payload) => openImportQuickCreate("category", payload)}
        onRequestCreateSubcategory={(payload) => openImportQuickCreate("subcategory", payload)}
        onRequestCreateActivity={(payload) => openImportQuickCreate("activity", payload)}
        onRequestCreateThirdParty={(payload) => openImportQuickCreate("thirdParty", payload)}
        onRequestCreateProject={(payload) => openImportQuickCreate("project", payload)}
        onRequestCreateAccount={(payload) => openImportQuickCreate("account", payload)}
        onRequestCreateFixedExpense={requestQuickFixedExpenseCreation}
        onImportCompleted={(result) => {
          setBankImportOpen(false);
          setMessage(`Import CSV termine ✅ (${result.importedCount} operation(s), ${result.importedTransferCount || 0} transfert(s), ${result.skippedCount} ignoree(s))`);
        }}
      />

      <Dialog open={transferDialogOpen} onClose={() => {
        if (transferSubmitting) {
          return;
        }

        setTransferDialogOpen(false);
        setEditingTransfer(null);
        setLegacyTransferSource(null);
      }} fullWidth maxWidth="sm">
        <DialogTitle>
          {legacyTransferSource
            ? "Convertir la transaction legacy en transfert"
            : editingTransfer
              ? "Modifier le transfert"
              : "Nouveau transfert entre comptes"}
        </DialogTitle>
        <DialogContent>
          {legacyTransferSource && (
            <AppAlert severity="info" sx={{ mb: 1.25 }}>
              Cette conversion ne supprime pas automatiquement les donnees: la transaction legacy est archivee (soft delete) apres creation du transfert.
            </AppAlert>
          )}

          <TransferForm
            accounts={accounts}
            defaultSourceAccountId={legacyTransferSource?.accountId || defaultAccount?.id || ""}
            initialValues={legacyTransferSource
              ? {
                  date: legacyTransferSource.date || new Date().toISOString().slice(0, 10),
                  amount: Number(legacyTransferSource.montant || 0),
                  sourceAccountId: legacyTransferSource.accountId || defaultAccount?.id || "",
                  destinationAccountId: "",
                  description: legacyTransferSource.description || "Conversion legacy",
                  notes: `Transaction legacy ${legacyTransferSource.id}`,
                }
              : editingTransfer}
            submitting={transferSubmitting}
            title={legacyTransferSource ? "Validation du transfert issu de legacy" : "Transfert interne"}
            submitLabel={legacyTransferSource ? "Convertir en transfert" : editingTransfer ? "Mettre a jour le transfert" : "Creer le transfert"}
            onSubmit={legacyTransferSource ? handleConvertLegacyToTransfer : handleCreateOrUpdateTransfer}
          />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
