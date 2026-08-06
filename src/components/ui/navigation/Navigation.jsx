import { cx } from '../utils';
import '../styles/ui.css';

function NavigationButton({ item, activeId, onNavigate }) { const Icon = item.icon; return <button type="button" className={cx('hui-navigation__item', item.id === activeId && 'is-active')} aria-current={item.id === activeId ? 'page' : undefined} onClick={() => onNavigate?.(item)}>{Icon && <Icon size={20} aria-hidden="true" />}<span>{item.label}</span>{item.badge}</button>; }

/** @param {{brand?: React.ReactNode, groups?: Array<{id?: string, label?: React.ReactNode, items: Array<object>}>, activeId?: string, onNavigate?: Function, footer?: React.ReactNode, className?: string}} props */
export function Sidebar({ brand, groups = [], activeId, onNavigate, footer, className }) { return <aside className={cx('hui-sidebar', className)}>{brand && <div className="hui-sidebar__brand">{brand}</div>}<nav aria-label="Navigation principale">{groups.map((group, index) => <section key={group.id || index} className="hui-navigation__group">{group.label && <p>{group.label}</p>}{group.items.map(item => <NavigationButton key={item.id} item={item} activeId={activeId} onNavigate={onNavigate} />)}</section>)}</nav>{footer && <div className="hui-sidebar__footer">{footer}</div>}</aside>; }

/** @param {{items?: Array<object>, activeId?: string, onNavigate?: Function, label?: string, className?: string}} props */
export function BottomNavigation({ items = [], activeId, onNavigate, label = 'Navigation principale', className }) { return <nav className={cx('hui-bottom-navigation', className)} aria-label={label}>{items.map(item => <NavigationButton key={item.id} item={item} activeId={activeId} onNavigate={onNavigate} />)}</nav>; }

/**
 * Barre d’actions générique. Les slots acceptent des contrôles déjà configurés et n’ajoutent aucune logique métier.
 * @param {{children?: React.ReactNode, search?: React.ReactNode, period?: React.ReactNode, filters?: React.ReactNode, sort?: React.ReactNode, secondaryActions?: React.ReactNode, primaryAction?: React.ReactNode, activeFiltersCount?: number, loading?: boolean, loadingContent?: React.ReactNode, empty?: boolean, emptyContent?: React.ReactNode, label?: string, as?: React.ElementType, unstyled?: boolean, className?: string}} props
 */
export function ActionBar({ children, search, period, filters, sort, secondaryActions, primaryAction, activeFiltersCount, loading = false, loadingContent = 'Chargement…', empty = false, emptyContent, label = 'Actions de la page', as: Tag = 'div', unstyled = false, className }) {
  const useLegacyStyles = unstyled || className?.split(/\s+/).includes('v2-card');
  const Root = useLegacyStyles && Tag === 'div' ? 'section' : Tag;
  const slots = children ?? <>{search}{period}{filters}{sort}{secondaryActions}{primaryAction}</>;
  const content = loading ? loadingContent : empty && emptyContent != null ? emptyContent : slots;
  return <Root className={cx(!useLegacyStyles && 'hui-action-bar', className)} role="group" aria-label={label} aria-busy={loading || undefined} data-empty={empty || undefined}>{content}{activeFiltersCount > 0 && <span className="hui-action-bar__count" aria-label={`${activeFiltersCount} filtres actifs`}>{activeFiltersCount}</span>}</Root>;
}
