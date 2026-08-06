import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from "../components/ui/foundations/MuiPrimitives";
import { Add, Clear, MoreVert, Search } from "../components/ui/icons/MuiIcons";
import { useCategories } from "../hooks/useCategories";
import { useSubcategories } from "../hooks/useSubcategories";
import { useActivities } from "../hooks/useActivities";
import { useThirdParties } from "../hooks/useThirdParties";
import { useProjects } from "../hooks/useProjects";
import { useBudgets } from "../hooks/useBudgets";
import { useFixedExpenses } from "../hooks/useFixedExpenses";
import { useRecurringIncome } from "../hooks/useRecurringIncome";
import { useTransactions } from "../hooks/useTransactions";
import { ReferentialPilotDrawer } from "../components/ReferentialPilotDrawer.jsx";
import { buildReferentialPilotData, filterReferentialDetails, sortReferentialDetails } from "../utils/referentialPilotModel.js";
import { buildCanonicalCategoryReference } from "../utils/categorySelectionModel";
import { AppPage, AppToolbar } from "../components/ui";
import {
  ACTIVITY_KIND_OPTIONS,
  DEFAULT_ACTIVITY_SEED,
  DEFAULT_PROJECT_SEED,
  DEFAULT_SUBCATEGORY_SEED,
  THIRD_PARTY_TYPE_OPTIONS,
} from "../constants/referenceCatalog";

const HORIZON_COLORS = {
  green: "#147d64",
  blue: "#0f5f8f",
  orange: "#d97706",
  red: "#c24135",
  ink: "#172a2f",
  muted: "#61777b",
  light: "#f6f8f4",
  line: "rgba(23, 42, 47, 0.12)",
};

const CARD_SX = {
  border: "1px solid",
  borderColor: HORIZON_COLORS.line,
  borderRadius: 2.5,
  background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,248,244,0.95))",
  boxShadow: "0 12px 28px rgba(20, 41, 43, 0.08)",
  transition: "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
  "&:hover": {
    borderColor: "rgba(15, 95, 143, 0.24)",
    boxShadow: "0 16px 32px rgba(20, 41, 43, 0.1)",
    transform: "translateY(-1px)",
  },
};

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function searchText(...values) {
  return normalizeText(values.filter(Boolean).join(" "));
}

function withSeedUniqByName(items = []) {
  const seen = new Set();
  return items.filter((item) => {
    const key = normalizeText(item.name);
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getActiveCount(items = []) {
  return items.filter((item) => item?.isActive !== false).length;
}

function getStatusLabel(item) {
  return item?.isActive === false ? "Inactif" : "Actif";
}

const TAB_LABELS = Object.freeze({
  categories: "Catégories",
  subcategories: "Sous-catégories",
  activities: "Activités",
  "third-parties": "Tiers",
  projects: "Projets",
  "fixed-expenses": "Frais fixes",
  "recurring-income": "Revenus récurrents",
});

const SORT_OPTIONS = Object.freeze([
  { value: "alphabetical", label: "Alphabétique" },
  { value: "mostUsed", label: "Plus utilisé" },
  { value: "lastUsage", label: "Dernière utilisation" },
  { value: "totalAmount", label: "Montant total" },
  { value: "transactionCount", label: "Nombre de transactions" },
  { value: "custom", label: "Ordre personnalisé" },
]);

function StatusChip({ item }) {
  const active = item?.isActive !== false;
  return (
    <Chip
      size="small"
      label={active ? "Actif" : "Inactif"}
      sx={{
        height: 22,
        fontWeight: 800,
        color: active ? HORIZON_COLORS.green : HORIZON_COLORS.muted,
        bgcolor: active ? "rgba(20, 125, 100, 0.11)" : "rgba(97, 119, 123, 0.14)",
      }}
    />
  );
}

function ReferenceHeader({ title, items = [], addLabel = "Ajouter", onAdd = null }) {
  const activeCount = getActiveCount(items);
  const inactiveCount = items.length - activeCount;

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between">
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" sx={{ fontWeight: 900, color: HORIZON_COLORS.ink, lineHeight: 1.15 }}>
          {title}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {items.length} élément(s) · {activeCount} actif(s){inactiveCount > 0 ? ` · ${inactiveCount} inactif(s)` : ""}
        </Typography>
      </Box>
      {onAdd && (
        <Button variant="contained" startIcon={<Add />} onClick={onAdd} sx={{ alignSelf: { xs: "stretch", sm: "center" } }}>
          {addLabel}
        </Button>
      )}
    </Stack>
  );
}

function ReferenceSearch({ value, onChange, placeholder }) {
  return (
    <TextField
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      size="small"
      type="search"
      fullWidth
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Search fontSize="small" />
          </InputAdornment>
        ),
        endAdornment: value ? (
          <InputAdornment position="end">
            <IconButton size="small" aria-label="Effacer la recherche" onClick={() => onChange("")}>
              <Clear fontSize="small" />
            </IconButton>
          </InputAdornment>
        ) : null,
      }}
    />
  );
}

function ReferenceSummary({ shown, total, label, filterLabel }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
      {shown} sur {total} {label} affiché(s){filterLabel ? ` · ${filterLabel}` : ""}
    </Typography>
  );
}

function EmptyState({ message, searchValue, onClearSearch, onAdd, addLabel }) {
  return (
    <Box sx={{ border: "1px dashed", borderColor: HORIZON_COLORS.line, borderRadius: 2, p: 2, bgcolor: HORIZON_COLORS.light }}>
      <Typography sx={{ fontWeight: 800, color: HORIZON_COLORS.ink }}>{message}</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
        {searchValue && <Button size="small" variant="outlined" onClick={onClearSearch}>Effacer la recherche</Button>}
        {onAdd && <Button size="small" variant="contained" onClick={onAdd}>{addLabel}</Button>}
      </Stack>
    </Box>
  );
}

function ReferenceActionsMenu({ label, actions = [] }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const enabledActions = actions.filter(Boolean);

  if (enabledActions.length === 0) {
    return null;
  }

  return (
    <>
      <IconButton
        size="small"
        aria-label={`Actions ${label}`}
        onClick={(event) => {
          event.stopPropagation();
          setAnchorEl(event.currentTarget);
        }}
        onDoubleClick={(event) => event.stopPropagation()}
        sx={{ mt: -0.5 }}
      >
        <MoreVert fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {enabledActions.map((action) => (
          <MenuItem
            key={action.label}
            onClick={() => {
              setAnchorEl(null);
              action.onClick?.();
            }}
            sx={action.danger ? { color: "error.main" } : undefined}
          >
            {action.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function ReferenceCard({
  item,
  title,
  eyebrow = "",
  details = [],
  color = HORIZON_COLORS.blue,
  editable = false,
  onOpen,
  onEdit,
  actions = [],
  editableRowProps,
}) {
  const openProps = onOpen ? {
    onClick: () => onOpen(item),
    role: "button",
    tabIndex: 0,
    onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onOpen(item);
      }
    },
  } : {};
  const content = (
    <Box
      {...openProps}
      {...(editable ? editableRowProps(onEdit) : {})}
      sx={{
        ...CARD_SX,
        ...(editable ? editableRowProps(onEdit).sx : {}),
        ...(onOpen ? { cursor: "pointer" } : {}),
        opacity: item?.isActive === false ? 0.72 : 1,
        p: { xs: 1.1, sm: 1.25 },
      }}
    >
      <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
            <Box aria-hidden="true" sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: color, flexShrink: 0 }} />
            <Typography sx={{ fontWeight: 900, color: HORIZON_COLORS.ink, minWidth: 0 }} noWrap>
              {title}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={0.6} useFlexGap flexWrap="wrap" sx={{ mt: 0.65 }}>
            {eyebrow && <Chip size="small" label={eyebrow} sx={{ height: 22, fontWeight: 800, bgcolor: HORIZON_COLORS.light }} />}
            <StatusChip item={item} />
          </Stack>
          {details.length > 0 && (
            <Stack spacing={0.15} sx={{ mt: 0.65 }}>
              {details.filter(Boolean).slice(0, 1).map((detail) => (
                <Typography key={detail} variant="caption" color="text.secondary" sx={{ display: "block" }} noWrap>
                  {detail}
                </Typography>
              ))}
            </Stack>
          )}
        </Box>
        <ReferenceActionsMenu label={title} actions={actions} />
      </Stack>
    </Box>
  );

  return editable ? (
    <Tooltip title="Double-clic pour modifier" arrow placement="top">
      {content}
    </Tooltip>
  ) : content;
}

function applySearch(items, query, getHaystack) {
  const normalized = normalizeText(query);
  if (!normalized) return items;
  return items.filter((item) => getHaystack(item).includes(normalized));
}

export default function Referentiels({ accounts = [], addAccount, updateAccount, deleteAccount, onOpenTransactionsFiltered = null }) {
  const enableDesktopDoubleClickEdit = useMediaQuery("(min-width:900px)");
  const [tab, setTab] = useState("categories");
  const [message, setMessage] = useState("");
  const [searchByTab, setSearchByTab] = useState({
    categories: "",
    subcategories: "",
    activities: "",
    "third-parties": "",
    projects: "",
    "fixed-expenses": "",
    "recurring-income": "",
  });
  const [statusByTab, setStatusByTab] = useState({
    categories: "all",
    subcategories: "all",
    activities: "all",
    "third-parties": "all",
    projects: "all",
    "fixed-expenses": "all",
    "recurring-income": "all",
  });
  const [sortByTab, setSortByTab] = useState({
    categories: "alphabetical",
    subcategories: "alphabetical",
    activities: "alphabetical",
    "third-parties": "alphabetical",
    projects: "alphabetical",
    "fixed-expenses": "alphabetical",
    "recurring-income": "alphabetical",
  });
  const [selectedReference, setSelectedReference] = useState(null);
  const [transactionFilters, setTransactionFilters] = useState({ account: "all", fromDate: "", toDate: "", minAmount: "", maxAmount: "" });
  const [transactionSort, setTransactionSort] = useState({ field: "date", direction: "desc" });
  const [mergePreview, setMergePreview] = useState(null);

  const editableRowProps = (onEdit) => ({
    onDoubleClick: (event) => {
      if (!enableDesktopDoubleClickEdit || event.target.closest("button, a, input, textarea, select, [role='button']")) return;
      onEdit();
    },
    sx: {
      cursor: enableDesktopDoubleClickEdit ? "pointer" : "default",
    },
  });

  const { categories, updateCategory, deleteCategory } = useCategories({ includeInactive: true });
  const { budgets, error: budgetsError, updateBudget } = useBudgets();
  const { fixedExpenses, error: fixedExpensesError, updateFixedExpense } = useFixedExpenses();
  const { recurringIncome, error: recurringIncomeError, updateRecurringIncome } = useRecurringIncome();
  const { transactions, error: transactionsError, deleteTransaction, updateTransaction } = useTransactions();
  const {
    subcategories,
    error: subcategoriesError,
    addSubcategory,
    updateSubcategory,
    deactivateSubcategory,
    removeSubcategory,
  } = useSubcategories({ includeInactive: true });
  const {
    activities,
    error: activitiesError,
    addActivity,
    updateActivity,
    deactivateActivity,
  } = useActivities({ includeInactive: true });
  const {
    thirdParties,
    error: thirdPartiesError,
    addThirdParty,
    updateThirdParty,
    deactivateThirdParty,
  } = useThirdParties({ includeInactive: true });
  const {
    projects,
    error: projectsError,
    addProject,
    updateProject,
    deactivateProject,
  } = useProjects({ includeInactive: true });

  const [accountForm, setAccountForm] = useState({ id: "", name: "", type: "standard", initialBalance: "0" });
  const [subcategoryForm, setSubcategoryForm] = useState({ id: "", name: "", categoryId: "", type: "depense" });
  const [subcategoryFilterType, setSubcategoryFilterType] = useState("all");
  const [subcategoryFilterCategory, setSubcategoryFilterCategory] = useState("all");
  const [activityForm, setActivityForm] = useState({ id: "", name: "", kind: "profit_center" });
  const [thirdPartyForm, setThirdPartyForm] = useState({ id: "", name: "", type: "supplier", notes: "" });
  const [projectForm, setProjectForm] = useState({ id: "", name: "", activityId: "", startDate: "", endDate: "", notes: "" });

  function startCreate(setForm, emptyForm, inputId) {
    setForm(emptyForm);
    window.setTimeout(() => {
      const input = document.getElementById(inputId);
      input?.scrollIntoView({ behavior: "smooth", block: "center" });
      input?.focus();
    }, 0);
  }

  const startCreateAccount = () => startCreate(setAccountForm, { id: "", name: "", type: "standard", initialBalance: "0" }, "reference-account-name");
  const startCreateSubcategory = () => startCreate(setSubcategoryForm, { id: "", name: "", categoryId: "", type: "depense" }, "reference-subcategory-name");
  const startCreateActivity = () => startCreate(setActivityForm, { id: "", name: "", kind: "profit_center" }, "reference-activity-name");
  const startCreateThirdParty = () => startCreate(setThirdPartyForm, { id: "", name: "", type: "supplier", notes: "" }, "reference-third-party-name");
  const startCreateProject = () => startCreate(setProjectForm, { id: "", name: "", activityId: "", startDate: "", endDate: "", notes: "" }, "reference-project-name");

  const setTabSearch = (value) => setSearchByTab((previous) => ({ ...previous, [tab]: value }));
  const setTabStatus = (value) => setStatusByTab((previous) => ({ ...previous, [tab]: value }));
  const setTabSort = (value) => setSortByTab((previous) => ({ ...previous, [tab]: value }));
  const currentSearch = searchByTab[tab] || "";
  const currentStatus = statusByTab[tab] || "all";
  const currentSort = sortByTab[tab] || "alphabetical";

  const canonicalCategoryReference = useMemo(
    () => buildCanonicalCategoryReference(categories, subcategories, { groupByType: true }),
    [categories, subcategories]
  );
  const canonicalCategories = useMemo(
    () => canonicalCategoryReference.categoryOptions,
    [canonicalCategoryReference]
  );

  const incomeCategoryIds = useMemo(
    () => new Set(canonicalCategories.filter((category) => category.type === "revenu").map((category) => category.id)),
    [canonicalCategories]
  );
  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const activityMap = useMemo(() => new Map(activities.map((activity) => [activity.id, activity])), [activities]);
  const projectsByActivityId = useMemo(() => {
    const groups = new Map();
    projects.forEach((project) => {
      const key = String(project.activityId || "");
      groups.set(key, (groups.get(key) || 0) + 1);
    });
    return groups;
  }, [projects]);

  const referentialPilotData = useMemo(() => buildReferentialPilotData({
    categories,
    subcategories,
    thirdParties,
    activities,
    projects,
    fixedExpenses,
    recurringIncome,
    budgets,
    transactions,
    accounts,
  }), [accounts, activities, budgets, categories, fixedExpenses, projects, recurringIncome, subcategories, thirdParties, transactions]);

  const visibleCategoryDetails = useMemo(() => sortReferentialDetails(filterStatus(filterReferentialDetails(referentialPilotData.tabs.categories || [], currentSearch)), currentSort), [currentSearch, currentSort, currentStatus, referentialPilotData.tabs.categories]);
  const visibleSubcategoryDetails = useMemo(() => sortReferentialDetails(filterStatus(filterReferentialDetails(referentialPilotData.tabs.subcategories || [], currentSearch)), currentSort), [currentSearch, currentSort, currentStatus, referentialPilotData.tabs.subcategories]);
  const visibleActivityDetails = useMemo(() => sortReferentialDetails(filterStatus(filterReferentialDetails(referentialPilotData.tabs.activities || [], currentSearch)), currentSort), [currentSearch, currentSort, currentStatus, referentialPilotData.tabs.activities]);
  const visibleThirdPartyDetails = useMemo(() => sortReferentialDetails(filterStatus(filterReferentialDetails(referentialPilotData.tabs["third-parties"] || [], currentSearch)), currentSort), [currentSearch, currentSort, currentStatus, referentialPilotData.tabs["third-parties"]]);
  const visibleProjectDetails = useMemo(() => sortReferentialDetails(filterStatus(filterReferentialDetails(referentialPilotData.tabs.projects || [], currentSearch)), currentSort), [currentSearch, currentSort, currentStatus, referentialPilotData.tabs.projects]);
  const visibleFixedExpenseDetails = useMemo(() => sortReferentialDetails(filterStatus(filterReferentialDetails(referentialPilotData.tabs["fixed-expenses"] || [], currentSearch)), currentSort), [currentSearch, currentSort, currentStatus, referentialPilotData.tabs["fixed-expenses"]]);
  const visibleRecurringIncomeDetails = useMemo(() => sortReferentialDetails(filterStatus(filterReferentialDetails(referentialPilotData.tabs["recurring-income"] || [], currentSearch)), currentSort), [currentSearch, currentSort, currentStatus, referentialPilotData.tabs["recurring-income"]]);

  function filterStatus(items) {
    const isInactive = (item) => item?.isActive === false || item?.item?.isActive === false || item?.status === "Inactif";
    if (currentStatus === "active") return items.filter((item) => !isInactive(item));
    if (currentStatus === "inactive") return items.filter((item) => isInactive(item));
    return items;
  }

  const visibleAccounts = useMemo(() => {
    const filtered = filterStatus(accounts);
    return applySearch(filtered, currentSearch, (account) => searchText(account.name, account.type, getStatusLabel(account)));
  }, [accounts, currentSearch, currentStatus]);

  const baseSubcategories = useMemo(() => {
    return subcategories.filter((subcategory) => {
      if (subcategoryFilterType !== "all" && subcategory.type !== subcategoryFilterType) return false;
      if (subcategoryFilterCategory !== "all" && subcategory.categoryId !== subcategoryFilterCategory) return false;
      return true;
    });
  }, [subcategories, subcategoryFilterType, subcategoryFilterCategory]);
  const visibleSubcategories = useMemo(() => {
    const filtered = filterStatus(baseSubcategories);
    return applySearch(filtered, currentSearch, (subcategory) => {
      const category = categoryMap.get(subcategory.categoryId);
      return searchText(subcategory.name, subcategory.type, category?.name, getStatusLabel(subcategory));
    });
  }, [baseSubcategories, categoryMap, currentSearch, currentStatus]);
  const visibleActivities = useMemo(() => {
    const filtered = filterStatus(activities);
    return applySearch(filtered, currentSearch, (activity) => {
      const kind = ACTIVITY_KIND_OPTIONS.find((option) => option.value === activity.kind)?.label || activity.kind;
      return searchText(activity.name, kind, getStatusLabel(activity));
    });
  }, [activities, currentSearch, currentStatus]);
  const visibleThirdParties = useMemo(() => {
    const filtered = filterStatus(thirdParties);
    return applySearch(filtered, currentSearch, (thirdParty) => {
      const type = THIRD_PARTY_TYPE_OPTIONS.find((option) => option.value === thirdParty.type)?.label || thirdParty.type;
      return searchText(thirdParty.name, type, thirdParty.notes, getStatusLabel(thirdParty));
    });
  }, [thirdParties, currentSearch, currentStatus]);
  const visibleProjects = useMemo(() => {
    const filtered = filterStatus(projects);
    return applySearch(filtered, currentSearch, (project) => {
      const activity = activityMap.get(project.activityId);
      return searchText(project.name, activity?.name, project.startDate, project.endDate, project.notes, getStatusLabel(project));
    });
  }, [activityMap, currentSearch, currentStatus, projects]);

  async function handleSaveAccount() {
    const name = accountForm.name.trim();
    const initialBalance = Number(accountForm.initialBalance);
    if (!name || !Number.isFinite(initialBalance)) {
      setMessage("Nom obligatoire et solde initial numerique pour le compte.");
      return;
    }
    const payload = { name, type: accountForm.type, initialBalance, isActive: true };
    const result = accountForm.id ? await updateAccount(accountForm.id, payload) : await addAccount(payload);
    if (!result?.success) {
      setMessage(result?.error || "Erreur lors de l'enregistrement du compte.");
      return;
    }
    setAccountForm({ id: "", name: "", type: "standard", initialBalance: "0" });
    setMessage("Compte enregistre");
  }

  async function handleSaveSubcategory() {
    if (!subcategoryForm.name || !subcategoryForm.categoryId) {
      setMessage("Nom et categorie obligatoires pour la sous-categorie.");
      return;
    }
    const payload = { name: subcategoryForm.name, categoryId: subcategoryForm.categoryId, type: subcategoryForm.type, isActive: true };
    const result = subcategoryForm.id ? await updateSubcategory(subcategoryForm.id, payload) : await addSubcategory(payload);
    if (!result.success) {
      setMessage(result.error || "Erreur lors de l'enregistrement de la sous-categorie.");
      return;
    }
    setSubcategoryForm({ id: "", name: "", categoryId: "", type: "depense" });
    setMessage("Sous-categorie enregistree");
  }

  async function handleSeedSubcategories() {
    const byNameAndCategory = new Set(subcategories.map((subcategory) => `${normalizeText(subcategory.name)}::${subcategory.categoryId}`));
    let created = 0;
    for (const seed of DEFAULT_SUBCATEGORY_SEED) {
      const category = canonicalCategories.find((item) => normalizeText(item.name) === normalizeText(seed.categoryName));
      if (!category) continue;
      const key = `${normalizeText(seed.name)}::${category.id}`;
      if (byNameAndCategory.has(key)) continue;
      const result = await addSubcategory({ name: seed.name, categoryId: category.id, type: seed.type, isActive: true });
      if (result.success) {
        byNameAndCategory.add(key);
        created += 1;
      }
    }
    setMessage(created > 0 ? `${created} sous-categorie(s) initiale(s) ajoutee(s).` : "Aucune sous-categorie initiale a ajouter.");
  }

  async function handleSaveActivity() {
    if (!activityForm.name) {
      setMessage("Nom obligatoire pour l'activite.");
      return;
    }
    const payload = { name: activityForm.name, kind: activityForm.kind, isActive: true };
    const result = activityForm.id ? await updateActivity(activityForm.id, payload) : await addActivity(payload);
    if (!result.success) {
      setMessage(result.error || "Erreur lors de l'enregistrement de l'activite.");
      return;
    }
    setActivityForm({ id: "", name: "", kind: "profit_center" });
    setMessage("Activite enregistree");
  }

  async function handleSeedActivities() {
    const byName = new Set(activities.map((activity) => normalizeText(activity.name)));
    let created = 0;
    for (const seed of withSeedUniqByName(DEFAULT_ACTIVITY_SEED)) {
      const key = normalizeText(seed.name);
      if (byName.has(key)) continue;
      const result = await addActivity({ ...seed, isActive: true });
      if (result.success) {
        byName.add(key);
        created += 1;
      }
    }
    setMessage(created > 0 ? `${created} activite(s) initiale(s) ajoutee(s).` : "Aucune activite initiale a ajouter.");
  }

  async function handleSaveThirdParty() {
    if (!thirdPartyForm.name) {
      setMessage("Nom obligatoire pour le tiers.");
      return;
    }
    const payload = { name: thirdPartyForm.name, type: thirdPartyForm.type, notes: thirdPartyForm.notes, isActive: true };
    const result = thirdPartyForm.id ? await updateThirdParty(thirdPartyForm.id, payload) : await addThirdParty(payload);
    if (!result.success) {
      setMessage(result.error || "Erreur lors de l'enregistrement du tiers.");
      return;
    }
    setThirdPartyForm({ id: "", name: "", type: "supplier", notes: "" });
    setMessage("Tiers enregistre");
  }

  async function handleSaveProject() {
    if (!projectForm.name) {
      setMessage("Nom obligatoire pour le projet.");
      return;
    }
    const payload = {
      name: projectForm.name,
      activityId: projectForm.activityId || null,
      startDate: projectForm.startDate || null,
      endDate: projectForm.endDate || null,
      notes: projectForm.notes,
      isActive: true,
    };
    const result = projectForm.id ? await updateProject(projectForm.id, payload) : await addProject(payload);
    if (!result.success) {
      setMessage(result.error || "Erreur lors de l'enregistrement du projet.");
      return;
    }
    setProjectForm({ id: "", name: "", activityId: "", startDate: "", endDate: "", notes: "" });
    setMessage("Projet enregistre");
  }

  async function handleSeedProjects() {
    const byName = new Set(projects.map((project) => normalizeText(project.name)));
    let created = 0;
    for (const seed of withSeedUniqByName(DEFAULT_PROJECT_SEED)) {
      const key = normalizeText(seed.name);
      if (byName.has(key)) continue;
      const result = await addProject({ ...seed, isActive: true });
      if (result.success) {
        byName.add(key);
        created += 1;
      }
    }
    setMessage(created > 0 ? `${created} projet(s) initial(aux) ajoute(s).` : "Aucun projet initial a ajouter.");
  }

  const currentError = subcategoriesError || activitiesError || thirdPartiesError || projectsError || budgetsError || fixedExpensesError || recurringIncomeError || transactionsError;

  function openReferenceDetail(nextTab, referenceId) {
    const targetTab = nextTab || tab;
    const detail = (referentialPilotData.tabs[targetTab] || []).find((entry) => String(entry.id || "") === String(referenceId || ""));
    if (!detail) return;
    setTab(targetTab);
    setSelectedReference(detail);
    setTransactionFilters({ account: "all", fromDate: "", toDate: "", minAmount: "", maxAmount: "" });
    setTransactionSort({ field: "date", direction: "desc" });
  }

  function closeReferenceDetail() {
    setSelectedReference(null);
    setMergePreview(null);
  }

  function startRename(detail) {
    if (!detail) return;
    if (detail.type === "categories") {
      // Categories are administered in their dedicated page and can still be renamed from this pilot drawer.
      setMessage(`Renommage prêt pour ${detail.name}. Utilisez l'action Modifier.`);
      return;
    }

    if (detail.type === "subcategories") {
      setSubcategoryForm({ id: detail.item.id, name: detail.item.name || "", categoryId: detail.item.categoryId || "", type: detail.item.type || "depense" });
      setTab("subcategories");
      return;
    }
    if (detail.type === "activities") {
      setActivityForm({ id: detail.item.id, name: detail.item.name || "", kind: detail.item.kind || "profit_center" });
      setTab("activities");
      return;
    }
    if (detail.type === "third-parties") {
      setThirdPartyForm({ id: detail.item.id, name: detail.item.name || "", type: detail.item.type || "supplier", notes: detail.item.notes || "" });
      setTab("third-parties");
      return;
    }
    if (detail.type === "projects") {
      setProjectForm({ id: detail.item.id, name: detail.item.name || "", activityId: detail.item.activityId || "", startDate: detail.item.startDate || "", endDate: detail.item.endDate || "", notes: detail.item.notes || "" });
      setTab("projects");
      return;
    }
    setMessage(`Renommage prêt pour ${detail.name}. Utilisez la fiche dédiée.`);
  }

  async function toggleReferenceActive(detail) {
    if (!detail) return;
    const nextActive = detail.item?.isActive === false;
    const payload = { ...detail.item, isActive: nextActive };
    let result = null;

    if (detail.type === "categories") result = await updateCategory(detail.item.id, payload);
    if (detail.type === "subcategories") result = await updateSubcategory(detail.item.id, payload);
    if (detail.type === "activities") result = await updateActivity(detail.item.id, payload);
    if (detail.type === "third-parties") result = await updateThirdParty(detail.item.id, payload);
    if (detail.type === "projects") result = await updateProject(detail.item.id, payload);
    if (detail.type === "fixed-expenses") result = await updateFixedExpense(detail.item.id, payload);
    if (detail.type === "recurring-income") result = await updateRecurringIncome(detail.item.id, payload);

    if (!result?.success) {
      setMessage(result?.error || "Impossible de modifier le statut du référentiel.");
      return;
    }

    setMessage(nextActive ? "Référentiel réactivé." : "Référentiel désactivé.");
  }

  function openMergePreview(detail, mode = "merge") {
    if (!detail) return;
    const candidates = (referentialPilotData.tabs[detail.type] || [])
      .filter((entry) => entry.id !== detail.id)
      .map((entry) => ({ id: entry.id, name: entry.name }));
    setMergePreview({ detail, mode, targetId: candidates[0]?.id || "", candidates });
  }

  async function applyMergePreview() {
    if (!mergePreview?.detail || !mergePreview?.targetId) {
      setMessage("Sélectionnez un référentiel cible avant d'appliquer le remplacement.");
      return;
    }

    const detail = mergePreview.detail;
    const target = (referentialPilotData.tabs[detail.type] || []).find((entry) => entry.id === mergePreview.targetId);
    if (!target) {
      setMessage("Référentiel cible introuvable.");
      return;
    }

    const operations = [];

    if (detail.type === "categories") {
      operations.push(...detail.transactionRows.map((row) => updateTransaction(row.transaction.id, {
        ...row.transaction,
        categoryId: target.item.id,
        categoryName: target.item.name,
        categorie: target.item.name,
      })));
      operations.push(...detail.relatedBudgets.map((budget) => updateBudget(budget.id, { ...budget, categoryId: target.item.id, categoryName: target.item.name })));
      operations.push(...detail.relatedFixedExpenses.map((item) => updateFixedExpense(item.id, { ...item, categoryId: target.item.id, categoryName: target.item.name, category: target.item.name })));
      operations.push(...detail.relatedRecurringIncome.map((item) => updateRecurringIncome(item.id, { ...item, categoryId: target.item.id, categoryName: target.item.name, category: target.item.name })));
    }

    if (detail.type === "subcategories") {
      operations.push(...detail.transactionRows.map((row) => updateTransaction(row.transaction.id, {
        ...row.transaction,
        subcategoryId: target.item.id,
        subcategoryName: target.item.name,
      })));
      operations.push(...detail.relatedBudgets.map((budget) => updateBudget(budget.id, { ...budget, subcategoryId: target.item.id, subcategoryName: target.item.name })));
      operations.push(...detail.relatedFixedExpenses.map((item) => updateFixedExpense(item.id, { ...item, subcategoryId: target.item.id, subcategoryName: target.item.name })));
      operations.push(...detail.relatedRecurringIncome.map((item) => updateRecurringIncome(item.id, { ...item, subcategoryId: target.item.id, subcategoryName: target.item.name })));
    }

    if (detail.type === "third-parties") {
      operations.push(...detail.transactionRows.map((row) => updateTransaction(row.transaction.id, {
        ...row.transaction,
        thirdPartyId: target.item.id,
        thirdPartyName: target.item.name,
      })));
      operations.push(...detail.relatedFixedExpenses.map((item) => updateFixedExpense(item.id, { ...item, thirdPartyId: target.item.id, thirdPartyName: target.item.name })));
      operations.push(...detail.relatedRecurringIncome.map((item) => updateRecurringIncome(item.id, { ...item, thirdPartyId: target.item.id, thirdPartyName: target.item.name })));
    }

    if (detail.type === "activities") {
      operations.push(...detail.transactionRows.map((row) => updateTransaction(row.transaction.id, {
        ...row.transaction,
        activityId: target.item.id,
        activityName: target.item.name,
      })));
      operations.push(...detail.relatedProjects.map((item) => updateProject(item.id, { ...item, activityId: target.item.id })));
      operations.push(...detail.relatedFixedExpenses.map((item) => updateFixedExpense(item.id, { ...item, activityId: target.item.id, activityName: target.item.name })));
      operations.push(...detail.relatedRecurringIncome.map((item) => updateRecurringIncome(item.id, { ...item, activityId: target.item.id, activityName: target.item.name })));
    }

    if (detail.type === "projects") {
      operations.push(...detail.transactionRows.map((row) => updateTransaction(row.transaction.id, {
        ...row.transaction,
        projectId: target.item.id,
        projectName: target.item.name,
      })));
      operations.push(...detail.relatedFixedExpenses.map((item) => updateFixedExpense(item.id, { ...item, projectId: target.item.id, projectName: target.item.name })));
      operations.push(...detail.relatedRecurringIncome.map((item) => updateRecurringIncome(item.id, { ...item, projectId: target.item.id, projectName: target.item.name })));
    }

    if (detail.type === "fixed-expenses") {
      operations.push(...detail.transactionRows.map((row) => updateTransaction(row.transaction.id, {
        ...row.transaction,
        fixedExpenseId: target.item.id,
        isFixedExpense: true,
      })));
    }

    if (detail.type === "recurring-income") {
      operations.push(...detail.transactionRows.map((row) => updateTransaction(row.transaction.id, {
        ...row.transaction,
        recurringIncomeId: target.item.id,
      })));
    }

    const results = await Promise.all(operations);
    const failed = results.find((result) => result?.success === false);
    if (failed) {
      setMessage(failed.error || "Le remplacement a échoué.");
      return;
    }

    if (mergePreview.mode === "merge") {
      await toggleReferenceActive(detail);
    }

    setMergePreview(null);
    setMessage(mergePreview.mode === "merge" ? "Fusion appliquée." : "Remplacement appliqué.");
  }

  function handleOpenTransaction(transaction) {
    if (!transaction) return;
    if (onOpenTransactionsFiltered) {
      onOpenTransactionsFiltered({
        source: "card-explorer",
        transactionIds: transaction.id ? [transaction.id] : [],
        openTransactionId: transaction.id || null,
        openMode: "edit",
        requestId: Date.now(),
      });
      return;
    }
    setMessage(`Ouvrez la transaction ${transaction.id} depuis Transactions pour édition complète.`);
  }

  async function handleDeleteTransaction(transaction) {
    if (!transaction?.id) return;
    const result = await deleteTransaction(transaction.id);
    if (!result?.success) {
      setMessage(result?.error || "Suppression impossible.");
      return;
    }
    setMessage("Transaction supprimée.");
  }

  function Controls({ total, shown, label, placeholder, extra = null }) {
    return (
      <Stack spacing={1}>
        <ReferenceSearch value={currentSearch} onChange={setTabSearch} placeholder={placeholder} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between">
          <ReferenceSummary shown={shown} total={total} label={label} filterLabel={currentStatus === "active" ? "Actifs" : currentStatus === "inactive" ? "Inactifs" : "Tous"} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <TextField label="Tri" select size="small" value={currentSort} onChange={(event) => setTabSort(event.target.value)} sx={{ minWidth: { sm: 170 } }}>
              {SORT_OPTIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </TextField>
            <TextField label="Statut" select size="small" value={currentStatus} onChange={(event) => setTabStatus(event.target.value)} sx={{ minWidth: { sm: 140 } }}>
              <MenuItem value="all">Tous</MenuItem>
              <MenuItem value="active">Actifs</MenuItem>
              <MenuItem value="inactive">Inactifs</MenuItem>
            </TextField>
            {extra}
          </Stack>
        </Stack>
      </Stack>
    );
  }

  return (
    <AppPage>
      <AppToolbar
        title="Référentiels"
        subtitle="Horizon V2 · Nomenclature et dépendances"
        countLabel={`${categories.length} références principales`}
      />

      {message && <Alert severity={message.includes("Erreur") ? "error" : "success"}>{message}</Alert>}
      {currentError && <Alert severity="error">{currentError}</Alert>}

      <Box sx={{ ...CARD_SX, p: { xs: 1.25, sm: 1.5 } }}>
        <Tabs value={tab} onChange={(event, value) => setTab(value)} variant="scrollable" allowScrollButtonsMobile sx={{ minHeight: 42 }}>
          <Tab value="categories" label="Catégories" />
          <Tab value="subcategories" label="Sous-catégories" />
          <Tab value="activities" label="Activités" />
          <Tab value="third-parties" label="Tiers" />
          <Tab value="projects" label="Projets" />
          <Tab value="fixed-expenses" label="Frais fixes" />
          <Tab value="recurring-income" label="Revenus récurrents" />
          <Tab value="accounts" label="Comptes" />
        </Tabs>
      </Box>

      {tab === "categories" && (
        <Stack spacing={1.25}>
          <ReferenceHeader title="Catégories" items={categories} />
          <Controls total={categories.length} shown={visibleCategoryDetails.length} label="catégorie(s)" placeholder="Rechercher une catégorie" />
          {visibleCategoryDetails.length === 0 ? (
            <EmptyState message={currentSearch ? "Aucune catégorie ne correspond à votre recherche." : "Aucune catégorie à afficher."} searchValue={currentSearch} onClearSearch={() => setTabSearch("")} />
          ) : (
            <Stack spacing={0.75}>
              {visibleCategoryDetails.map((detail) => (
                <ReferenceCard
                  key={detail.id}
                  item={detail.item}
                  title={detail.name}
                  eyebrow={detail.item?.type || "depense"}
                  color={detail.item?.color || HORIZON_COLORS.blue}
                  details={[
                    `${detail.usageCount} utilisation(s)`,
                    `${detail.transactionRows.length} transaction(s)`,
                    `${detail.relatedBudgets.length} budget(s)`,
                  ]}
                  editable
                  onOpen={() => openReferenceDetail("categories", detail.id)}
                  onEdit={() => startRename(detail)}
                  editableRowProps={editableRowProps}
                  actions={[
                    { label: "Renommer", onClick: () => startRename(detail) },
                    detail.item?.isActive === false
                      ? { label: "Réactiver", onClick: () => toggleReferenceActive(detail) }
                      : { label: "Désactiver", onClick: () => toggleReferenceActive(detail) },
                    { label: "Fusionner", onClick: () => openMergePreview(detail, "merge") },
                  ]}
                />
              ))}
            </Stack>
          )}
        </Stack>
      )}

      {tab === "accounts" && (
        <Stack spacing={1.25}>
          <ReferenceHeader title="Comptes" items={accounts} onAdd={startCreateAccount} />
          <Controls total={accounts.length} shown={visibleAccounts.length} label="comptes" placeholder="Rechercher un compte" />
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" } }}>
            <TextField id="reference-account-name" label="Nom" size="small" value={accountForm.name} onChange={(event) => setAccountForm((prev) => ({ ...prev, name: event.target.value }))} />
            <TextField label="Type" select size="small" value={accountForm.type} onChange={(event) => setAccountForm((prev) => ({ ...prev, type: event.target.value }))}>
              <MenuItem value="standard">Standard</MenuItem>
              <MenuItem value="savings">Epargne</MenuItem>
              <MenuItem value="business">Professionnel</MenuItem>
              <MenuItem value="cash">Especes</MenuItem>
              <MenuItem value="digital">Numerique</MenuItem>
            </TextField>
            <TextField label="Solde initial" size="small" type="number" value={accountForm.initialBalance} onChange={(event) => setAccountForm((prev) => ({ ...prev, initialBalance: event.target.value }))} />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={handleSaveAccount}>{accountForm.id ? "Mettre à jour" : "Ajouter"}</Button>
              {accountForm.id && <Button variant="outlined" onClick={startCreateAccount}>Annuler</Button>}
            </Stack>
          </Box>
          {visibleAccounts.length === 0 ? (
            <EmptyState message={currentSearch ? "Aucun compte ne correspond à votre recherche." : "Aucun compte chargé."} searchValue={currentSearch} onClearSearch={() => setTabSearch("")} onAdd={startCreateAccount} addLabel="Ajouter" />
          ) : (
            <Stack spacing={0.75}>
              {visibleAccounts.map((account) => {
                const edit = () => setAccountForm({ id: account.id, name: account.name || "", type: account.type || "standard", initialBalance: String(account.initialBalance ?? 0) });
                return <ReferenceCard
                  key={account.id || account.name}
                  item={account}
                  title={account.name || "Compte"}
                  eyebrow={account.type || "Compte"}
                  color={account.color || HORIZON_COLORS.blue}
                  details={[
                    account.icon ? `Icône: ${account.icon}` : "",
                    account.initialBalance !== undefined ? `Solde initial: ${Number(account.initialBalance || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}` : "",
                  ]}
                  editable
                  onEdit={edit}
                  editableRowProps={editableRowProps}
                  actions={[
                    { label: "Modifier", onClick: edit },
                    { label: "Supprimer", danger: true, onClick: () => deleteAccount(account.id) },
                  ]}
                />
              })}
            </Stack>
          )}
        </Stack>
      )}

      {tab === "fixed-expenses" && (
        <Stack spacing={1.25}>
          <ReferenceHeader title="Frais fixes" items={fixedExpenses} />
          <Controls total={fixedExpenses.length} shown={visibleFixedExpenseDetails.length} label="frais fixe(s)" placeholder="Rechercher un frais fixe" />
          {visibleFixedExpenseDetails.length === 0 ? (
            <EmptyState message={currentSearch ? "Aucun frais fixe ne correspond à votre recherche." : "Aucun frais fixe à afficher."} searchValue={currentSearch} onClearSearch={() => setTabSearch("")} />
          ) : (
            <Stack spacing={0.75}>
              {visibleFixedExpenseDetails.map((detail) => (
                <ReferenceCard
                  key={detail.id}
                  item={detail.item}
                  title={detail.name}
                  eyebrow={detail.item?.frequency || "monthly"}
                  color={HORIZON_COLORS.red}
                  details={[
                    `${detail.transactionRows.length} transaction(s) liée(s)`,
                    `${detail.relatedBudgets.length} budget(s) concerné(s)`,
                    `Montant total: ${Number(detail.stats.totalAmount || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}`,
                  ]}
                  editable
                  onOpen={() => openReferenceDetail("fixed-expenses", detail.id)}
                  onEdit={() => startRename(detail)}
                  editableRowProps={editableRowProps}
                  actions={[
                    { label: "Renommer", onClick: () => startRename(detail) },
                    detail.item?.isActive === false
                      ? { label: "Réactiver", onClick: () => toggleReferenceActive(detail) }
                      : { label: "Désactiver", onClick: () => toggleReferenceActive(detail) },
                    { label: "Remplacer par...", onClick: () => openMergePreview(detail, "replace") },
                  ]}
                />
              ))}
            </Stack>
          )}
        </Stack>
      )}

      {tab === "recurring-income" && (
        <Stack spacing={1.25}>
          <ReferenceHeader title="Revenus récurrents" items={recurringIncome} />
          <Controls total={recurringIncome.length} shown={visibleRecurringIncomeDetails.length} label="revenu(x) récurrent(s)" placeholder="Rechercher un revenu récurrent" />
          {visibleRecurringIncomeDetails.length === 0 ? (
            <EmptyState message={currentSearch ? "Aucun revenu récurrent ne correspond à votre recherche." : "Aucun revenu récurrent à afficher."} searchValue={currentSearch} onClearSearch={() => setTabSearch("")} />
          ) : (
            <Stack spacing={0.75}>
              {visibleRecurringIncomeDetails.map((detail) => (
                <ReferenceCard
                  key={detail.id}
                  item={detail.item}
                  title={detail.name}
                  eyebrow={detail.item?.frequency || "monthly"}
                  color={HORIZON_COLORS.green}
                  details={[
                    `${detail.transactionRows.length} transaction(s) liée(s)`,
                    `${detail.relatedRecurringIncome.length || 0} fiche(s) liée(s)`,
                    `Montant total: ${Number(detail.stats.totalAmount || 0).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}`,
                  ]}
                  editable
                  onOpen={() => openReferenceDetail("recurring-income", detail.id)}
                  onEdit={() => startRename(detail)}
                  editableRowProps={editableRowProps}
                  actions={[
                    { label: "Renommer", onClick: () => startRename(detail) },
                    detail.item?.isActive === false
                      ? { label: "Réactiver", onClick: () => toggleReferenceActive(detail) }
                      : { label: "Désactiver", onClick: () => toggleReferenceActive(detail) },
                    { label: "Remplacer par...", onClick: () => openMergePreview(detail, "replace") },
                  ]}
                />
              ))}
            </Stack>
          )}
        </Stack>
      )}

      {tab === "subcategories" && (
        <Stack spacing={1.25}>
          <ReferenceHeader title="Sous-catégories" items={subcategories} onAdd={startCreateSubcategory} />
          <Controls
            total={baseSubcategories.length}
            shown={visibleSubcategories.length}
            label="sous-catégorie(s)"
            placeholder="Rechercher une sous-catégorie"
            extra={(
              <>
                <TextField label="Type" select size="small" value={subcategoryFilterType} onChange={(event) => setSubcategoryFilterType(event.target.value)} sx={{ minWidth: { sm: 130 } }}>
                  <MenuItem value="all">Tous</MenuItem>
                  <MenuItem value="depense">Dépense</MenuItem>
                  <MenuItem value="revenu">Revenu</MenuItem>
                </TextField>
                <TextField label="Catégorie" select size="small" value={subcategoryFilterCategory} onChange={(event) => setSubcategoryFilterCategory(event.target.value)} sx={{ minWidth: { sm: 180 } }}>
                  <MenuItem value="all">Toutes</MenuItem>
                  {canonicalCategories.map((category) => <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>)}
                </TextField>
              </>
            )}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Button size="small" variant="outlined" onClick={handleSeedSubcategories}>Charger exemples initiaux</Button>
          </Stack>
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" } }}>
            <TextField id="reference-subcategory-name" label="Nom" size="small" value={subcategoryForm.name} onChange={(event) => setSubcategoryForm((prev) => ({ ...prev, name: event.target.value }))} />
            <TextField
              label="Catégorie"
              select
              size="small"
              value={subcategoryForm.categoryId}
              onChange={(event) => {
                const categoryId = event.target.value;
                setSubcategoryForm((prev) => ({ ...prev, categoryId, type: incomeCategoryIds.has(categoryId) ? "revenu" : "depense" }));
              }}
            >
              {canonicalCategories.map((category) => <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>)}
            </TextField>
            <TextField label="Type" select size="small" value={subcategoryForm.type} onChange={(event) => setSubcategoryForm((prev) => ({ ...prev, type: event.target.value }))}>
              <MenuItem value="depense">Dépense</MenuItem>
              <MenuItem value="revenu">Revenu</MenuItem>
            </TextField>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={handleSaveSubcategory}>{subcategoryForm.id ? "Mettre à jour" : "Ajouter"}</Button>
              {subcategoryForm.id && <Button variant="outlined" onClick={() => setSubcategoryForm({ id: "", name: "", categoryId: "", type: "depense" })}>Annuler</Button>}
            </Stack>
          </Box>
          {visibleSubcategoryDetails.length === 0 ? (
            <EmptyState message={currentSearch ? "Aucune sous-catégorie ne correspond à votre recherche." : "Aucune sous-catégorie à afficher."} searchValue={currentSearch} onClearSearch={() => setTabSearch("")} onAdd={startCreateSubcategory} addLabel="Ajouter" />
          ) : (
            <Stack spacing={0.75}>
              {visibleSubcategoryDetails.map((detail) => {
                const subcategory = detail.item;
                const category = categoryMap.get(subcategory.categoryId);
                const edit = () => setSubcategoryForm({ id: subcategory.id, name: subcategory.name || "", categoryId: subcategory.categoryId || "", type: subcategory.type || "depense" });
                return (
                  <ReferenceCard
                    key={subcategory.id}
                    item={subcategory}
                    title={subcategory.name || "Sous-catégorie"}
                    eyebrow={subcategory.type || "depense"}
                    color={category?.color || HORIZON_COLORS.blue}
                    details={[`Catégorie parente: ${category?.name || "Catégorie inconnue"}`]}
                    editable
                    onOpen={() => openReferenceDetail("subcategories", subcategory.id)}
                    onEdit={edit}
                    editableRowProps={editableRowProps}
                    actions={[
                      { label: "Modifier", onClick: edit },
                      subcategory.isActive ? { label: "Désactiver", onClick: () => deactivateSubcategory(subcategory.id) } : { label: "Activer", onClick: () => updateSubcategory(subcategory.id, { ...subcategory, isActive: true }) },
                      { label: "Supprimer", danger: true, onClick: async () => {
                        const result = await removeSubcategory(subcategory.id);
                        setMessage(result.success ? "Sous-catégorie supprimée." : (result.error || "Suppression impossible."));
                      } },
                    ]}
                  />
                );
              })}
            </Stack>
          )}
        </Stack>
      )}

      {tab === "activities" && (
        <Stack spacing={1.25}>
          <ReferenceHeader title="Activités" items={activities} onAdd={startCreateActivity} />
          <Controls total={activities.length} shown={visibleActivities.length} label="activité(s)" placeholder="Rechercher une activité" />
          <Button size="small" variant="outlined" onClick={handleSeedActivities} sx={{ alignSelf: "flex-start" }}>Charger exemples</Button>
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" } }}>
            <TextField id="reference-activity-name" label="Nom" size="small" value={activityForm.name} onChange={(event) => setActivityForm((prev) => ({ ...prev, name: event.target.value }))} />
            <TextField label="Type d'activité" size="small" select value={activityForm.kind} onChange={(event) => setActivityForm((prev) => ({ ...prev, kind: event.target.value }))}>
              {ACTIVITY_KIND_OPTIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </TextField>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={handleSaveActivity}>{activityForm.id ? "Mettre à jour" : "Ajouter"}</Button>
              {activityForm.id && <Button variant="outlined" onClick={() => setActivityForm({ id: "", name: "", kind: "profit_center" })}>Annuler</Button>}
            </Stack>
          </Box>
          {visibleActivityDetails.length === 0 ? (
            <EmptyState message={currentSearch ? "Aucune activité ne correspond à votre recherche." : "Aucune activité à afficher."} searchValue={currentSearch} onClearSearch={() => setTabSearch("")} onAdd={startCreateActivity} addLabel="Ajouter" />
          ) : (
            <Stack spacing={0.75}>
              {visibleActivityDetails.map((detail) => {
                const activity = detail.item;
                const kind = ACTIVITY_KIND_OPTIONS.find((option) => option.value === activity.kind)?.label || activity.kind || "Activité";
                const edit = () => setActivityForm({ id: activity.id, name: activity.name || "", kind: activity.kind || "profit_center" });
                return (
                  <ReferenceCard
                    key={activity.id}
                    item={activity}
                    title={activity.name || "Activité"}
                    eyebrow={kind}
                    color={HORIZON_COLORS.green}
                    details={[`${projectsByActivityId.get(activity.id) || 0} projet(s) lié(s)`]}
                    editable
                    onOpen={() => openReferenceDetail("activities", activity.id)}
                    onEdit={edit}
                    editableRowProps={editableRowProps}
                    actions={[
                      { label: "Modifier", onClick: edit },
                      activity.isActive ? { label: "Désactiver", onClick: () => deactivateActivity(activity.id) } : { label: "Activer", onClick: () => updateActivity(activity.id, { ...activity, isActive: true }) },
                    ]}
                  />
                );
              })}
            </Stack>
          )}
        </Stack>
      )}

      {tab === "third-parties" && (
        <Stack spacing={1.25}>
          <ReferenceHeader title="Tiers" items={thirdParties} onAdd={startCreateThirdParty} />
          <Controls total={thirdParties.length} shown={visibleThirdParties.length} label="tiers" placeholder="Rechercher un tiers" />
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" } }}>
            <TextField id="reference-third-party-name" label="Nom" size="small" value={thirdPartyForm.name} onChange={(event) => setThirdPartyForm((prev) => ({ ...prev, name: event.target.value }))} />
            <TextField label="Type" size="small" select value={thirdPartyForm.type} onChange={(event) => setThirdPartyForm((prev) => ({ ...prev, type: event.target.value }))}>
              {THIRD_PARTY_TYPE_OPTIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </TextField>
            <TextField label="Notes" size="small" value={thirdPartyForm.notes} onChange={(event) => setThirdPartyForm((prev) => ({ ...prev, notes: event.target.value }))} />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={handleSaveThirdParty}>{thirdPartyForm.id ? "Mettre à jour" : "Ajouter"}</Button>
              {thirdPartyForm.id && <Button variant="outlined" onClick={() => setThirdPartyForm({ id: "", name: "", type: "supplier", notes: "" })}>Annuler</Button>}
            </Stack>
          </Box>
          {visibleThirdPartyDetails.length === 0 ? (
            <EmptyState message={currentSearch ? "Aucun tiers ne correspond à votre recherche." : "Aucun tiers à afficher."} searchValue={currentSearch} onClearSearch={() => setTabSearch("")} onAdd={startCreateThirdParty} addLabel="Ajouter" />
          ) : (
            <Stack spacing={0.75}>
              {visibleThirdPartyDetails.map((detail) => {
                const thirdParty = detail.item;
                const type = THIRD_PARTY_TYPE_OPTIONS.find((option) => option.value === thirdParty.type)?.label || "Autre";
                const edit = () => setThirdPartyForm({ id: thirdParty.id, name: thirdParty.name || "", type: thirdParty.type || "other", notes: thirdParty.notes || "" });
                return (
                  <ReferenceCard
                    key={thirdParty.id}
                    item={thirdParty}
                    title={thirdParty.name || "Tiers"}
                    eyebrow={type}
                    color={HORIZON_COLORS.orange}
                    details={[thirdParty.notes || "Associations variables selon les transactions"]}
                    editable
                    onOpen={() => openReferenceDetail("third-parties", thirdParty.id)}
                    onEdit={edit}
                    editableRowProps={editableRowProps}
                    actions={[
                      { label: "Modifier", onClick: edit },
                      thirdParty.isActive ? { label: "Désactiver", onClick: () => deactivateThirdParty(thirdParty.id) } : { label: "Activer", onClick: () => updateThirdParty(thirdParty.id, { ...thirdParty, isActive: true }) },
                    ]}
                  />
                );
              })}
            </Stack>
          )}
        </Stack>
      )}

      {tab === "projects" && (
        <Stack spacing={1.25}>
          <ReferenceHeader title="Projets" items={projects} onAdd={startCreateProject} />
          <Controls total={projects.length} shown={visibleProjects.length} label="projets" placeholder="Rechercher un projet" />
          <Button size="small" variant="outlined" onClick={handleSeedProjects} sx={{ alignSelf: "flex-start" }}>Charger exemples</Button>
          <Box sx={{ display: "grid", gap: 1, gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" } }}>
            <TextField id="reference-project-name" label="Nom" size="small" value={projectForm.name} onChange={(event) => setProjectForm((prev) => ({ ...prev, name: event.target.value }))} />
            <TextField label="Activite liee (facultatif)" size="small" select value={projectForm.activityId} onChange={(event) => setProjectForm((prev) => ({ ...prev, activityId: event.target.value }))}>
              <MenuItem value="">Aucune</MenuItem>
              {activities.filter((activity) => activity.isActive).map((activity) => <MenuItem key={activity.id} value={activity.id}>{activity.name}</MenuItem>)}
            </TextField>
            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={handleSaveProject}>{projectForm.id ? "Mettre à jour" : "Ajouter"}</Button>
              {projectForm.id && <Button variant="outlined" onClick={() => setProjectForm({ id: "", name: "", activityId: "", startDate: "", endDate: "", notes: "" })}>Annuler</Button>}
            </Stack>
            <TextField label="Début" size="small" type="date" value={projectForm.startDate} onChange={(event) => setProjectForm((prev) => ({ ...prev, startDate: event.target.value }))} InputLabelProps={{ shrink: true }} />
            <TextField label="Fin" size="small" type="date" value={projectForm.endDate} onChange={(event) => setProjectForm((prev) => ({ ...prev, endDate: event.target.value }))} InputLabelProps={{ shrink: true }} />
            <TextField label="Notes" size="small" value={projectForm.notes} onChange={(event) => setProjectForm((prev) => ({ ...prev, notes: event.target.value }))} />
          </Box>
          {visibleProjectDetails.length === 0 ? (
            <EmptyState message={currentSearch ? "Aucun projet ne correspond à votre recherche." : "Aucun projet à afficher."} searchValue={currentSearch} onClearSearch={() => setTabSearch("")} onAdd={startCreateProject} addLabel="Ajouter" />
          ) : (
            <Stack spacing={0.75}>
              {visibleProjectDetails.map((detail) => {
                const project = detail.item;
                const activity = activityMap.get(project.activityId);
                const edit = () => setProjectForm({ id: project.id, name: project.name || "", activityId: project.activityId || "", startDate: project.startDate || "", endDate: project.endDate || "", notes: project.notes || "" });
                return (
                  <ReferenceCard
                    key={project.id}
                    item={project}
                    title={project.name || "Projet"}
                    eyebrow={activity?.name || "Sans activité"}
                    color={HORIZON_COLORS.blue}
                    details={[`Activité parente: ${activity?.name || "Aucune"}`, `Dates: ${project.startDate || "-"} - ${project.endDate || "-"}`, project.notes || ""]}
                    editable
                    onOpen={() => openReferenceDetail("projects", project.id)}
                    onEdit={edit}
                    editableRowProps={editableRowProps}
                    actions={[
                      { label: "Modifier", onClick: edit },
                      project.isActive ? { label: "Désactiver", onClick: () => deactivateProject(project.id) } : { label: "Activer", onClick: () => updateProject(project.id, { ...project, isActive: true }) },
                    ]}
                  />
                );
              })}
            </Stack>
          )}
        </Stack>
      )}

      <ReferentialPilotDrawer
        open={Boolean(selectedReference)}
        detail={selectedReference}
        searchText={currentSearch}
        sortKey={currentSort}
        transactionFilters={transactionFilters}
        transactionSort={transactionSort}
        onSearchChange={setTabSearch}
        onSortChange={setTabSort}
        onTransactionFiltersChange={setTransactionFilters}
        onTransactionSortChange={setTransactionSort}
        onClose={closeReferenceDetail}
        onOpenReference={openReferenceDetail}
        onOpenTransaction={handleOpenTransaction}
        onEditTransaction={handleOpenTransaction}
        onDeleteTransaction={handleDeleteTransaction}
        onRename={startRename}
        onToggleActive={toggleReferenceActive}
        onOpenMergePreview={openMergePreview}
      />

      <Dialog open={Boolean(mergePreview)} onClose={() => setMergePreview(null)} fullWidth maxWidth="sm">
        <DialogTitle>{mergePreview?.mode === "replace" ? "Remplacer par..." : "Fusionner"}</DialogTitle>
        <DialogContent>
          {mergePreview && (
            <Stack spacing={1.1} sx={{ pt: 1 }}>
              <Typography variant="body2">
                Référentiel source : <strong>{mergePreview.detail.name}</strong>
              </Typography>
              <TextField
                label={mergePreview.mode === "replace" ? "Remplacer par" : "Fusionner avec"}
                select
                value={mergePreview.targetId}
                onChange={(event) => setMergePreview((previous) => ({ ...previous, targetId: event.target.value }))}
                fullWidth
                size="small"
              >
                {mergePreview.candidates.map((candidate) => (
                  <MenuItem key={candidate.id} value={candidate.id}>{candidate.name}</MenuItem>
                ))}
              </TextField>

              <Alert severity="info">
                Aperçu d'impact : {mergePreview.detail.impact.transactions} transaction(s), {mergePreview.detail.impact.budgets} budget(s), {mergePreview.detail.impact.fixedExpenses} frais fixe(s), {mergePreview.detail.impact.recurringIncome} revenu(x) récurrent(s), {mergePreview.detail.impact.projects} projet(s).
              </Alert>

              <Typography variant="caption" color="text.secondary">
                Cette étape affiche l'impact avant toute fusion. Aucun moteur métier n'est modifié ici.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={applyMergePreview} disabled={!mergePreview?.targetId}>Appliquer</Button>
          <Button onClick={() => setMergePreview(null)}>Fermer</Button>
        </DialogActions>
      </Dialog>
    </AppPage>
  );
}
