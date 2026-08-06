import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";

export function DialogActionBar({ children, sticky = false, sx = {} }) {
  return (
    <DialogActions
      sx={{
        px: { xs: 2, sm: 3 },
        pb: 2,
        pt: 1.25,
        ...(sticky ? {
          borderTop: "1px solid",
          borderColor: "divider",
          position: "sticky",
          bottom: 0,
          bgcolor: "background.paper",
        } : {}),
        ...sx,
      }}
    >
      {children}
    </DialogActions>
  );
}

export function AppDialogFooter(props) {
  return <DialogActionBar {...props} />;
}

export function AppFilterDialog({
  open,
  onClose,
  title = "Filtres",
  children,
  fullWidth = true,
  fullScreen = false,
  maxWidth = "xs",
  scroll = "paper",
  ariaLabelledby,
  onCancel,
  onReset,
  onApply,
  cancelLabel = "Annuler",
  resetLabel = "Reinitialiser",
  applyLabel = "Appliquer",
  footerSx = {},
}) {
  const titleId = ariaLabelledby || undefined;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth={fullWidth}
      fullScreen={fullScreen}
      maxWidth={maxWidth}
      scroll={scroll}
      aria-labelledby={titleId}
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        {children}
      </DialogContent>
      <DialogActionBar sticky sx={footerSx}>
        {typeof onCancel === "function" ? <Button onClick={onCancel}>{cancelLabel}</Button> : null}
        {typeof onReset === "function" ? <Button onClick={onReset} variant="outlined">{resetLabel}</Button> : null}
        {typeof onApply === "function" ? <Button onClick={onApply} variant="contained">{applyLabel}</Button> : null}
      </DialogActionBar>
    </Dialog>
  );
}

export function AppSortDialog({
  open,
  onClose,
  title = "Tri",
  children,
  fullWidth = true,
  maxWidth = "xs",
  onCloseAction,
  onReset,
  onApply,
  closeLabel = "Fermer",
  resetLabel = "Reinitialiser",
  applyLabel = "Appliquer",
  footerSx = { px: 3, pt: 0 },
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth={fullWidth} maxWidth={maxWidth}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {children}
      </DialogContent>
      <DialogActionBar sx={footerSx}>
        {typeof onCloseAction === "function" ? <Button onClick={onCloseAction}>{closeLabel}</Button> : null}
        {typeof onReset === "function" ? <Button onClick={onReset} variant="outlined">{resetLabel}</Button> : null}
        {typeof onApply === "function" ? <Button onClick={onApply} variant="contained">{applyLabel}</Button> : null}
      </DialogActionBar>
    </Dialog>
  );
}