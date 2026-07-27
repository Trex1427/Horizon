import { Box, Divider, FormControlLabel, MenuItem, Switch, TextField } from "@mui/material";
import AccountSelector from "./AccountSelector";
import { getSafeCategoryLabel } from "../utils/displayTextUtils";
import {
  CREATE_ACCOUNT_VALUE,
  CREATE_ACTIVITY_VALUE,
  CREATE_CATEGORY_VALUE,
  CREATE_PROJECT_VALUE,
  CREATE_SUBCATEGORY_VALUE,
  CREATE_THIRD_PARTY_VALUE,
} from "../constants/transactionReferenceCreateValues";
import { CREATE_FIXED_EXPENSE_VALUE } from "../constants/transactionFixedExpenseReference";
import { findCompatibleFixedExpenses } from "../utils/fixedExpenseIdentity";

export default function TransactionFormFields({
  form,
  onChange,
  accounts = [],
  categoryOptions = [],
  subcategoryOptions = [],
  activities = [],
  thirdParties = [],
  projects = [],
  prioritizedProjectOptions = [],
  subcategoryHelperText = "Facultatif",
  fixedExpenses = [],
}) {
  const compatibleFixedExpenseIds = new Set(findCompatibleFixedExpenses({
    name: form.description,
    frequency: "monthly",
    accountId: form.accountId,
    categoryId: form.categoryId,
    subcategoryId: form.subcategoryId,
    thirdPartyId: form.thirdPartyId,
    activityId: form.activityId,
    projectId: form.projectId,
  }, fixedExpenses).map((fixedExpense) => fixedExpense.id));
  const orderedFixedExpenses = [...fixedExpenses].sort((left, right) => (
    Number(compatibleFixedExpenseIds.has(right.id)) - Number(compatibleFixedExpenseIds.has(left.id))
  ));

  return (
    <Box sx={{ display: "grid", gap: 1.25, gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" } }}>
      <TextField
        label="Date"
        name="date"
        type="date"
        value={form.date}
        onChange={onChange}
        fullWidth
        size="small"
        InputLabelProps={{ shrink: true }}
      />

      <TextField
        label="Type"
        name="type"
        select
        value={form.type}
        onChange={onChange}
        fullWidth
        size="small"
      >
        <MenuItem value="depense">Dépense</MenuItem>
        <MenuItem value="revenu">Revenu</MenuItem>
      </TextField>

      {form.type === "depense" && (
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <FormControlLabel
            control={(
              <Switch
                name="isFixedExpense"
                checked={Boolean(form.isFixedExpense)}
                onChange={onChange}
                color="primary"
              />
            )}
            label="Frais fixe"
          />
        </Box>
      )}

      {form.type === "depense" && Boolean(form.isFixedExpense) && (
        <TextField
          label="Frais fixe associe"
          name="fixedExpenseId"
          select
          value={form.fixedExpenseId || ""}
          onChange={onChange}
          fullWidth
          size="small"
          sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
          helperText="Choisir un frais fixe existant ou en créer un"
        >
          <MenuItem value="">Sélectionner</MenuItem>
          {orderedFixedExpenses.map((fixedExpense) => (
            <MenuItem key={fixedExpense.id} value={fixedExpense.id}>
              {compatibleFixedExpenseIds.has(fixedExpense.id) ? "Suggestion — " : ""}
              {(fixedExpense.name || "Frais fixe")} - {Number(fixedExpense.initialAmount || 0).toFixed(2)} €
            </MenuItem>
          ))}
          <Divider />
          <MenuItem value={CREATE_FIXED_EXPENSE_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
            + Créer un nouveau frais fixe
          </MenuItem>
        </TextField>
      )}

      <TextField
        label="Montant"
        name="montant"
        type="number"
        value={form.montant}
        onChange={onChange}
        fullWidth
        size="small"
        sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
      />

      <TextField
        label="Catégorie"
        name="categorie"
        select
        value={form.categoryId || form.categorie}
        onChange={onChange}
        fullWidth
        size="small"
      >
        <MenuItem value="">Sans catégorie</MenuItem>
        {categoryOptions.map((category) => (
          <MenuItem key={`${category.id || "legacy"}-${category.name}`} value={category.id || category.name}>
            {getSafeCategoryLabel(category.name)}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem value={CREATE_CATEGORY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
          + Créer une nouvelle catégorie
        </MenuItem>
      </TextField>

      <TextField
        label="Sous-catégorie"
        name="subcategoryId"
        select
        value={form.subcategoryId || ""}
        onChange={onChange}
        fullWidth
        size="small"
        disabled={Boolean(form.categoryId) === false}
        helperText={!form.categoryId ? "Choisir une catégorie d'abord" : subcategoryHelperText}
      >
        <MenuItem value="">Aucune</MenuItem>
        {subcategoryOptions.map((subcategory) => (
          <MenuItem key={subcategory.id} value={subcategory.id}>
            {subcategory.name}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem value={CREATE_SUBCATEGORY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
          + Créer une nouvelle sous-catégorie
        </MenuItem>
      </TextField>

      <TextField
        label="Activité"
        name="activityId"
        select
        value={form.activityId || ""}
        onChange={onChange}
        fullWidth
        size="small"
      >
        <MenuItem value="">Aucune</MenuItem>
        {activities.map((activity) => (
          <MenuItem key={activity.id} value={activity.id}>
            {activity.name}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem value={CREATE_ACTIVITY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
          + Créer une nouvelle activité
        </MenuItem>
      </TextField>

      <TextField
        label="Tiers"
        name="thirdPartyId"
        select
        value={form.thirdPartyId || ""}
        onChange={onChange}
        fullWidth
        size="small"
      >
        <MenuItem value="">Aucun</MenuItem>
        {thirdParties.map((thirdParty) => (
          <MenuItem key={thirdParty.id} value={thirdParty.id}>
            {thirdParty.name}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem value={CREATE_THIRD_PARTY_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
          + Créer un nouveau tiers
        </MenuItem>
      </TextField>

      <TextField
        label="Projet"
        name="projectId"
        select
        value={form.projectId || ""}
        onChange={onChange}
        fullWidth
        size="small"
        helperText={form.activityId ? "Projets lies a l'activite en tete de liste" : "Facultatif"}
      >
        <MenuItem value="">Aucun</MenuItem>
        {prioritizedProjectOptions.map((project) => (
          <MenuItem key={project.id} value={project.id}>
            {project.name}
          </MenuItem>
        ))}
        <Divider />
        <MenuItem value={CREATE_PROJECT_VALUE} sx={{ color: "primary.main", fontWeight: 600 }}>
          + Créer un nouveau projet
        </MenuItem>
      </TextField>

      <AccountSelector
        value={form.accountId}
        onChange={onChange}
        accounts={accounts}
        label="Compte source"
        size="small"
        sx={{ mb: 0 }}
        createOptionValue={CREATE_ACCOUNT_VALUE}
        createOptionLabel="+ Créer un nouveau compte"
      />

      <TextField
        label="Description"
        name="description"
        value={form.description}
        onChange={onChange}
        fullWidth
        size="small"
        sx={{ gridColumn: { xs: "auto", sm: "1 / -1" } }}
      />
    </Box>
  );
}
