import EntityDialog from "./EntityDialog";

export default function EntityFormDialog({
  open,
  title,
  children,
  onClose,
  onSubmit,
  submitting = false,
  fullScreenMobile = true,
  submitLabel = "Enregistrer",
  cancelLabel = "Annuler",
  deleteAction = null,
  maxWidth = "md",
  errorMessage = "",
}) {
  return (
    <EntityDialog
      open={open}
      title={title}
      onClose={onClose}
      onSubmit={onSubmit}
      submitting={submitting}
      fullScreenMobile={fullScreenMobile}
      submitLabel={submitLabel}
      cancelLabel={cancelLabel}
      maxWidth={maxWidth}
      errorMessage={errorMessage}
      footerStartContent={deleteAction}
    >
      {children}
    </EntityDialog>
  );
}
