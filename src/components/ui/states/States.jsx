import { cx } from '../utils';
import '../styles/ui.css';

/** @param {{illustration?: React.ReactNode, icon?: React.ReactNode, title?: React.ReactNode, description?: React.ReactNode, primaryAction?: React.ReactNode, secondaryAction?: React.ReactNode, action?: React.ReactNode, children?: React.ReactNode, as?: React.ElementType, loading?: boolean, unstyled?: boolean, className?: string}} props */
export function EmptyState({ illustration, icon, title, description, primaryAction, secondaryAction, action, children, as: Tag = 'section', loading = false, unstyled = false, className, ...props }) {
  if (unstyled) return <Tag className={className} aria-busy={loading || undefined} {...props}>{children}</Tag>;
  return <Tag className={cx('hui-state', className)} aria-busy={loading || undefined} {...props}>{illustration}{icon && <div className="hui-state__icon">{icon}</div>}{title != null && <h2>{title}</h2>}{description != null && <p>{description}</p>}{children}<div className="hui-state__actions">{primaryAction ?? action}{secondaryAction}</div></Tag>;
}

/** @param {{label?: React.ReactNode, loader?: React.ReactNode, children?: React.ReactNode, inline?: boolean, as?: React.ElementType, unstyled?: boolean, className?: string}} props */
export function LoadingState({ label = 'Chargement…', loader, children, inline = false, as: Tag = 'div', unstyled = false, className, ...props }) {
  if (unstyled) return <Tag className={className} role="status" {...props}>{children ?? label}</Tag>;
  return <Tag className={cx('hui-loading', inline && 'hui-loading--inline', className)} role="status" {...props}>{loader ?? <span className="hui-spinner" aria-hidden="true" />}<span>{children ?? label}</span></Tag>;
}

/** @param {{width?: string|number, height?: string|number, circle?: boolean, lines?: number, variant?: 'text'|'card'|'avatar'|'chart', responsive?: boolean, className?: string}} props */
export function Skeleton({ width = '100%', height = '1rem', circle = false, lines = 1, variant = 'text', responsive = true, className }) { return <div className={cx('hui-skeleton-group', responsive && 'hui-skeleton-group--responsive', 'hui-skeleton-group--' + variant, className)} aria-hidden="true">{Array.from({ length: lines }, (_, index) => <span key={index} className={cx('hui-skeleton', circle && 'hui-skeleton--circle')} style={{ width, height }} />)}</div>; }

/** @param {{title?: React.ReactNode, message?: React.ReactNode, description?: React.ReactNode, action?: React.ReactNode, icon?: React.ReactNode, children?: React.ReactNode, as?: React.ElementType, unstyled?: boolean, className?: string}} props */
export function ErrorState({ title = 'Une erreur est survenue.', message, description, action, icon, children, as: Tag = 'section', unstyled = false, className, ...props }) {
  if (unstyled) return <Tag className={className} role="alert" {...props}>{children ?? message ?? description}</Tag>;
  return <Tag className={cx('hui-state', 'hui-state--error', className)} role="alert" {...props}>{icon && <div className="hui-state__icon">{icon}</div>}<h2>{title}</h2>{(message ?? description) != null && <p>{message ?? description}</p>}{children}{action}</Tag>;
}
