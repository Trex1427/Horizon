import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Divider,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import BulkClassificationSuggestionPanel from "./BulkClassificationSuggestionPanel";
import { getMockBulkClassificationSuggestion } from "./bulkClassificationSuggestionMock";
import { buildClassificationImpactSummary } from "./transactionClassificationImpact";
import { getCategoryOptions } from "../constants/transactionCategories";
import { getSafeCategoryLabel } from "../utils/displayTextUtils";
import {
  CREATE_ACCOUNT_VALUE,
  CREATE_ACTIVITY_VALUE,
  CREATE_CATEGORY_VALUE,
  CREATE_PROJECT_VALUE,
  CREATE_SUBCATEGORY_VALUE,
  CREATE_THIRD_PARTY_VALUE,
} from "../constants/transactionReferenceCreateValues";
import {
  buildBulkTransactionPatch,
  resolveBulkTransactionPatchForTransaction,
  summarizeBulkTransactionPatch,
} from "../services/transactionBulkUpdateCore";

const CLEAR_VALUE = "__CLEAR__";
const UNCATEGORIZED_VALUE = "__UNCATEGORIZED__";
const SELECTED_TRANSACTIONS_PREVIEW_LIMIT = 5;
const FALLBACK_TRANSACTION_LABEL = "Transaction sans libellé";

function toTransactionLabel(count) {
  return `${count} transaction${count > 1 ? "s" : ""}`;
}

function getSelectedTransactionPreviewLabel(transaction = {}) {
  const candidateLabels = [
    transaction.description,
    transaction.rawLabel,
    transaction.label,
    transaction.merchant,
    transaction.thirdPartyName,
  ];

  const firstUsableLabel = candidateLabels.find((value) => typeof value === "string" && value.trim().length > 0);

  return firstUsableLabel?.trim() || FALLBACK_TRANSACTION_LABEL;
}

function normalizeCategoryOptions(categories = [], type = "depense") {
  const expectedType = type === "revenu" ? "revenu" : "depense";
  const firestoreCategories = categories
    .filter((category) => category.type === expectedType && category.isActive !== false)
    .map((category) => ({ id: category.id, name: category.name }))
    .filter((category) => Boolean(category.name));

  if (firestoreCategories.length > 0) {
    return firestoreCategories;
  }

  return getCategoryOptions(type).map((name) => ({ id: "", name }));
}

function toSelectValue(value) {
  if (value === null) {
    return CLEAR_VALUE;
  }

  return value || "";
}

export default function TransactionBulkEditDialog({
  open,
  mode = "advanced",
  selectedTransactions = [],
  categories = [],
  subcategories = [],
  activities = [],
  thirdParties = [],
  projects = [],
  workProjects = [],
  accounts = [],
  onRequestCreateCategory,
  onRequestCreateSubcategory,
  onRequestCreateActivity,
  onRequestCreateThirdParty,
  onRequestCreateProject,
  onRequestCreateAccount,
  onClose,
  onApply,
  submitting = false,
}) {
  const [draft, setDraft] = useState({
    categoryId: "",
    subcategoryId: "",
    activityId: "",
    thirdPartyId: "",
    projectId: "",
    workProjectId: "",
    accountId: "",
    type: "",
    clearIncompatibleSubcategories: false,
  });
  const [localError, setLocalError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPatch, setPendingPatch] = useState(null);
  const [suggestionApplied, setSuggestionApplied] = useState(false);
  const isMobile = useMediaQuery("(max-width:600px)");
  const isClassificationMode = mode === "classification";

  useEffect(() => {
    if (!open) {
      return;
    }

    setDraft({
      categoryId: "",
      subcategoryId: "",
      activityId: "",
      thirdPartyId: "",
      projectId: "",
      workProjectId: "",
      accountId: "",
      type: "",
      clearIncompatibleSubcategories: false,
    });
    setLocalError("");
    setConfirmOpen(false);
    setPendingPatch(null);
    setSuggestionApplied(false);
  }, [open]);

  const selectedTransactionsCount = selectedTransactions.length;
  const selectedTransactionsLabel = toTransactionLabel(selectedTransactionsCount);
  const selectedTransactionPreview = useMemo(
    () => selectedTransactions.slice(0, SELECTED_TRANSACTIONS_PREVIEW_LIMIT).map((transaction) => getSelectedTransactionPreviewLabel(transaction)),
    [selectedTransactions]
  );
  const remainingSelectedTransactionsCount = Math.max(0, selectedTransactionsCount - selectedTransactionPreview.length);

  const draftCategoryOptions = useMemo(() => normalizeCategoryOptions(categories, draft.type || "depense"), [categories, draft.type]);
  const mockSuggestion = useMemo(
    () => (isClassificationMode ? getMockBulkClassificationSuggestion(categories) : null),
    [categories, isClassificationMode]
  );

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === draft.categoryId) || null,
    [categories, draft.categoryId]
  );

  const selectedCategoryLabel = useMemo(() => {
    if (draft.categoryId === UNCATEGORIZED_VALUE) {
      return "Sans catégorie";
    }

    return selectedCategory?.name || draft.categoryId || "";
  }, [draft.categoryId, selectedCategory?.name]);

  const classificationImpact = useMemo(() => {
    if (!isClassificationMode) {
      return null;
    }

    return buildClassificationImpactSummary({
      selectedTransactions,
      categories,
      selectedCategoryId: draft.categoryId,
      selectedCategoryLabel,
      uncategorizedValue: UNCATEGORIZED_VALUE,
    });
  }, [categories, draft.categoryId, isClassificationMode, selectedCategoryLabel, selectedTransactions]);

  const filteredSubcategories = useMemo(() => {
    if (!draft.categoryId) {
      return subcategories.filter((subcategory) => subcategory.isActive !== false);
    }

    return subcategories.filter((subcategory) => subcategory.isActive !== false && subcategory.categoryId === draft.categoryId);
  }, [draft.categoryId, subcategories]);

  const incompatibleSubcategoryCount = useMemo(() => {
    if (!draft.categoryId || draft.categoryId === UNCATEGORIZED_VALUE || draft.subcategoryId || !selectedTransactions.length) {
      return 0;
    }

    return selectedTransactions.filter((transaction) => {
      const currentSubcategory = subcategories.find((subcategory) => subcategory.id === transaction.subcategoryId);
      if (!currentSubcategory) {
        return false;
      }

      return currentSubcategory.categoryId && currentSubcategory.categoryId !== draft.categoryId;
    }).length;
  }, [draft.categoryId, draft.subcategoryId, selectedTransactions, subcategories]);

  const summary = useMemo(() => {
    const summaryPatch = {
      ...(draft.categoryId
        ? {
            categoryName: selectedCategory?.name || draft.categoryId,
            categoryId: draft.categoryId === UNCATEGORIZED_VALUE ? "" : draft.categoryId,
          }
        : {}),
      ...(draft.subcategoryId === CLEAR_VALUE
        ? { subcategoryId: null }
        : draft.subcategoryId
          ? { subcategoryId: draft.subcategoryId, subcategoryName: filteredSubcategories.find((subcategory) => subcategory.id === draft.subcategoryId)?.name || draft.subcategoryId }
          : {}),
      ...(draft.activityId === CLEAR_VALUE
        ? { activityId: null }
        : draft.activityId
          ? { activityId: draft.activityId, activityName: activities.find((activity) => activity.id === draft.activityId)?.name || draft.activityId }
          : {}),
      ...(draft.thirdPartyId === CLEAR_VALUE
        ? { thirdPartyId: null }
        : draft.thirdPartyId
          ? { thirdPartyId: draft.thirdPartyId, thirdPartyName: thirdParties.find((thirdParty) => thirdParty.id === draft.thirdPartyId)?.name || draft.thirdPartyId }
          : {}),
      ...(draft.projectId === CLEAR_VALUE
        ? { projectId: null }
        : draft.projectId
          ? { projectId: draft.projectId, projectName: projects.find((project) => project.id === draft.projectId)?.name || draft.projectId }
          : {}),
      ...(draft.workProjectId === CLEAR_VALUE ? { workProjectId: null } : draft.workProjectId ? { workProjectId: draft.workProjectId } : {}),
      ...(draft.workProjectId === CLEAR_VALUE ? { workProjectId: null } : draft.workProjectId ? { workProjectId: draft.workProjectId } : {}),
      ...(draft.accountId ? { accountId: draft.accountId, accountName: accounts.find((account) => account.id === draft.accountId)?.name || draft.accountId } : {}),
      ...(draft.type ? { type: draft.type } : {}),
    };

    return summarizeBulkTransactionPatch(summaryPatch, selectedTransactionsCount);
  }, [accounts, activities, draft, filteredSubcategories, projects, selectedCategory?.name, selectedTransactionsCount, thirdParties]);

  const applyDisabled = selectedTransactionsCount === 0 || Boolean(localError) || (incompatibleSubcategoryCount > 0 && !draft.clearIncompatibleSubcategories);

  function handleChange(event) {
    const { name, value } = event.target;

    if (name === "categoryId" && value === CREATE_CATEGORY_VALUE) {
      onClose?.();
      onRequestCreateCategory?.(draft.type || "depense");
      return;
    }

    if (name === "subcategoryId" && value === CREATE_SUBCATEGORY_VALUE) {
      onClose?.();
      onRequestCreateSubcategory?.(draft.categoryId || "", draft.type || "depense");
      return;
    }

    if (name === "activityId" && value === CREATE_ACTIVITY_VALUE) {
      onClose?.();
      onRequestCreateActivity?.();
      return;
    }

    if (name === "thirdPartyId" && value === CREATE_THIRD_PARTY_VALUE) {
      onClose?.();
      onRequestCreateThirdParty?.();
      return;
    }

    if (name === "projectId" && value === CREATE_PROJECT_VALUE) {
      onClose?.();
      onRequestCreateProject?.(draft.activityId || "");
      return;
    }

    if (name === "accountId" && value === CREATE_ACCOUNT_VALUE) {
      onClose?.();
      onRequestCreateAccount?.();
      return;
    }

    setDraft((previous) => ({
      ...previous,
      [name]: value,
    }));
    if (name === "categoryId") {
      setSuggestionApplied(false);
    }
    setLocalError("");
  }

  function handleAcceptMockSuggestion() {
    if (!mockSuggestion?.categoryId) {
      return;
    }

    setDraft((previous) => ({
      ...previous,
      categoryId: mockSuggestion.categoryId,
    }));
    setSuggestionApplied(true);
    setLocalError("");
  }

  function handleChooseAnotherCategory() {
    setSuggestionApplied(false);
    setLocalError("");
  }

  function buildDraftPatch() {
    const canonicalCategoryName = selectedCategory?.name || "";
    const targetsUncategorized = draft.categoryId === UNCATEGORIZED_VALUE;
    return buildBulkTransactionPatch({
      ...(draft.categoryId ? {
        categoryId: targetsUncategorized ? "" : draft.categoryId,
        categoryName: targetsUncategorized ? "" : canonicalCategoryName,
        categorie: targetsUncategorized ? "" : canonicalCategoryName,
        ...(targetsUncategorized ? { subcategoryId: null, subcategoryName: null } : {}),
      } : {}),
      ...(draft.subcategoryId === CLEAR_VALUE
        ? { subcategoryId: null }
        : draft.subcategoryId
          ? { subcategoryId: draft.subcategoryId }
          : {}),
      ...(draft.activityId === CLEAR_VALUE
        ? { activityId: null }
        : draft.activityId
          ? { activityId: draft.activityId }
          : {}),
      ...(draft.thirdPartyId === CLEAR_VALUE
        ? { thirdPartyId: null }
        : draft.thirdPartyId
          ? { thirdPartyId: draft.thirdPartyId }
          : {}),
      ...(draft.projectId === CLEAR_VALUE
        ? { projectId: null }
        : draft.projectId
          ? { projectId: draft.projectId }
          : {}),
      ...(draft.workProjectId === CLEAR_VALUE ? { workProjectId: null } : draft.workProjectId ? { workProjectId: draft.workProjectId } : {}),
      ...(draft.workProjectId === CLEAR_VALUE ? { workProjectId: null } : draft.workProjectId ? { workProjectId: draft.workProjectId } : {}),
      ...(draft.accountId ? { accountId: draft.accountId } : {}),
      ...(draft.type ? { type: draft.type } : {}),
    });
  }

  function validateAgainstSelection(patch) {
    const clearsCategory = draft.categoryId === UNCATEGORIZED_VALUE;
    for (const transaction of selectedTransactions) {
      const result = resolveBulkTransactionPatchForTransaction(transaction, patch, {
        categoryMap: new Map(categories.map((category) => [category.id, category])),
        subcategoryMap: new Map(subcategories.map((subcategory) => [subcategory.id, subcategory])),
        activityMap: new Map(activities.map((activity) => [activity.id, activity])),
        thirdPartyMap: new Map(thirdParties.map((thirdParty) => [thirdParty.id, thirdParty])),
        projectMap: new Map(projects.map((project) => [project.id, project])),
        workProjectMap: new Map(workProjects.map((project) => [project.id, project])),
        accountMap: new Map(accounts.map((account) => [account.id, account])),
      }, {
        clearIncompatibleSubcategories: clearsCategory || draft.clearIncompatibleSubcategories,
      });

      if (!result.ok) {
        return result.error;
      }
    }

    return "";
  }

  function handleRequestApply() {
    const patch = buildDraftPatch();
    if (Object.keys(patch).length === 0) {
      setLocalError("Selectionne au moins un champ a modifier.");
      return;
    }

    if (isClassificationMode && classificationImpact?.hasSelectedCategory && classificationImpact.willChangeCount === 0) {
      setLocalError("Aucune modification nécessaire : toutes les transactions sélectionnées ont déjà cette catégorie.");
      return;
    }

    const validationMessage = validateAgainstSelection(patch);
    if (validationMessage) {
      setLocalError(validationMessage);
      return;
    }

    setPendingPatch(patch);
    setConfirmOpen(true);
  }

  async function handleConfirmApply() {
    if (!pendingPatch || submitting) {
      return;
    }

    const outcome = await onApply?.(pendingPatch, {
      clearIncompatibleSubcategories: draft.categoryId === UNCATEGORIZED_VALUE || draft.clearIncompatibleSubcategories,
      mode,
      categoryName: selectedCategoryLabel,
    });
    if (outcome?.success) {
      setConfirmOpen(false);
      return;
    }
    setLocalError(outcome?.error || "La catégorisation n’a pas pu être appliquée.");
    setConfirmOpen(false);
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="sm"
        fullScreen={isMobile}
        PaperProps={{
          sx: {
            display: "flex",
            flexDirection: "column",
            height: { xs: "100%", sm: "min(92vh, 820px)" },
            maxHeight: { xs: "100%", sm: "92vh" },
            m: { xs: 0, sm: 2 },
          },
        }}
      >
        <DialogTitle>{isClassificationMode ? "Classement de masse" : "Actions de masse"}</DialogTitle>
        <DialogContent sx={{ pt: 1.5, overflowX: "hidden", overflowY: "auto", flex: 1, minHeight: 0 }}>
          <Stack spacing={1.25}>
            <Alert severity="info">
              Vous allez classer {selectedTransactionsLabel}.
            </Alert>

            {isClassificationMode && selectedTransactionPreview.length > 0 && (
              <Stack
                spacing={0.75}
                sx={{
                  px: { xs: 1, sm: 1.25 },
                  py: 1,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  backgroundColor: "background.default",
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Transactions sélectionnées
                </Typography>
                <Stack component="ul" spacing={0.5} sx={{ m: 0, pl: { xs: 2.5, sm: 3 } }}>
                  {selectedTransactionPreview.map((transactionLabel, index) => (
                    <Typography key={`${index}-${transactionLabel}`} component="li" variant="body2" sx={{ wordBreak: "break-word" }}>
                      {transactionLabel}
                    </Typography>
                  ))}
                </Stack>
                {remainingSelectedTransactionsCount > 0 && (
                  <Typography variant="caption" color="text.secondary">
                    +{remainingSelectedTransactionsCount} autres
                  </Typography>
                )}
              </Stack>
            )}

            {localError && <Alert severity="error">{localError}</Alert>}

            <Typography variant="body2" color="text.secondary">
              Laisser un champ vide conserve la valeur actuelle. Les champs optionnels peuvent aussi être effacés.
            </Typography>

            {isClassificationMode && (
              <BulkClassificationSuggestionPanel
                suggestion={mockSuggestion}
                onAcceptSuggestion={handleAcceptMockSuggestion}
                onChooseAnotherCategory={handleChooseAnotherCategory}
                acceptDisabled={!mockSuggestion?.categoryId}
                applied={suggestionApplied}
              />
            )}

            <TextField label="Categorie" name="categoryId" select value={toSelectValue(draft.categoryId)} onChange={handleChange} fullWidth size="small">
              {isClassificationMode && <MenuItem value={UNCATEGORIZED_VALUE}>Sans catégorie</MenuItem>}
              {!isClassificationMode && <MenuItem value="">Sélectionner une catégorie</MenuItem>}
              {draftCategoryOptions.map((category) => (
                <MenuItem key={category.id || category.name} value={category.id || category.name}>
                  {getSafeCategoryLabel(category.name)}
                </MenuItem>
              ))}
              <Divider />
              <MenuItem value={CREATE_CATEGORY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
                + Créer une nouvelle catégorie
              </MenuItem>
            </TextField>

            <TextField label="Sous-catégorie" name="subcategoryId" select value={toSelectValue(draft.subcategoryId)} onChange={handleChange} fullWidth size="small">
              <MenuItem value="">Conserver</MenuItem>
              <MenuItem value={CLEAR_VALUE}>Effacer</MenuItem>
              {filteredSubcategories.map((subcategory) => (
                <MenuItem key={subcategory.id} value={subcategory.id}>
                  {subcategory.name}
                </MenuItem>
              ))}
              <Divider />
              <MenuItem value={CREATE_SUBCATEGORY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }} disabled={!draft.categoryId}>
                + Créer une nouvelle sous-catégorie
              </MenuItem>
            </TextField>

            <TextField label="Activité" name="activityId" select value={toSelectValue(draft.activityId)} onChange={handleChange} fullWidth size="small">
              <MenuItem value="">Conserver</MenuItem>
              <MenuItem value={CLEAR_VALUE}>Effacer</MenuItem>
              {activities.filter((activity) => activity.isActive !== false).map((activity) => (
                <MenuItem key={activity.id} value={activity.id}>{activity.name}</MenuItem>
              ))}
              <Divider />
              <MenuItem value={CREATE_ACTIVITY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
                + Créer une nouvelle activité
              </MenuItem>
            </TextField>

            <TextField label="Tiers" name="thirdPartyId" select value={toSelectValue(draft.thirdPartyId)} onChange={handleChange} fullWidth size="small">
              <MenuItem value="">Conserver</MenuItem>
              <MenuItem value={CLEAR_VALUE}>Effacer</MenuItem>
              {thirdParties.filter((thirdParty) => thirdParty.isActive !== false).map((thirdParty) => (
                <MenuItem key={thirdParty.id} value={thirdParty.id}>{thirdParty.name}</MenuItem>
              ))}
              <Divider />
              <MenuItem value={CREATE_THIRD_PARTY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
                + Créer un nouveau tiers
              </MenuItem>
            </TextField>

            <TextField label="Projet" name="projectId" select value={toSelectValue(draft.projectId)} onChange={handleChange} fullWidth size="small">
              <MenuItem value="">Conserver</MenuItem>
              <MenuItem value={CLEAR_VALUE}>Effacer</MenuItem>
              {projects.filter((project) => project.isActive !== false).map((project) => (
                <MenuItem key={project.id} value={project.id}>{project.name}</MenuItem>
              ))}
              <Divider />
              <MenuItem value={CREATE_PROJECT_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
                + Créer un nouveau projet
              </MenuItem>
            </TextField>


            <TextField label="Dossier" name="workProjectId" select value={toSelectValue(draft.workProjectId)} onChange={handleChange} fullWidth size="small">
              <MenuItem value="">Conserver</MenuItem>
              <MenuItem value={CLEAR_VALUE}>Effacer</MenuItem>
              {workProjects.map((project) => <MenuItem key={project.id} value={project.id}>{project.name}</MenuItem>)}
            </TextField>            <TextField label="Compte" name="accountId" select value={toSelectValue(draft.accountId)} onChange={handleChange} fullWidth size="small">
              <MenuItem value="">Conserver</MenuItem>
              {accounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>{account.name}</MenuItem>
              ))}
              <Divider />
              <MenuItem value={CREATE_ACCOUNT_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
                + Créer un nouveau compte
              </MenuItem>
            </TextField>

            <TextField label="Type" name="type" select value={toSelectValue(draft.type)} onChange={handleChange} fullWidth size="small">
              <MenuItem value="">Conserver</MenuItem>
              <MenuItem value="depense">Dépense</MenuItem>
              <MenuItem value="revenu">Revenu</MenuItem>
            </TextField>

            {incompatibleSubcategoryCount > 0 && draft.categoryId && !draft.subcategoryId && (
              <Alert severity="warning">
                {incompatibleSubcategoryCount} transaction(s) ont une sous-catégorie incompatible avec la nouvelle catégorie.
                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={draft.clearIncompatibleSubcategories}
                      onChange={(event) => setDraft((previous) => ({ ...previous, clearIncompatibleSubcategories: event.target.checked }))}
                    />
                  )}
                  label="Effacer automatiquement les sous-catégories incompatibles"
                />
              </Alert>
            )}

            {isClassificationMode && classificationImpact && (
              <Stack
                spacing={0.75}
                sx={{
                  px: { xs: 1, sm: 1.25 },
                  py: 1,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  backgroundColor: "background.default",
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Impact du classement
                </Typography>

                <Typography variant="body2">
                  {classificationImpact.selectedCount} transactions sélectionnées
                </Typography>

                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Catégories actuelles
                </Typography>

                <Stack component="ul" spacing={0.4} sx={{ m: 0, pl: { xs: 2.5, sm: 3 } }}>
                  {classificationImpact.categoryDistribution.map((item) => (
                    <Typography key={item.label} component="li" variant="body2" sx={{ wordBreak: "break-word" }}>
                      {item.label} : {item.count}
                    </Typography>
                  ))}
                </Stack>

                <Divider />

                {classificationImpact.hasSelectedCategory ? (
                  <Stack spacing={0.4}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Nouvelle catégorie
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      ✓ {selectedCategoryLabel}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {classificationImpact.willChangeCount} transactions seront réellement modifiées
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {classificationImpact.alreadyInTargetCount} des transactions sélectionnées ont déjà cette catégorie
                    </Typography>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Sélectionnez une catégorie pour afficher l'impact.
                  </Typography>
                )}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions
          sx={{
            px: { xs: 2, sm: 3 },
            pb: { xs: "calc(env(safe-area-inset-bottom, 0px) + 12px)", sm: 2 },
            pt: 1,
            borderTop: "1px solid",
            borderColor: "divider",
            backgroundColor: "background.paper",
            flexShrink: 0,
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" },
          }}
        >
          <Button onClick={onClose} fullWidth disabled={submitting}>
            Annuler
          </Button>
          <Button variant="contained" onClick={handleRequestApply} fullWidth disabled={applyDisabled || submitting}>
            {isClassificationMode ? `Classer ${selectedTransactionsLabel}` : "Appliquer"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isClassificationMode ? "Confirmer le classement de masse" : "Confirmer les modifications"}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1.25 }}>
            {`Appliquer ces modifications à ${selectedTransactionsCount} transaction(s) ?`}
          </Typography>
          <>
            <Typography sx={{ mb: 1.25 }}>{summary.title}</Typography>
            <Stack spacing={0.5}>
              {summary.lines.map((line) => (
                <Typography key={line} variant="body2">
                  {line}
                </Typography>
              ))}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
              Les autres champs resteront inchangés.
            </Typography>
          </>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={submitting}>Annuler</Button>
          <Button variant="contained" onClick={handleConfirmApply} disabled={submitting}>
            {submitting ? "Enregistrement..." : isClassificationMode ? "Confirmer le classement" : "Appliquer"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
