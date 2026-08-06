import { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { cx } from '../utils';
import { DangerButton, IconButton, PrimaryButton, SecondaryButton } from '../buttons/Buttons';
import '../styles/ui.css';

function useDialogAccess({ open, onClose, closeOnEscape, restoreFocus, panelRef }) {
  useEffect(() => {
    if (!open) return undefined;
    const previousFocus = document.activeElement;
    const panel = panelRef.current;
    const focusable = () => [...(panel?.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])];
    if (panel && !panel.contains(document.activeElement)) focusable()[0]?.focus();
    const listener = (event) => {
      if (event.key === 'Escape' && closeOnEscape) {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', listener);
    return () => {
      window.removeEventListener('keydown', listener);
      if (restoreFocus && previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [closeOnEscape, onClose, open, panelRef, restoreFocus]);
}

function Overlay({ open, onClose, closeOnBackdrop, children, className, unstyled = false, as: Tag = 'div' }) {
  if (!open) return null;
  return <Tag className={cx(!unstyled && 'hui-overlay', className)} role={unstyled ? 'presentation' : undefined} onMouseDown={event => { if (closeOnBackdrop && event.target === event.currentTarget) onClose?.(); }}>{children}</Tag>;
}

/** @param {{open?: boolean, title?: React.ReactNode, description?: React.ReactNode, children?: React.ReactNode, content?: React.ReactNode, footer?: React.ReactNode, actions?: React.ReactNode, onClose?: Function, closeOnEscape?: boolean, closeOnBackdrop?: boolean, restoreFocus?: boolean, size?: 'sm'|'md'|'lg', as?: React.ElementType, overlayAs?: React.ElementType, overlayClassName?: string, ariaLabelledby?: string, unstyled?: boolean, className?: string}} props */
export function Dialog({ open = true, title, description, children, content, footer, actions, onClose, closeOnEscape = true, closeOnBackdrop = true, restoreFocus = true, size = 'md', as: Panel = 'section', overlayAs = 'div', overlayClassName, ariaLabelledby, unstyled = false, className, ...props }) {
  const generatedTitleId = useId();
  const panelRef = useRef(null);
  const titleId = ariaLabelledby || generatedTitleId;
  useDialogAccess({ open, onClose, closeOnEscape, restoreFocus, panelRef });
  const legacy = unstyled;
  return <Overlay as={overlayAs} open={open} onClose={onClose} closeOnBackdrop={closeOnBackdrop} className={overlayClassName} unstyled={legacy}>
    <Panel ref={panelRef} tabIndex={legacy ? undefined : -1} className={cx(!legacy && 'hui-dialog', !legacy && 'hui-dialog--' + size, className)} role="dialog" aria-modal="true" aria-labelledby={titleId} {...props}>
      {legacy ? children : <><header><div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div>{onClose && <IconButton aria-label="Fermer" onClick={onClose}><X size={20} /></IconButton>}</header>{(content ?? children) != null && <div className="hui-dialog__body">{content ?? children}</div>}{(footer ?? actions) != null && <footer>{footer ?? actions}</footer>}</>}
    </Panel>
  </Overlay>;
}

/** @param {{open: boolean, title: React.ReactNode, message?: React.ReactNode, description?: React.ReactNode, confirmLabel?: React.ReactNode, cancelLabel?: React.ReactNode, onConfirm: Function, onClose: Function, loading?: boolean, variant?: 'danger'|'warning'|'info', children?: React.ReactNode}} props */
export function ConfirmDialog({ open, title, message, description, confirmLabel = 'Confirmer', cancelLabel = 'Annuler', onConfirm, onClose, loading = false, variant = 'danger', children }) {
  const ConfirmButton = variant === 'danger' ? DangerButton : PrimaryButton;
  return <Dialog open={open} title={title} description={description ?? message} onClose={onClose} actions={<><SecondaryButton onClick={onClose}>{cancelLabel}</SecondaryButton><ConfirmButton onClick={onConfirm} disabled={loading}>{confirmLabel}</ConfirmButton></>}>{children}</Dialog>;
}

/** @param {{open: boolean, title: React.ReactNode, children: React.ReactNode, onClose?: Function, side?: 'left'|'right', footer?: React.ReactNode, className?: string}} props */
export function Drawer({ open, title, children, onClose, side = 'right', footer, className }) { const panelRef = useRef(null); const titleId = useId(); useDialogAccess({ open, onClose, closeOnEscape: true, restoreFocus: true, panelRef }); return <Overlay open={open} onClose={onClose} closeOnBackdrop className={'hui-overlay--' + side}><aside ref={panelRef} tabIndex={-1} className={cx('hui-drawer', 'hui-drawer--' + side, className)} role="dialog" aria-modal="true" aria-labelledby={titleId}><header><h2 id={titleId}>{title}</h2>{onClose && <IconButton aria-label="Fermer" onClick={onClose}><X size={20} /></IconButton>}</header><div className="hui-dialog__body">{children}</div>{footer && <footer>{footer}</footer>}</aside></Overlay>; }

/** @param {{open: boolean, title: React.ReactNode, children: React.ReactNode, onClose?: Function, footer?: React.ReactNode, className?: string}} props */
export function BottomSheet({ open, title, children, onClose, footer, className }) { const panelRef = useRef(null); const titleId = useId(); useDialogAccess({ open, onClose, closeOnEscape: true, restoreFocus: true, panelRef }); return <Overlay open={open} onClose={onClose} closeOnBackdrop className="hui-overlay--bottom"><section ref={panelRef} tabIndex={-1} className={cx('hui-bottom-sheet', className)} role="dialog" aria-modal="true" aria-labelledby={titleId}><span className="hui-bottom-sheet__handle" aria-hidden="true" /><header><h2 id={titleId}>{title}</h2>{onClose && <IconButton aria-label="Fermer" onClick={onClose}><X size={20} /></IconButton>}</header><div className="hui-dialog__body">{children}</div>{footer && <footer>{footer}</footer>}</section></Overlay>; }
