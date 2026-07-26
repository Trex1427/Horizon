import { useMemo, useRef, useState } from "react";
import { Alert, Box, Divider, MenuItem, Stack, TextField } from "@mui/material";
import EntityDialog from "./EntityDialog.jsx";
import AccountSelector from "./AccountSelector.jsx";
import { validateDebtReceivable } from "../services/debtsReceivablesModel.js";
import { CREATE_THIRD_PARTY_VALUE } from "../constants/transactionReferenceCreateValues.js";
import { THIRD_PARTY_TYPE_OPTIONS } from "../constants/referenceCatalog.js";

const today = new Date().toISOString().slice(0, 10);
const emptyForm = { type: "debt", label: "", amount: "", thirdPartyId: "", categoryId: "", initialCategoryId: "", initialAccountId: "", initialDate: today, dueDate: "", notes: "" };

export default function DebtReceivableForm({
  open,
  initialItem,
  thirdParties = [],
  categories = [],
  accounts = [],
  defaultAccount = null,
  onRequestCreateThirdParty,
  onClose,
  onSubmit,
}) {
  const [form, setForm] = useState(() => initialItem ? {
    type: initialItem.type || "debt", label: initialItem.label || "", amount: String(initialItem.amount ?? ""),
    thirdPartyId: initialItem.thirdPartyId || "", categoryId: initialItem.categoryId || "",
    initialCategoryId: initialItem.initialCategoryId || "", initialAccountId: initialItem.initialAccountId || defaultAccount?.id || "", initialDate: initialItem.initialDate || today, dueDate: initialItem.dueDate || "", notes: initialItem.notes || "",
  } : emptyForm);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [quickThirdPartyOpen, setQuickThirdPartyOpen] = useState(false);
  const [quickThirdPartyForm, setQuickThirdPartyForm] = useState({ name: "", type: "supplier", notes: "" });
  const [quickThirdPartyError, setQuickThirdPartyError] = useState("");
  const quickThirdPartySubmittingRef = useRef(false);

  const activeThirdParties = useMemo(
    () => (thirdParties || []).filter((thirdParty) => thirdParty?.isActive !== false),
    [thirdParties],
  );

  const compatibleCategories = useMemo(() => {
    const expectedType = form.type === "receivable" ? "revenu" : "depense";
    return (categories || []).filter((category) => category?.isActive !== false && (!category.type || category.type === expectedType));
  }, [categories, form.type]);
  const initialExpenseCategories = useMemo(
    () => (categories || []).filter((category) => category?.isActive !== false && (!category.type || category.type === "depense")),
    [categories],
  );
  const formThirdPartyOptions = useMemo(() => {
    if (!form.thirdPartyId || activeThirdParties.some((thirdParty) => thirdParty.id === form.thirdPartyId)) {
      return activeThirdParties;
    }

    const known = (thirdParties || []).find((thirdParty) => thirdParty.id === form.thirdPartyId);
    return [
      {
        id: form.thirdPartyId,
        name: known?.name || "Tiers introuvable",
        isActive: known?.isActive,
      },
      ...activeThirdParties,
    ];
  }, [activeThirdParties, form.thirdPartyId, thirdParties]);

  const legacyCounterparty = initialItem && !initialItem.thirdPartyId
    ? String(initialItem.counterparty || "").trim()
    : "";

  function change(event) {
    const { name, value } = event.target;

    if (name === "thirdPartyId" && value === CREATE_THIRD_PARTY_VALUE) {
      setQuickThirdPartyForm({ name: "", type: "supplier", notes: "" });
      setQuickThirdPartyError("");
      setQuickThirdPartyOpen(true);
      return;
    }

    setForm((current) => ({ ...current, [name]: value, ...(name === "type" ? { categoryId: "", initialCategoryId: "", initialAccountId: value === "receivable" ? (defaultAccount?.id || "") : "" } : {}) }));
    setErrors((current) => ({ ...current, [name]: null }));
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
      setQuickThirdPartyError("La creation rapide de tiers n'est pas disponible.");
      return;
    }

    quickThirdPartySubmittingRef.current = true;
    const result = await onRequestCreateThirdParty({
      name: trimmedName,
      type: quickThirdPartyForm.type,
      notes: quickThirdPartyForm.notes,
      isActive: true,
    });
    quickThirdPartySubmittingRef.current = false;

    if (!result?.success) {
      setQuickThirdPartyError(result?.error || "Erreur lors de la creation du tiers.");
      return;
    }

    setForm((previous) => ({
      ...previous,
      thirdPartyId: result.id || previous.thirdPartyId,
    }));
    setErrors((current) => ({ ...current, thirdPartyId: null }));
    setQuickThirdPartyOpen(false);
    setQuickThirdPartyForm({ name: "", type: "supplier", notes: "" });
    setQuickThirdPartyError("");
  }

  async function submit() {
    if (submittingRef.current) return;
    const nextErrors = validateDebtReceivable(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError("");
    const result = await onSubmit(form);
    if (result.success) onClose();
    else setSubmitError(result.error || "Impossible d’enregistrer cet élément.");
    submittingRef.current = false;
    setSubmitting(false);
  }

  return (
    <EntityDialog open={open} title={initialItem ? "Modifier l’élément" : "Ajouter une dette ou créance"} onClose={onClose}
      onSubmit={submit} submitting={submitting} errorMessage={submitError} maxWidth="sm">
      <Stack spacing={2} sx={{ mt: 1 }}>
        {legacyCounterparty ? (
          <Alert severity="warning">
            Ancienne contrepartie détectée: {legacyCounterparty}. Veuillez sélectionner un Tiers pour enregistrer cet élément.
          </Alert>
        ) : null}
        <TextField select label="Type" name="type" value={form.type} onChange={change} error={Boolean(errors.type)} helperText={errors.type}>
          <MenuItem value="debt">Dette</MenuItem><MenuItem value="receivable">Créance</MenuItem>
        </TextField>
        <TextField label="Libellé" name="label" value={form.label} onChange={change} error={Boolean(errors.label)} helperText={errors.label} />
        <TextField label="Montant (€)" name="amount" type="number" inputProps={{ min: "0.01", step: "0.01" }} value={form.amount} onChange={change} error={Boolean(errors.amount)} helperText={errors.amount} />
        <TextField label="Tiers" name="thirdPartyId" select value={form.thirdPartyId || ""} onChange={change} error={Boolean(errors.thirdPartyId)} helperText={errors.thirdPartyId || "Le tiers est obligatoire."}>
          <MenuItem value="">Sélectionner</MenuItem>
          {formThirdPartyOptions.map((thirdParty) => (
            <MenuItem key={thirdParty.id} value={thirdParty.id}>
              {thirdParty.name}{thirdParty.isActive === false ? " (Archive)" : ""}
            </MenuItem>
          ))}
          <Divider />
          <MenuItem value={CREATE_THIRD_PARTY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
            + Créer un nouveau tiers
          </MenuItem>
        </TextField>
        <TextField label={form.type === "receivable" ? "Catégorie des remboursements" : "Catégorie des paiements"} name="categoryId" select value={form.categoryId || ""} onChange={change} error={Boolean(errors.categoryId)} helperText={errors.categoryId || "La catégorie est obligatoire."}>
          <MenuItem value="">Sélectionner</MenuItem>
          {compatibleCategories.map((category) => <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>)}
        </TextField>
        {form.type === "receivable" ? (
          <>
            <TextField label="Catégorie de la sortie initiale" name="initialCategoryId" select value={form.initialCategoryId || ""} onChange={change} error={Boolean(errors.initialCategoryId)} helperText={errors.initialCategoryId}>
              <MenuItem value="">Sélectionner</MenuItem>
              {initialExpenseCategories.map((category) => <MenuItem key={category.id} value={category.id}>{category.name}</MenuItem>)}
            </TextField>
            <AccountSelector value={form.initialAccountId || defaultAccount?.id || ""} accounts={accounts} onChange={(event) => change({ target: { name: "initialAccountId", value: event.target.value } })} />
            {errors.initialAccountId ? <Alert severity="error">{errors.initialAccountId}</Alert> : null}
            <TextField label="Date de la sortie initiale" name="initialDate" type="date" InputLabelProps={{ shrink: true }} value={form.initialDate || ""} onChange={change} error={Boolean(errors.initialDate)} helperText={errors.initialDate} />
          </>
        ) : null}        <TextField label="Date d’échéance (facultative)" name="dueDate" type="date" InputLabelProps={{ shrink: true }} value={form.dueDate} onChange={change} error={Boolean(errors.dueDate)} helperText={errors.dueDate} />
        <TextField label="Notes (facultatives)" name="notes" multiline minRows={3} value={form.notes} onChange={change} />
      </Stack>

      <EntityDialog
        open={quickThirdPartyOpen}
        title="Creation rapide d'un tiers"
        onClose={() => {
          setQuickThirdPartyOpen(false);
          setQuickThirdPartyError("");
        }}
        onSubmit={handleQuickThirdPartyCreate}
        formId="quick-third-party-form-debts"
        errorMessage={quickThirdPartyError}
        submitLabel="Creer"
        maxWidth="sm"
        isDirty={Boolean(quickThirdPartyForm.name || quickThirdPartyForm.notes || quickThirdPartyForm.type !== "supplier")}
        autoFocusSelector='input[name="quick-third-party-name"]'
      >
        <form
          id="quick-third-party-form-debts"
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
    </EntityDialog>
  );
}
