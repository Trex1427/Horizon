import { cx } from '../utils';
import '../styles/ui.css';

/** @param {{children: React.ReactNode, sidebar?: React.ReactNode, bottomNavigation?: React.ReactNode, className?: string}} props */
export function PageLayout({ children, sidebar, bottomNavigation, className }) {
  return <div className={cx('hui-page-layout', className)}>{sidebar}<main className="hui-page-layout__main">{children}</main>{bottomNavigation}</div>;
}

/** @param {{eyebrow?: React.ReactNode, title: React.ReactNode, description?: React.ReactNode, actions?: React.ReactNode, className?: string}} props */
export function PageHeader({ eyebrow, title, description, actions, className }) {
  return <header className={cx('hui-page-header', className)}><div>{eyebrow && <p className="hui-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="hui-page-header__description">{description}</p>}</div>{actions && <div className="hui-page-header__actions">{actions}</div>}</header>;
}

/** @param {{children: React.ReactNode, title?: React.ReactNode, description?: React.ReactNode, actions?: React.ReactNode, as?: React.ElementType, className?: string}} props */
export function Section({ children, title, description, actions, as: Tag = 'section', className }) {
  return <Tag className={cx('hui-section', className)}>{(title || description || actions) && <div className="hui-section__header"><div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>{actions}</div>}{children}</Tag>;
}

/** @param {{children: React.ReactNode, columns?: number, minItemWidth?: string, as?: React.ElementType, className?: string}} props */
export function Grid({ children, columns, minItemWidth = '16rem', as: Tag = 'div', className }) {
  const style = columns ? { '--hui-grid-columns': columns } : { '--hui-grid-min': minItemWidth };
  return <Tag className={cx('hui-grid', columns && 'hui-grid--fixed', className)} style={style}>{children}</Tag>;
}

/** @param {{children: React.ReactNode, size?: 'narrow'|'default'|'wide'|'full', as?: React.ElementType, className?: string}} props */
export function Container({ children, size = 'default', as: Tag = 'div', className }) {
  return <Tag className={cx('hui-container', `hui-container--${size}`, className)}>{children}</Tag>;
}
