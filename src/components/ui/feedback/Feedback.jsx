import { X } from 'lucide-react';
import { cx } from '../utils';
import { IconButton } from '../buttons/Buttons';
import '../styles/ui.css';

/** @param {{open?: boolean, title?: React.ReactNode, message: React.ReactNode, tone?: string, action?: React.ReactNode, onClose?: Function, className?: string}} props */
export function Toast({ open = true, title, message, tone = 'neutral', action, onClose, className }) { if (!open) return null; return <div className={cx('hui-feedback', 'hui-toast', `hui-feedback--${tone}`, className)} role={tone === 'danger' ? 'alert' : 'status'}><div>{title && <strong>{title}</strong>}<p>{message}</p>{action}</div>{onClose && <IconButton aria-label="Fermer" onClick={onClose}><X size={18} /></IconButton>}</div>; }

/** @param {{title?: React.ReactNode, children: React.ReactNode, tone?: string, icon?: React.ReactNode, action?: React.ReactNode, className?: string}} props */
export function Alert({ title, children, tone = 'info', icon, action, className }) { return <div className={cx('hui-feedback', `hui-feedback--${tone}`, className)} role={tone === 'danger' ? 'alert' : 'status'}>{icon}<div>{title && <strong>{title}</strong>}<div>{children}</div></div>{action}</div>; }

/** @param {{title: React.ReactNode, description?: React.ReactNode, tone?: string, icon?: React.ReactNode, actions?: React.ReactNode, className?: string}} props */
export function Banner({ title, description, tone = 'accent', icon, actions, className }) { return <section className={cx('hui-banner', `hui-feedback--${tone}`, className)}>{icon}<div><h2>{title}</h2>{description && <p>{description}</p>}</div>{actions && <div className="hui-banner__actions">{actions}</div>}</section>; }
