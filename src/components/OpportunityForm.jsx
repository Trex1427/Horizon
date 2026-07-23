import { useEffect, useMemo, useRef, useState } from "react";
import { MenuItem, Stack, TextField } from "@mui/material";
import AccountSelector from "./AccountSelector";
import EntityFormDialog from "./EntityFormDialog";
import EntityDialog from "./EntityDialog";
import { OPPORTUNITY_STATUSES } from "../constants/opportunityConstants";
import { ACTIVITY_KIND_OPTIONS, THIRD_PARTY_TYPE_OPTIONS } from "../constants/referenceCatalog";
import { CREATE_ACTIVITY_VALUE, CREATE_PROJECT_VALUE, CREATE_THIRD_PARTY_VALUE } from "../constants/transactionReferenceCreateValues";
import { getSafeCategoryLabel } from "../utils/displayTextUtils";

const defaultForm = {
  name: "",
  description: "",
  estimatedAmount: "",
  estimatedDate: "",
  accountId: "",
  categoryId: "",
  categoryName: "",
  category: "",
  projectId: "",
  projectName: "",
  thirdPartyId: "",
  thirdPartyName: "",
  activityId: "",
  activityName: "",
  realizedAmount: "",
  realizedDate: "",
  status: "À étudier",
  comment: "",
  isActive: true,
};

function toFormValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

export default function OpportunityForm({
  open,
  onClose,
  onSubmit,
  initialOpportunity = null,
  isLoading = false,
  accounts = [],
  categories = [],
  projects = [],
  thirdParties = [],
  activities = [],
  onRequestCreateThirdParty,
  onRequestCreateActivity,
  onRequestCreateProject,
}) {
  const [formData, setFormData] = useState(defaultForm);
  const [errors, setErrors] = useState({});
  const [quickThirdPartyOpen, setQuickThirdPartyOpen] = useState(false);
  const [quickThirdPartyForm, setQuickThirdPartyForm] = useState({ name: "", type: "supplier", notes: "" });
  const [quickThirdPartyError, setQuickThirdPartyError] = useState("");
  const [quickThirdPartySubmitting, setQuickThirdPartySubmitting] = useState(false);
  const quickThirdPartySubmittingRef = useRef(false);
  const [quickActivityOpen, setQuickActivityOpen] = useState(false);
  const [quickActivityForm, setQuickActivityForm] = useState({ name: "", kind: "profit_center" });
  const [quickActivityError, setQuickActivityError] = useState("");
  const [quickActivitySubmitting, setQuickActivitySubmitting] = useState(false);
  const quickActivitySubmittingRef = useRef(false);
  const [quickProjectOpen, setQuickProjectOpen] = useState(false);
  const [quickProjectForm, setQuickProjectForm] = useState({ name: "", activityId: "", startDate: "", endDate: "", notes: "" });
  const [quickProjectError, setQuickProjectError] = useState("");
  const [quickProjectSubmitting, setQuickProjectSubmitting] = useState(false);
  const quickProjectSubmittingRef = useRef(false);
  const incomeCategories = useMemo(
    () => (categories || []).filter((category) => category?.isActive !== false && category?.type === "revenu"),
    [categories]
  );
  const activeProjects = useMemo(
    () => (projects || []).filter((project) => project?.isActive !== false),
    [projects]
  );
  const activeThirdParties = useMemo(
    () => (thirdParties || []).filter((thirdParty) => thirdParty?.isActive !== false),
    [thirdParties]
  );
  const activeActivities = useMemo(
    () => (activities || []).filter((activity) => activity?.isActive !== false),
    [activities]
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
  const formProjectOptions = useMemo(() => {
    if (!formData.projectId || activeProjects.some((project) => project.id === formData.projectId)) {
      return activeProjects;
    }

    return [
      {
        id: formData.projectId,
        name: formData.projectName || projectMap.get(formData.projectId)?.name || "Projet",
      },
      ...activeProjects,
    ];
  }, [activeProjects, formData.projectId, formData.projectName, projectMap]);
  const formActivityOptions = useMemo(() => {
    if (!formData.activityId || activeActivities.some((activity) => activity.id === formData.activityId)) {
      return activeActivities;
    }

    return [
      {
        id: formData.activityId,
        name: formData.activityName || activityMap.get(formData.activityId)?.name || "Activite",
      },
      ...activeActivities,
    ];
  }, [activeActivities, activityMap, formData.activityId, formData.activityName]);
  const formThirdPartyOptions = useMemo(() => {
    if (!formData.thirdPartyId || activeThirdParties.some((thirdParty) => thirdParty.id === formData.thirdPartyId)) {
      return activeThirdParties;
    }

    return [
      {
        id: formData.thirdPartyId,
        name: formData.thirdPartyName || thirdPartyMap.get(formData.thirdPartyId)?.name || "Tiers",
      },
      ...activeThirdParties,
    ];
  }, [activeThirdParties, formData.thirdPartyId, formData.thirdPartyName, thirdPartyMap]);

  useEffect(() => {
    if (initialOpportunity) {
      setFormData({
        ...defaultForm,
        name: initialOpportunity.name || "",
        description: initialOpportunity.description || "",
        estimatedAmount: toFormValue(initialOpportunity.estimatedAmount),
        estimatedDate: initialOpportunity.estimatedDate || "",
        accountId: initialOpportunity.accountId || "",
        categoryId: initialOpportunity.categoryId || "",
        categoryName: initialOpportunity.categoryName || initialOpportunity.category || "",
        category: initialOpportunity.category || initialOpportunity.categoryName || "",
        projectId: initialOpportunity.projectId || "",
        projectName: initialOpportunity.projectName || "",
        thirdPartyId: initialOpportunity.thirdPartyId || "",
        thirdPartyName: initialOpportunity.thirdPartyName || "",
        activityId: initialOpportunity.activityId || "",
        activityName: initialOpportunity.activityName || "",
        realizedAmount: toFormValue(initialOpportunity.realizedAmount),
        realizedDate: initialOpportunity.realizedDate || "",
        status: initialOpportunity.status || "À étudier",
        comment: initialOpportunity.comment || "",
        isActive: initialOpportunity.isActive !== false,
      });
    } else {
      setFormData(defaultForm);
    }

    setErrors({});
  }, [initialOpportunity, open]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    if (errors[name]) {
      setErrors((previous) => ({ ...previous, [name]: null }));
    }
  }

  function openQuickThirdPartyDialog() {
    setQuickThirdPartyForm({ name: "", type: "supplier", notes: "" });
    setQuickThirdPartyError("");
    setQuickThirdPartyOpen(true);
  }

  function openQuickActivityDialog() {
    setQuickActivityForm({ name: "", kind: "profit_center" });
    setQuickActivityError("");
    setQuickActivityOpen(true);
  }

  function openQuickProjectDialog(activityId = formData.activityId) {
    setQuickProjectForm({ name: "", activityId: activityId || "", startDate: "", endDate: "", notes: "" });
    setQuickProjectError("");
    setQuickProjectOpen(true);
  }

  async function handleQuickThirdPartyCreate() {
    if (quickThirdPartySubmittingRef.current) {
      return;
    }

    const trimmedName = quickThirdPartyForm.name.trim();

    if (!trimmedName) {
      setQuickThirdPartyError("Le nom du tiers est obligatoire.");
      return;
    }

    if (typeof onRequestCreateThirdParty !== "function") {
      setQuickThirdPartyError("Creation rapide indisponible.");
      return;
    }

    quickThirdPartySubmittingRef.current = true;
    setQuickThirdPartySubmitting(true);

    let result;
    try {
      result = await onRequestCreateThirdParty({
        name: trimmedName,
        type: quickThirdPartyForm.type,
        notes: quickThirdPartyForm.notes,
        isActive: true,
      });
    } finally {
      quickThirdPartySubmittingRef.current = false;
      setQuickThirdPartySubmitting(false);
    }

    if (!result?.success || !result?.id) {
      setQuickThirdPartyError(result?.error || "Erreur lors de la création du tiers.");
      return;
    }

    setFormData((previous) => ({
      ...previous,
      thirdPartyId: result.id,
      thirdPartyName: trimmedName,
    }));
    setQuickThirdPartyOpen(false);
    setQuickThirdPartyForm({ name: "", type: "supplier", notes: "" });
    setQuickThirdPartyError("");
  }

  async function handleQuickActivityCreate() {
    if (quickActivitySubmittingRef.current) {
      return;
    }

    const trimmedName = quickActivityForm.name.trim();

    if (!trimmedName) {
      setQuickActivityError("Le nom de l'activité est obligatoire.");
      return;
    }

    if (typeof onRequestCreateActivity !== "function") {
      setQuickActivityError("Creation rapide indisponible.");
      return;
    }

    quickActivitySubmittingRef.current = true;
    setQuickActivitySubmitting(true);

    let result;
    try {
      result = await onRequestCreateActivity({
        name: trimmedName,
        kind: quickActivityForm.kind,
        isActive: true,
      });
    } finally {
      quickActivitySubmittingRef.current = false;
      setQuickActivitySubmitting(false);
    }

    if (!result?.success || !result?.id) {
      setQuickActivityError(result?.error || "Erreur lors de la création de l'activité.");
      return;
    }

    setFormData((previous) => ({
      ...previous,
      activityId: result.id,
      activityName: trimmedName,
    }));
    setQuickActivityOpen(false);
    setQuickActivityForm({ name: "", kind: "profit_center" });
    setQuickActivityError("");
  }

  async function handleQuickProjectCreate() {
    if (quickProjectSubmittingRef.current) {
      return;
    }

    const trimmedName = quickProjectForm.name.trim();

    if (!trimmedName) {
      setQuickProjectError("Le nom du projet est obligatoire.");
      return;
    }

    if (typeof onRequestCreateProject !== "function") {
      setQuickProjectError("Creation rapide indisponible.");
      return;
    }

    quickProjectSubmittingRef.current = true;
    setQuickProjectSubmitting(true);

    let result;
    try {
      result = await onRequestCreateProject({
        name: trimmedName,
        activityId: quickProjectForm.activityId || null,
        startDate: quickProjectForm.startDate || null,
        endDate: quickProjectForm.endDate || null,
        notes: quickProjectForm.notes,
        isActive: true,
      });
    } finally {
      quickProjectSubmittingRef.current = false;
      setQuickProjectSubmitting(false);
    }

    if (!result?.success || !result?.id) {
      setQuickProjectError(result?.error || "Erreur lors de la création du projet.");
      return;
    }

    setFormData((previous) => ({
      ...previous,
      projectId: result.id,
      projectName: trimmedName,
    }));
    setQuickProjectOpen(false);
    setQuickProjectForm({ name: "", activityId: "", startDate: "", endDate: "", notes: "" });
    setQuickProjectError("");
  }

  function validate() {
    const nextErrors = {};
    const amount = Number(formData.estimatedAmount);

    if (!formData.name.trim()) nextErrors.name = "Nom obligatoire";
    if (!Number.isFinite(amount) || amount <= 0) nextErrors.estimatedAmount = "Montant estime obligatoire";
    if (!formData.estimatedDate) nextErrors.estimatedDate = "Date estimee obligatoire";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

    const result = await onSubmit(formData);
    if (result?.success) {
      setFormData(defaultForm);
      setErrors({});
      onClose();
    }
  }

  return (
    <EntityFormDialog
      open={open}
      title={initialOpportunity ? "Modifier une opportunite" : "Ajouter une opportunite"}
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={isLoading}
      submitLabel={initialOpportunity ? "Enregistrer" : "Créer"}
      maxWidth="md"
    >
      <Stack spacing={2} sx={{ mt: 1 }}>
        <TextField label="Nom" name="name" value={formData.name} onChange={handleChange} error={Boolean(errors.name)} helperText={errors.name} fullWidth />
        <TextField label="Description" name="description" value={formData.description} onChange={handleChange} fullWidth multiline minRows={2} />
        <TextField label="Montant estime" name="estimatedAmount" type="number" value={formData.estimatedAmount} onChange={handleChange} error={Boolean(errors.estimatedAmount)} helperText={errors.estimatedAmount} inputProps={{ step: "0.01", min: "0" }} fullWidth />
        <TextField label="Date estimee" name="estimatedDate" type="date" value={formData.estimatedDate} onChange={handleChange} error={Boolean(errors.estimatedDate)} helperText={errors.estimatedDate} InputLabelProps={{ shrink: true }} fullWidth />
        <AccountSelector value={formData.accountId} onChange={handleChange} accounts={accounts} label="Compte de destination" />
        <TextField
          label="Categorie"
          name="categoryId"
          select
          value={formData.categoryId}
          onChange={(event) => {
            const category = incomeCategories.find((item) => item.id === event.target.value);
            setFormData((previous) => ({
              ...previous,
              categoryId: category?.id || "",
              categoryName: category?.name || "",
              category: category?.name || "",
            }));
          }}
          fullWidth
        >
          <MenuItem value="">Aucune</MenuItem>
          {incomeCategories.map((category) => (
            <MenuItem key={category.id} value={category.id}>
              {getSafeCategoryLabel(category.name)}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Projet"
          name="projectId"
          select
          value={formData.projectId}
          onChange={(event) => {
            if (event.target.value === CREATE_PROJECT_VALUE) {
              openQuickProjectDialog();
              return;
            }

            const project = formProjectOptions.find((item) => item.id === event.target.value);
            setFormData((previous) => ({
              ...previous,
              projectId: project?.id || "",
              projectName: project?.name || "",
            }));
          }}
          fullWidth
        >
          <MenuItem value="">Aucun</MenuItem>
          {formProjectOptions.map((project) => (
            <MenuItem key={project.id} value={project.id}>{project.name}</MenuItem>
          ))}
          <MenuItem value={CREATE_PROJECT_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
            + Créer un projet
          </MenuItem>
        </TextField>
        <TextField
          label="Activite"
          name="activityId"
          select
          value={formData.activityId}
          onChange={(event) => {
            if (event.target.value === CREATE_ACTIVITY_VALUE) {
              openQuickActivityDialog();
              return;
            }

            const activity = activeActivities.find((item) => item.id === event.target.value);
            setFormData((previous) => ({
              ...previous,
              activityId: activity?.id || "",
              activityName: activity?.name || "",
            }));
          }}
          fullWidth
        >
          <MenuItem value="">Aucune</MenuItem>
          {formActivityOptions.map((activity) => (
            <MenuItem key={activity.id} value={activity.id}>{activity.name}</MenuItem>
          ))}
          <MenuItem value={CREATE_ACTIVITY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
            + Créer une activité
          </MenuItem>
        </TextField>
        <TextField
          label="Tiers"
          name="thirdPartyId"
          select
          value={formData.thirdPartyId}
          onChange={(event) => {
            if (event.target.value === CREATE_THIRD_PARTY_VALUE) {
              openQuickThirdPartyDialog();
              return;
            }

            const thirdParty = activeThirdParties.find((item) => item.id === event.target.value);
            setFormData((previous) => ({
              ...previous,
              thirdPartyId: thirdParty?.id || "",
              thirdPartyName: thirdParty?.name || "",
            }));
          }}
          fullWidth
        >
          <MenuItem value="">Aucun</MenuItem>
          {formThirdPartyOptions.map((thirdParty) => (
            <MenuItem key={thirdParty.id} value={thirdParty.id}>{thirdParty.name}</MenuItem>
          ))}
          <MenuItem value={CREATE_THIRD_PARTY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
            + Créer un tiers
          </MenuItem>
        </TextField>
        <TextField label="Statut" name="status" select value={formData.status} onChange={handleChange} fullWidth>
          {OPPORTUNITY_STATUSES.map((status) => (
            <MenuItem key={status} value={status}>{status}</MenuItem>
          ))}
        </TextField>
        {formData.status === "Realise" && (
          <>
            <TextField label="Montant reel percu" name="realizedAmount" type="number" value={formData.realizedAmount} onChange={handleChange} inputProps={{ step: "0.01", min: "0" }} fullWidth />
            <TextField label="Date reelle d'encaissement" name="realizedDate" type="date" value={formData.realizedDate} onChange={handleChange} InputLabelProps={{ shrink: true }} fullWidth />
          </>
        )}
        <TextField label="Commentaire" name="comment" value={formData.comment} onChange={handleChange} fullWidth multiline minRows={2} />
      </Stack>

      <EntityDialog
        open={quickThirdPartyOpen}
        title="Création rapide d'un tiers"
        onClose={() => {
          setQuickThirdPartyOpen(false);
          setQuickThirdPartyError("");
        }}
        onSubmit={handleQuickThirdPartyCreate}
        formId="quick-opportunity-third-party-form"
        errorMessage={quickThirdPartyError}
        submitting={quickThirdPartySubmitting}
        submitLabel="Créer"
        maxWidth="sm"
        isDirty={Boolean(quickThirdPartyForm.name || quickThirdPartyForm.notes || quickThirdPartyForm.type !== "supplier")}
        autoFocusSelector='input[name="quick-opportunity-third-party-name"]'
      >
        <form
          id="quick-opportunity-third-party-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleQuickThirdPartyCreate();
          }}
        >
          <Stack spacing={1.25} sx={{ mt: 0.5 }}>
            <TextField
              label="Nom"
              name="quick-opportunity-third-party-name"
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
          </Stack>
        </form>
      </EntityDialog>

      <EntityDialog
        open={quickProjectOpen}
        title="Création rapide d'un projet"
        onClose={() => {
          setQuickProjectOpen(false);
          setQuickProjectError("");
        }}
        onSubmit={handleQuickProjectCreate}
        formId="quick-opportunity-project-form"
        errorMessage={quickProjectError}
        submitting={quickProjectSubmitting}
        submitLabel="Créer"
        maxWidth="sm"
        isDirty={Boolean(quickProjectForm.name || quickProjectForm.activityId || quickProjectForm.startDate || quickProjectForm.endDate || quickProjectForm.notes)}
        autoFocusSelector='input[name="quick-opportunity-project-name"]'
      >
        <form
          id="quick-opportunity-project-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleQuickProjectCreate();
          }}
        >
          <Stack spacing={1.25} sx={{ mt: 0.5 }}>
            <TextField
              label="Nom"
              name="quick-opportunity-project-name"
              size="small"
              value={quickProjectForm.name}
              onChange={(event) => setQuickProjectForm((previous) => ({ ...previous, name: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Activite"
              select
              size="small"
              value={quickProjectForm.activityId}
              onChange={(event) => setQuickProjectForm((previous) => ({ ...previous, activityId: event.target.value }))}
              fullWidth
            >
              <MenuItem value="">Aucune</MenuItem>
              {formActivityOptions.map((activity) => (
                <MenuItem key={activity.id} value={activity.id}>{activity.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Date de debut"
              type="date"
              size="small"
              value={quickProjectForm.startDate}
              onChange={(event) => setQuickProjectForm((previous) => ({ ...previous, startDate: event.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Date de fin"
              type="date"
              size="small"
              value={quickProjectForm.endDate}
              onChange={(event) => setQuickProjectForm((previous) => ({ ...previous, endDate: event.target.value }))}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Notes"
              size="small"
              value={quickProjectForm.notes}
              onChange={(event) => setQuickProjectForm((previous) => ({ ...previous, notes: event.target.value }))}
              fullWidth
            />
          </Stack>
        </form>
      </EntityDialog>

      <EntityDialog
        open={quickActivityOpen}
        title="Création rapide d'une activité"
        onClose={() => {
          setQuickActivityOpen(false);
          setQuickActivityError("");
        }}
        onSubmit={handleQuickActivityCreate}
        formId="quick-opportunity-activity-form"
        errorMessage={quickActivityError}
        submitting={quickActivitySubmitting}
        submitLabel="Créer"
        maxWidth="sm"
        isDirty={Boolean(quickActivityForm.name || quickActivityForm.kind !== "profit_center")}
        autoFocusSelector='input[name="quick-opportunity-activity-name"]'
      >
        <form
          id="quick-opportunity-activity-form"
          onSubmit={(event) => {
            event.preventDefault();
            handleQuickActivityCreate();
          }}
        >
          <Stack spacing={1.25} sx={{ mt: 0.5 }}>
            <TextField
              label="Nom"
              name="quick-opportunity-activity-name"
              size="small"
              value={quickActivityForm.name}
              onChange={(event) => setQuickActivityForm((previous) => ({ ...previous, name: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Type"
              select
              size="small"
              value={quickActivityForm.kind}
              onChange={(event) => setQuickActivityForm((previous) => ({ ...previous, kind: event.target.value }))}
              fullWidth
            >
              {ACTIVITY_KIND_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>
              ))}
            </TextField>
          </Stack>
        </form>
      </EntityDialog>
    </EntityFormDialog>
  );
}
