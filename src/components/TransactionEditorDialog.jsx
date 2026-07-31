import { useMemo } from "react";
import { Alert, Button } from "@mui/material";
import TransactionFormFields from "./TransactionFormFields";
import EntityDialog from "./EntityDialog";
import { getTransactionEditorFocusSelector } from "../constants/transactionEditorFocusTargets";

export default function TransactionEditorDialog({
  open,
  title,
  form,
  initialForm,
  onChange,
  onSubmit,
  onClose,
  submitLabel,
  cancelLabel = "Annuler",
  submitting = false,
  errorMessage = "",
  accounts = [],
  categoryOptions = [],
  subcategoryOptions = [],
  activities = [],
  thirdParties = [],
  projects = [],
  prioritizedProjectOptions = [],
  workProjects = [],
  vehicles = [],
  fixedExpenses = [],
  helperText,
  scrollRestorePosition = null,
  initialFocusTarget = "",
  classificationSuggestion = null,
  onIgnoreClassificationSuggestion = null,
}) {
  const formId = "transaction-editor-form";
  const autoFocusSelector = getTransactionEditorFocusSelector(initialFocusTarget);
  const isDirty = useMemo(
    () => JSON.stringify(form || {}) !== JSON.stringify(initialForm || {}),
    [form, initialForm]
  );

  return (
    <EntityDialog
      open={open}
      title={title}
      onClose={onClose}
      onSubmit={onSubmit}
      formId={formId}
      errorMessage={errorMessage}
      submitting={submitting}
      isDirty={isDirty}
      autoFocusSelector={autoFocusSelector}
      submitLabel={submitLabel}
      cancelLabel={cancelLabel}
      maxWidth="md"
      scrollRestorePosition={scrollRestorePosition}
    >
      {classificationSuggestion ? (
        <Alert
          severity={classificationSuggestion.score >= 95 ? "success" : "info"}
          action={(
            <Button color="inherit" size="small" onClick={onIgnoreClassificationSuggestion}>
              Ignorer
            </Button>
          )}
          sx={{ mb: 1.25 }}
        >
          {classificationSuggestion.label} ({classificationSuggestion.score}%)
        </Alert>
      ) : null}
      <form id={formId} onSubmit={onSubmit}>
        <TransactionFormFields
          form={form}
          onChange={onChange}
          accounts={accounts}
          categoryOptions={categoryOptions}
          subcategoryOptions={subcategoryOptions}
          activities={activities}
          thirdParties={thirdParties}
          projects={projects}
          prioritizedProjectOptions={prioritizedProjectOptions}
          workProjects={workProjects}
          vehicles={vehicles}
          fixedExpenses={fixedExpenses}
          subcategoryHelperText={helperText}
        />
      </form>
    </EntityDialog>
  );
}
