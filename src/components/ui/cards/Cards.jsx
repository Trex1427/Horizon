import { isValidElement } from 'react';
import { cx } from '../utils';
import '../styles/ui.css';

/**
 * Carte de base générique. Les cartes spécialisées conservent leurs composants dédiés.
 * @param {{children?: React.ReactNode, title?: React.ReactNode, header?: React.ReactNode, footer?: React.ReactNode, actions?: React.ReactNode, loading?: boolean, loadingContent?: React.ReactNode, empty?: boolean, emptyContent?: React.ReactNode, as?: React.ElementType, tone?: 'default'|'accent'|'success'|'danger', variant?: 'default'|'outlined'|'elevated', interactive?: boolean, unstyled?: boolean, className?: string}} props
 */
export function Card({ children, title, header, footer, actions, loading = false, loadingContent = 'Chargement…', empty = false, emptyContent, as: Tag = 'article', tone = 'default', variant = 'default', interactive = false, unstyled = false, className, ...props }) {
  const useLegacyStyles = unstyled || className?.split(/\s+/).includes('v2-card');
  const heading = header ?? (title != null || actions != null ? <header className="hui-card__header"><h2>{title}</h2>{actions}</header> : null);
  const content = loading ? loadingContent : empty && emptyContent != null ? emptyContent : children;
  return <Tag className={cx(!useLegacyStyles && 'hui-card', !useLegacyStyles && `hui-card--${tone}`, !useLegacyStyles && `hui-card--${variant}`, !useLegacyStyles && interactive && 'hui-card--interactive', className)} aria-busy={loading || undefined} data-empty={empty || undefined} {...props}>{heading}{content}{footer}</Tag>;
}

/**
 * KPI générique sans calcul métier. `icon` accepte un composant ou un nœud React.
 * @param {{title?: React.ReactNode, label?: React.ReactNode, value?: React.ReactNode, subtitle?: React.ReactNode, caption?: React.ReactNode, variation?: React.ReactNode, icon?: React.ElementType|React.ReactNode, iconSize?: number, iconStrokeWidth?: number, color?: string, tone?: string, badge?: React.ReactNode, loading?: boolean, empty?: boolean, emptyLabel?: React.ReactNode, visualization?: React.ReactNode, unstyled?: boolean, className?: string, headerClassName?: string, iconClassName?: string, labelClassName?: string, valueClassName?: string, subtitleClassName?: string, valueAs?: React.ElementType}} props
 */
export function KpiCard({ title, label, value, subtitle, caption, variation, icon, iconSize = 19, iconStrokeWidth, color, tone = 'default', badge, loading = false, empty = false, emptyLabel = 'À venir', visualization, unstyled = false, className, headerClassName, iconClassName = 'v2-icon', labelClassName, valueClassName, subtitleClassName, valueAs: ValueTag = 'strong' }) {
  const useLegacyStyles = unstyled || className?.split(/\s+/).includes('v2-card');
  const Icon = !isValidElement(icon) && (typeof icon === 'function' || (typeof icon === 'object' && icon?.$$typeof)) ? icon : null;
  const iconNode = Icon ? <span className={iconClassName}><Icon size={iconSize} strokeWidth={iconStrokeWidth} /></span> : icon;
  const displayValue = loading ? 'Chargement…' : empty ? emptyLabel : value;
  const heading = title ?? label;
  const supportingText = subtitle ?? caption;
  const top = headerClassName || badge ? <div className={cx(!useLegacyStyles && 'hui-card__top', headerClassName)}>{iconNode}{badge}</div> : iconNode;
  const content = <>{top}<p className={cx(!useLegacyStyles && 'hui-kpi-card__label', labelClassName)}>{heading}</p><ValueTag className={cx(!useLegacyStyles && 'hui-kpi-card__value', valueClassName)}>{displayValue}</ValueTag>{variation}{supportingText != null && <small className={cx(!useLegacyStyles && 'hui-kpi-card__caption', subtitleClassName)}>{supportingText}</small>}{visualization}</>;
  if (useLegacyStyles) return <article className={className} style={color ? { color } : undefined} aria-busy={loading || undefined}>{content}</article>;
  return <Card tone={tone} className={cx('hui-kpi-card', className)} style={color ? { '--hui-kpi-color': color } : undefined} aria-busy={loading || undefined}>{content}</Card>;
}

/** @param {{eyebrow?: React.ReactNode, title?: React.ReactNode, value?: React.ReactNode, summary?: React.ReactNode, items?: Array<{label: React.ReactNode, value: React.ReactNode}>, actions?: React.ReactNode, footer?: React.ReactNode, children?: React.ReactNode, as?: React.ElementType, loading?: boolean, empty?: boolean, unstyled?: boolean, className?: string}} props */
export function SummaryCard({ eyebrow, title, value, summary, items = [], actions, footer, children, as = 'article', loading = false, empty = false, unstyled = false, className, ...props }) { const legacy = unstyled || className?.split(/\s+/).includes('v2-card'); if (legacy && title == null && value == null && summary == null && !items.length && actions == null) return <Card as={as} unstyled className={className} loading={loading} empty={empty} footer={footer} {...props}>{children}</Card>; return <Card as={as} className={cx('hui-summary-card', className)} loading={loading} empty={empty} footer={footer} {...props}>{eyebrow && <p className="hui-eyebrow">{eyebrow}</p>}{(title != null || actions != null) && <header className="hui-card__header"><h2>{title}</h2>{actions}</header>}{value != null && <strong className="hui-summary-card__value">{value}</strong>}{summary != null && <p className="hui-summary-card__summary">{summary}</p>}{items.length > 0 && <dl className="hui-summary-card__items">{items.map((item, index) => <div key={`${String(item.label)}-${index}`}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>}{children}</Card>; }

/** @param {{title?: React.ReactNode, eyebrow?: React.ReactNode, description?: React.ReactNode, actions?: React.ReactNode, children?: React.ReactNode, as?: React.ElementType, loading?: boolean, empty?: boolean, footer?: React.ReactNode, unstyled?: boolean, className?: string}} props */
export function SectionCard({ title, eyebrow, description, actions, children, as = 'section', loading = false, empty = false, footer, unstyled = false, className, ...props }) { const legacy = unstyled || className?.split(/\s+/).includes('v2-card'); if (legacy && title == null && eyebrow == null && description == null && actions == null) return <Card as={as} unstyled className={className} loading={loading} empty={empty} footer={footer} {...props}>{children}</Card>; return <Card as={as} className={cx('hui-section-card', className)} loading={loading} empty={empty} footer={footer} {...props}><header className="hui-card__header"><div>{eyebrow && <p className="hui-eyebrow">{eyebrow}</p>}<h2>{title}</h2>{description && <p>{description}</p>}</div>{actions}</header>{children}</Card>; }

/** @param {{icon?: React.ReactNode, title?: React.ReactNode, text?: React.ReactNode, description?: React.ReactNode, badge?: React.ReactNode, action?: React.ReactNode, children?: React.ReactNode, as?: React.ElementType, loading?: boolean, empty?: boolean, footer?: React.ReactNode, tone?: string, unstyled?: boolean, className?: string}} props */
export function InfoCard({ icon, title, text, description, badge, action, children, as = 'article', loading = false, empty = false, footer, tone = 'default', unstyled = false, className, ...props }) { const legacy = unstyled || className?.split(/\s+/).includes('v2-card'); if (legacy && icon == null && title == null && text == null && description == null && badge == null && action == null) return <Card as={as} unstyled className={className} loading={loading} empty={empty} footer={footer} {...props}>{children}</Card>; return <Card as={as} tone={tone} className={cx('hui-info-card', className)} loading={loading} empty={empty} footer={footer} {...props}>{icon && <span className="hui-info-card__icon">{icon}</span>}<div>{badge}{title != null && <h3>{title}</h3>}{(text ?? description) != null && <p>{text ?? description}</p>}{children}{action}</div></Card>; }
