import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Typography,
  useMediaQuery,
} from "@mui/material";

const DEFAULT_FOCUS_SELECTOR = [
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function focusFirstElement(container, selector = "") {
  if (!container) {
    return;
  }

  const target = container.querySelector(selector || DEFAULT_FOCUS_SELECTOR);
  if (target && typeof target.focus === "function") {
    target.focus();
  }
}

export default function EntityDialog({
  open,
  title,
  children,
  onClose,
  onSubmit,
  submitting = false,
  fullScreenMobile = true,
  submitLabel = "Enregistrer",
  cancelLabel = "Annuler",
  maxWidth = "md",
  errorMessage = "",
  footerStartContent = null,
  isDirty = false,
  requireDirtyConfirmation = true,
  unsavedChangesTitle = "Fermer sans enregistrer ?",
  unsavedChangesMessage = "Des modifications non enregistrees seront perdues.",
  autoFocusSelector = "",
  formId = "",
  disableSubmit = false,
  scrollRestorePosition = null,
}) {
  const isNarrowViewport = useMediaQuery("(max-width:600px)");
  const isShortViewport = useMediaQuery("(max-height:600px)");
  const useFullScreen = fullScreenMobile && (isNarrowViewport || isShortViewport);
  const generatedFormId = useId().replace(/:/g, "");
  const resolvedFormId = formId || `entity-dialog-form-${generatedFormId}`;
  const contentRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const restoreScrollOnCloseRef = useRef(false);
  const wasOpenRef = useRef(open);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirmCloseOpen(false);
      return;
    }

    if (useFullScreen) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      focusFirstElement(contentRef.current, autoFocusSelector);
    });

    return () => cancelAnimationFrame(frame);
  }, [open, autoFocusSelector, useFullScreen]);

  useLayoutEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;

    if (open && !wasOpen) {
      if (scrollRestorePosition !== null) {
        scrollPositionRef.current = scrollRestorePosition;
        return;
      }

      scrollPositionRef.current = window.scrollY;
      return;
    }
  }, [open, scrollRestorePosition]);

  useEffect(() => {
    if (open || !restoreScrollOnCloseRef.current) {
      return undefined;
    }

    const nextScrollPosition = scrollRestorePosition ?? scrollPositionRef.current;
    const timeoutId = window.setTimeout(() => {
      window.scrollTo({ top: nextScrollPosition, behavior: "auto" });
      restoreScrollOnCloseRef.current = false;
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [open, scrollRestorePosition]);

  function requestSubmit() {
    if (submitting || disableSubmit) {
      return;
    }

    if (formId) {
      const formElement = document.getElementById(resolvedFormId);
      if (formElement && typeof formElement.requestSubmit === "function") {
        formElement.requestSubmit();
        return;
      }
    }

    onSubmit?.();
  }

  function requestClose(event = null, reason = "close") {
    if (submitting) {
      return;
    }

    if (requireDirtyConfirmation && isDirty) {
      setConfirmCloseOpen(true);
      return;
    }

    restoreScrollOnCloseRef.current = true;
    onClose?.(event, reason);
  }

  function handleDialogClose(event, reason) {
    requestClose(event, reason || "close");
  }

  function handleKeyDown(event) {
    if (submitting) {
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      requestSubmit();
      return;
    }

    if (event.key === "Escape" && requireDirtyConfirmation && isDirty) {
      event.preventDefault();
      setConfirmCloseOpen(true);
    }
  }

  function handleConfirmClose() {
    setConfirmCloseOpen(false);
    restoreScrollOnCloseRef.current = true;
    onClose?.(null, "confirm-close");
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={handleDialogClose}
        onKeyDown={handleKeyDown}
        disableRestoreFocus
        slotProps={{
          transition: {
            onEntered: () => {
              if (!useFullScreen) {
                focusFirstElement(contentRef.current, autoFocusSelector);
              }
            },
          },
        }}
        fullWidth
        fullScreen={useFullScreen}
        maxWidth={maxWidth}
        scroll="paper"
        PaperProps={{
          sx: {
            borderRadius: useFullScreen ? 0 : 3,
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column",
            height: useFullScreen ? "100dvh" : undefined,
            maxHeight: useFullScreen ? "100dvh" : undefined,
          },
        }}
      >
        {submitting ? <LinearProgress /> : null}
        <DialogTitle
          sx={{
            pl: { xs: "calc(env(safe-area-inset-left, 0px) + 16px)", sm: 3 },
            pr: { xs: "calc(env(safe-area-inset-right, 0px) + 56px)", sm: 7 },
            pt: { xs: "calc(env(safe-area-inset-top, 0px) + 14px)", sm: 2 },
            pb: { xs: 1.75, sm: 2 },
          }}
        >
          {title}
          <IconButton
            aria-label="Fermer"
            onClick={() => requestClose(null, "close-button")}
            disabled={submitting}
            sx={{
              position: "absolute",
              right: "calc(env(safe-area-inset-right, 0px) + 8px)",
              top: "calc(env(safe-area-inset-top, 0px) + 8px)",
            }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent
          ref={contentRef}
          sx={{
            pl: { xs: "calc(env(safe-area-inset-left, 0px) + 16px)", sm: 3 },
            pr: { xs: "calc(env(safe-area-inset-right, 0px) + 16px)", sm: 3 },
            pt: 0,
            pb: 2,
            overflowX: "hidden",
          }}
        >
          {errorMessage ? <Alert severity="error" sx={{ mb: 1.5 }}>{errorMessage}</Alert> : null}
          {children}
        </DialogContent>
        <DialogActions
          sx={{
            pl: { xs: "calc(env(safe-area-inset-left, 0px) + 16px)", sm: 3 },
            pr: { xs: "calc(env(safe-area-inset-right, 0px) + 16px)", sm: 3 },
            pb: { xs: "calc(env(safe-area-inset-bottom, 0px) + 16px)", sm: 2.5 },
            pt: 1.25,
            borderTop: "1px solid",
            borderColor: "divider",
            position: "sticky",
            bottom: 0,
            backgroundColor: "background.paper",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" },
            gap: 1,
          }}
        >
          {footerStartContent}
          <Button onClick={() => requestClose(null, "cancel")} fullWidth={useFullScreen} disabled={submitting}>
            {cancelLabel}
          </Button>
          <Button onClick={requestSubmit} variant="contained" disabled={submitting || disableSubmit} fullWidth={useFullScreen}>
            {submitting ? "Enregistrement..." : submitLabel}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmCloseOpen} onClose={() => setConfirmCloseOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{unsavedChangesTitle}</DialogTitle>
        <DialogContent>
          <Typography>{unsavedChangesMessage}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmCloseOpen(false)}>Continuer l'edition</Button>
          <Button color="warning" variant="contained" onClick={handleConfirmClose}>
            Fermer sans enregistrer
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
