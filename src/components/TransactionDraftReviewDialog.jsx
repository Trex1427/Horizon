import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { getCategoryOptions } from "../constants/transactionCategories";
import {
  getReceiptCategorySuggestionState,
  normalizeReceiptDraft,
} from "../utils/receiptDraftIntelligence";
import { validateTransactionForm } from "../utils/transactionDraftMapper";
import AccountSelector from "./AccountSelector";
import { getSafeCategoryLabel } from "../utils/displayTextUtils";
import VehicleFormDialog from "./VehicleFormDialog.jsx";
import { CREATE_VEHICLE_VALUE } from "../constants/transactionVehicleReference.js";
import { sortVehicles } from "../services/vehicleModel.js";

function normalizeCategoryName(value) {
  return (value || "").trim().toLowerCase();
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
    return [{ id: currentCategoryId || "", name: currentCategory }, ...deduped];
  }

  return deduped;
}

export default function TransactionDraftReviewDialog({
  open,
  initialDraft,
  accounts = [],
  categories = [],
  subcategories = [],
  activities = [],
  thirdParties = [],
  projects = [],
  vehicles = [],
  defaultAccount,
  submitting = false,
  onClose,
  onConfirm,
  onCreateVehicle,
}) {
  const [form, setForm] = useState(initialDraft || null);
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [quickVehicleOpen, setQuickVehicleOpen] = useState(false);
  const [quickCreatedVehicle, setQuickCreatedVehicle] = useState(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setSuggestionOpen(false);

    setForm((previous) => {
      const next = normalizeReceiptDraft(initialDraft || previous || {});
      if (!next) {
        return null;
      }

      if (next.accountId || !defaultAccount?.id) {
        return next;
      }

      return {
        ...next,
        accountId: defaultAccount.id,
      };
    });
  }, [open, initialDraft, defaultAccount]);

  const categoryOptions = useMemo(() => {
    if (!form) {
      return [];
    }

    const expectedType = form.type === "revenu" ? "revenu" : "depense";
    const firestoreCategories = categories
      .filter((category) => category.type === expectedType)
      .map((category) => ({ id: category.id, name: category.name }))
      .filter((category) => Boolean(category.name));

    if (firestoreCategories.length > 0) {
      return getUniqueCategoryOptions(firestoreCategories, form.categorie, form.categoryId);
    }

    return getUniqueCategoryOptions(
      getCategoryOptions(form.type).map((categoryName) => ({ id: "", name: categoryName })),
      form.categorie,
      form.categoryId
    );
  }, [categories, form]);

  const validationMessage = useMemo(() => {
    if (!form) {
      return "Le brouillon est indisponible ❌";
    }

    return validateTransactionForm(form);
  }, [form]);

  const filteredSubcategories = useMemo(() => {
    if (!form?.categoryId) {
      return [];
    }

    return subcategories.filter((subcategory) => subcategory.isActive !== false && subcategory.categoryId === form.categoryId);
  }, [form?.categoryId, subcategories]);

  const prioritizedProjects = useMemo(() => {
    const activeProjects = projects.filter((project) => project.isActive !== false);
    if (!form?.activityId) {
      return activeProjects;
    }

    const linked = activeProjects.filter((project) => project.activityId === form.activityId);
    const remaining = activeProjects.filter((project) => project.activityId !== form.activityId);
    return [...linked, ...remaining];
  }, [projects, form?.activityId]);

  const vehicleOptions = useMemo(() => {
    const activeVehicles = vehicles.filter((vehicle) => vehicle.isDeleted !== true);
    if (!quickCreatedVehicle || activeVehicles.some((vehicle) => vehicle.id === quickCreatedVehicle.id)) {
      return activeVehicles;
    }

    return sortVehicles([...activeVehicles, quickCreatedVehicle]);
  }, [quickCreatedVehicle, vehicles]);

  const suggestionState = useMemo(() => {
    if (!form) {
      return null;
    }

    return getReceiptCategorySuggestionState(form, categories);
  }, [categories, form]);

  const suggestionLabel = getSafeCategoryLabel(suggestionState?.suggestedDisplayName, "Aucune");

  const suggestionAlertSeverity = suggestionState?.level === "high"
    ? "success"
    : suggestionState?.level === "medium"
      ? "warning"
      : "info";

  const suggestionAlertMessage = suggestionState?.level === "high"
    ? "Catégorie préremplie à vérifier avant création."
    : suggestionState?.level === "medium"
      ? "Suggestion détectée : vérification manuelle requise avant création."
      : suggestionState?.level === "unknown"
        ? "Suggestion non appliquée automatiquement car l'identifiant de catégorie est absent ou invalide."
        : "Aucune catégorie n'a été sélectionnée automatiquement.";

  const confidenceDetails = [
    { label: "Commercant", value: form?.merchantConfidence },
    { label: "Date", value: form?.dateConfidence },
    { label: "Montant", value: form?.amountConfidence },
  ].filter((entry) => entry.value !== null && entry.value !== undefined);

  function handleChange(event) {
    const { name, value } = event.target;

    if (name === "vehicleId" && value === CREATE_VEHICLE_VALUE) {
      setQuickVehicleOpen(true);
      return;
    }

    setForm((previous) => {
      if (!previous) {
        return previous;
      }

      if (name === "type") {
        const nextType = value;

        const fallback = getCategoryOptions(nextType)[0] || "";
        return {
          ...previous,
          type: nextType,
          categorie: fallback,
          categoryName: fallback,
          categoryId: "",
          subcategoryId: "",
          subcategoryName: "",
        };
      }

      if (name === "categorie") {
        const selectedCategory = categoryOptions.find((option) => (option.id || option.name) === value);
        const categoryName = selectedCategory?.name || value;

        return {
          ...previous,
          categorie: categoryName,
          categoryName,
          categoryId: selectedCategory?.id || "",
          subcategoryId: "",
          subcategoryName: "",
        };
      }

      if (name === "subcategoryId") {
        const subcategory = filteredSubcategories.find((entry) => entry.id === value);
        return {
          ...previous,
          subcategoryId: value,
          subcategoryName: subcategory?.name || "",
        };
      }

      if (name === "activityId") {
        const activity = activities.find((entry) => entry.id === value && entry.isActive !== false);
        return {
          ...previous,
          activityId: value,
          activityName: activity?.name || "",
        };
      }

      if (name === "thirdPartyId") {
        const thirdParty = thirdParties.find((entry) => entry.id === value && entry.isActive !== false);
        return {
          ...previous,
          thirdPartyId: value,
          thirdPartyName: thirdParty?.name || "",
        };
      }

      if (name === "projectId") {
        const project = projects.find((entry) => entry.id === value && entry.isActive !== false);
        return {
          ...previous,
          projectId: value,
          projectName: project?.name || "",
        };
      }

      return {
        ...previous,
        [name]: value,
      };
    });
  }

  function handleConfirm() {
    if (!form || validationMessage) {
      return;
    }

    onConfirm?.(form);
  }

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Verifier le brouillon du ticket</DialogTitle>
      <DialogContent sx={{ pt: 1.5, pb: 1, px: { xs: 1.5, sm: 2 } }}>
        <Alert severity="info" sx={{ mb: 1.25, mt: 0.75 }}>
          Vérifiez et corrigez les champs avant de créer la transaction.
        </Alert>

        {form?.rawTranscript && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            Reconnaissance vocale : "{form.rawTranscript}"
          </Typography>
        )}

        {validationMessage && (
          <Alert severity="error" sx={{ mb: 1.25 }}>
            {validationMessage}
          </Alert>
        )}

        {suggestionState?.visible && (
          <Alert severity={suggestionAlertSeverity} sx={{ mb: 1.25 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Catégorie suggérée : {suggestionLabel}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Confiance : {form?.categoryConfidence !== null ? `${Math.round((form?.categoryConfidence || 0) * 100)} %` : "N/A"}
              </Typography>
              <Button size="small" onClick={() => setSuggestionOpen((previous) => !previous)} sx={{ minWidth: 0, p: 0 }}>
                Pourquoi ?
              </Button>
            </Box>
            {confidenceDetails.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                {confidenceDetails.map((entry) => `${entry.label} ${Math.round(entry.value * 100)} %`).join(" | ")}
              </Typography>
            )}
            <Typography variant="body2" sx={{ mt: 0.75 }}>
              {suggestionAlertMessage}
            </Typography>
            <Collapse in={suggestionOpen}>
              <Box sx={{ mt: 1.5 }}>
                <Typography variant="body2" sx={{ mb: 0.75 }}>
                  <strong>Raison :</strong> {form?.categoryReason || "Aucune raison fournie."}
                </Typography>

                {form?.keywords?.length > 0 ? (
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mb: 1.25 }}>
                    {form.keywords.slice(0, 8).map((keyword) => (
                      <Chip key={keyword} label={keyword} size="small" variant="outlined" />
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25 }}>
                    Mots-cles detectes: aucun
                  </Typography>
                )}

                {form?.items?.length > 0 ? (
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                      Articles detectes
                    </Typography>
                    {form.items.slice(0, 4).map((item, index) => (
                      <Typography key={`${item.label}-${index}`} variant="body2" color="text.secondary">
                        {`- ${item.label}`}
                        {item.quantity !== null ? ` x${item.quantity}` : ""}
                        {item.unitAmount !== null ? ` @ ${item.unitAmount.toFixed(2)} EUR` : ""}
                        {item.amount !== null ? ` (${item.amount.toFixed(2)} EUR)` : ""}
                      </Typography>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    Articles detectes: aucun
                  </Typography>
                )}
              </Box>
            </Collapse>
          </Alert>
        )}

        <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" } }}>
          <TextField
            label="Date"
            name="date"
            type="date"
            value={form?.date || ""}
            onChange={handleChange}
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
          />

          <TextField
            label="Type"
            name="type"
            select
            value={form?.type || "depense"}
            onChange={handleChange}
            fullWidth
            size="small"
          >
            <MenuItem value="depense">Dépense</MenuItem>
            <MenuItem value="revenu">Revenu</MenuItem>
          </TextField>

          <TextField
            label="Montant"
            name="montant"
            type="number"
            value={form?.montant || ""}
            onChange={handleChange}
            fullWidth
            size="small"
            sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
          />

          <TextField
            label="Catégorie"
            name="categorie"
            select
            value={form?.categoryId || form?.categorie || ""}
            onChange={handleChange}
            fullWidth
            size="small"
          >
            {categoryOptions.map((category) => (
              <MenuItem key={`${category.id || "legacy"}-${category.name}`} value={category.id || category.name}>
                {getSafeCategoryLabel(category.name)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Sous-catégorie"
            name="subcategoryId"
            select
            value={form?.subcategoryId || ""}
            onChange={handleChange}
            fullWidth
            size="small"
            disabled={!form?.categoryId}
          >
            <MenuItem value="">Aucune</MenuItem>
            {filteredSubcategories.map((subcategory) => (
              <MenuItem key={subcategory.id} value={subcategory.id}>{subcategory.name}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="Activite"
            name="activityId"
            select
            value={form?.activityId || ""}
            onChange={handleChange}
            fullWidth
            size="small"
          >
            <MenuItem value="">Aucune</MenuItem>
            {activities.filter((activity) => activity.isActive !== false).map((activity) => (
              <MenuItem key={activity.id} value={activity.id}>{activity.name}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="Tiers"
            name="thirdPartyId"
            select
            value={form?.thirdPartyId || ""}
            onChange={handleChange}
            fullWidth
            size="small"
          >
            <MenuItem value="">Aucun</MenuItem>
            {thirdParties.filter((thirdParty) => thirdParty.isActive !== false).map((thirdParty) => (
              <MenuItem key={thirdParty.id} value={thirdParty.id}>{thirdParty.name}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="Projet"
            name="projectId"
            select
            value={form?.projectId || ""}
            onChange={handleChange}
            fullWidth
            size="small"
          >
            <MenuItem value="">Aucun</MenuItem>
            {prioritizedProjects.map((project) => (
              <MenuItem key={project.id} value={project.id}>{project.name}</MenuItem>
            ))}
          </TextField>

          <AccountSelector
            value={form?.accountId || ""}
            onChange={handleChange}
            accounts={accounts}
            label="Compte source"
            size="small"
            sx={{ mb: 0 }}
          />

          {form?.type === "depense" && (
            <TextField
              label="Véhicule"
              name="vehicleId"
              select
              value={form?.vehicleId || ""}
              onChange={handleChange}
              fullWidth
              size="small"
            >
              <MenuItem value="">Aucun</MenuItem>
              {vehicleOptions.map((vehicle) => (
                <MenuItem key={vehicle.id} value={vehicle.id}>{vehicle.name}</MenuItem>
              ))}
              <MenuItem value={CREATE_VEHICLE_VALUE}>+ Ajouter un véhicule</MenuItem>
            </TextField>
          )}

          <TextField
            label="Description"
            name="description"
            value={form?.description || ""}
            onChange={handleChange}
            fullWidth
            size="small"
            sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={submitting} size="small">
          Annuler
        </Button>
        <Button onClick={handleConfirm} disabled={submitting || Boolean(validationMessage)} variant="contained" sx={{ minHeight: 42 }}>
          Créer la transaction
        </Button>
      </DialogActions>
      <VehicleFormDialog
        open={quickVehicleOpen}
        title="Ajouter un véhicule"
        onClose={() => setQuickVehicleOpen(false)}
        onSave={async (name) => {
          const result = await onCreateVehicle?.({ name });
          if (result?.success) {
            const createdVehicle = { id: result.value.id, name, isDeleted: false };
            setQuickCreatedVehicle(createdVehicle);
            setForm((previous) => ({ ...previous, vehicleId: createdVehicle.id }));
          }
          return result || { success: false, error: "Création du véhicule indisponible." };
        }}
      />
    </Dialog>
  );
}
