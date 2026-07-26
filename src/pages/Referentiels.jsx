import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
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
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import Clear from "@mui/icons-material/Clear";
import MoreVert from "@mui/icons-material/MoreVert";
import Search from "@mui/icons-material/Search";
import { useCategories } from "../hooks/useCategories";
import { useSubcategories } from "../hooks/useSubcategories";
import { useActivities } from "../hooks/useActivities";
import { useThirdParties } from "../hooks/useThirdParties";
import { useProjects } from "../hooks/useProjects";
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
  borderRadius: 2,
  bgcolor: "rgba(255,255,255,0.96)",
  boxShadow: "0 10px 22px rgba(20, 41, 43, 0.06)",
  transition: "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
  "&:hover": {
    borderColor: "rgba(15, 95, 143, 0.24)",
    boxShadow: "0 14px 28px rgba(20, 41, 43, 0.09)",
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
  onEdit,
  actions = [],
  editableRowProps,
}) {
  const content = (
    <Box
      {...(editable ? editableRowProps(onEdit) : {})}
      sx={{
        ...CARD_SX,
        ...(editable ? editableRowProps(onEdit).sx : {}),
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
              {details.filter(Boolean).slice(0, 3).map((detail) => (
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

export default function Referentiels({ accounts = [], addAccount, updateAccount, deleteAccount }) {
  const enableDesktopDoubleClickEdit = useMediaQuery("(min-width:900px)");
  const [tab, setTab] = useState("accounts");
  const [message, setMessage] = useState("");
  const [searchByTab, setSearchByTab] = useState({
    accounts: "",
    subcategories: "",
    activities: "",
    "third-parties": "",
    projects: "",
  });
  const [statusByTab, setStatusByTab] = useState({
    accounts: "all",
    subcategories: "all",
    activities: "all",
    "third-parties": "all",
    projects: "all",
  });

  const editableRowProps = (onEdit) => ({
    onDoubleClick: (event) => {
      if (!enableDesktopDoubleClickEdit || event.target.closest("button, a, input, textarea, select, [role='button']")) return;
      onEdit();
    },
    sx: {
      cursor: enableDesktopDoubleClickEdit ? "pointer" : "default",
    },
  });

  const { categories } = useCategories();
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
  const currentSearch = searchByTab[tab] || "";
  const currentStatus = statusByTab[tab] || "all";

  const incomeCategoryIds = useMemo(
    () => new Set(categories.filter((category) => category.type === "revenu").map((category) => category.id)),
    [categories]
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

  function filterStatus(items) {
    if (currentStatus === "active") return items.filter((item) => item?.isActive !== false);
    if (currentStatus === "inactive") return items.filter((item) => item?.isActive === false);
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
      const category = categories.find((item) => normalizeText(item.name) === normalizeText(seed.categoryName));
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

  const currentError = subcategoriesError || activitiesError || thirdPartiesError || projectsError;

  function Controls({ total, shown, label, placeholder, extra = null }) {
    return (
      <Stack spacing={1}>
        <ReferenceSearch value={currentSearch} onChange={setTabSearch} placeholder={placeholder} />
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between">
          <ReferenceSummary shown={shown} total={total} label={label} filterLabel={currentStatus === "active" ? "Actifs" : currentStatus === "inactive" ? "Inactifs" : "Tous"} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
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
    <Box sx={{ display: "grid", gap: 2, color: HORIZON_COLORS.ink }}>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 900, lineHeight: 1.15 }}>
          Référentiels
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Comptes, sous-catégories, activités, tiers et projets utilisés dans Horizon.
        </Typography>
      </Box>

      {message && <Alert severity={message.includes("Erreur") ? "error" : "success"}>{message}</Alert>}
      {currentError && <Alert severity="error">{currentError}</Alert>}

      <Box sx={{ ...CARD_SX, p: { xs: 1, sm: 1.25 } }}>
        <Tabs value={tab} onChange={(event, value) => setTab(value)} variant="scrollable" allowScrollButtonsMobile sx={{ minHeight: 42 }}>
          <Tab value="accounts" label="Comptes" />
          <Tab value="subcategories" label="Sous-catégories" />
          <Tab value="activities" label="Activités" />
          <Tab value="third-parties" label="Tiers" />
          <Tab value="projects" label="Projets" />
        </Tabs>
      </Box>

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
                  {categories.map((category) => <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>)}
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
              {categories.map((category) => <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>)}
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
          {visibleSubcategories.length === 0 ? (
            <EmptyState message={currentSearch ? "Aucune sous-catégorie ne correspond à votre recherche." : "Aucune sous-catégorie à afficher."} searchValue={currentSearch} onClearSearch={() => setTabSearch("")} onAdd={startCreateSubcategory} addLabel="Ajouter" />
          ) : (
            <Stack spacing={0.75}>
              {visibleSubcategories.map((subcategory) => {
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
          {visibleActivities.length === 0 ? (
            <EmptyState message={currentSearch ? "Aucune activité ne correspond à votre recherche." : "Aucune activité à afficher."} searchValue={currentSearch} onClearSearch={() => setTabSearch("")} onAdd={startCreateActivity} addLabel="Ajouter" />
          ) : (
            <Stack spacing={0.75}>
              {visibleActivities.map((activity) => {
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
          {visibleThirdParties.length === 0 ? (
            <EmptyState message={currentSearch ? "Aucun tiers ne correspond à votre recherche." : "Aucun tiers à afficher."} searchValue={currentSearch} onClearSearch={() => setTabSearch("")} onAdd={startCreateThirdParty} addLabel="Ajouter" />
          ) : (
            <Stack spacing={0.75}>
              {visibleThirdParties.map((thirdParty) => {
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
          {visibleProjects.length === 0 ? (
            <EmptyState message={currentSearch ? "Aucun projet ne correspond à votre recherche." : "Aucun projet à afficher."} searchValue={currentSearch} onClearSearch={() => setTabSearch("")} onAdd={startCreateProject} addLabel="Ajouter" />
          ) : (
            <Stack spacing={0.75}>
              {visibleProjects.map((project) => {
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
    </Box>
  );
}
