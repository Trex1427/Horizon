import { forwardRef } from 'react';
import { cx } from '../utils';
import '../styles/ui.css';

const Button = forwardRef(function Button({ children, className, variant, type = 'button', ...props }, ref) {
  return <button ref={ref} type={type} className={cx('hui-button', `hui-button--${variant}`, className)} {...props}>{children}</button>;
});

/** @param {React.ButtonHTMLAttributes<HTMLButtonElement>} props */
export const PrimaryButton = forwardRef(function PrimaryButton(props, ref) { return <Button ref={ref} variant="primary" {...props} />; });
/** @param {React.ButtonHTMLAttributes<HTMLButtonElement>} props */
export const SecondaryButton = forwardRef(function SecondaryButton(props, ref) { return <Button ref={ref} variant="secondary" {...props} />; });
/** @param {React.ButtonHTMLAttributes<HTMLButtonElement>} props */
export const GhostButton = forwardRef(function GhostButton(props, ref) { return <Button ref={ref} variant="ghost" {...props} />; });
/** @param {React.ButtonHTMLAttributes<HTMLButtonElement>} props */
export const DangerButton = forwardRef(function DangerButton(props, ref) { return <Button ref={ref} variant="danger" {...props} />; });
/** @param {React.ButtonHTMLAttributes<HTMLButtonElement> & {'aria-label': string, size?: 'sm'|'md'|'lg'}} props */
export const IconButton = forwardRef(function IconButton({ size = 'md', className, ...props }, ref) { return <Button ref={ref} variant="icon" className={cx(`hui-button--icon-${size}`, className)} {...props} />; });
