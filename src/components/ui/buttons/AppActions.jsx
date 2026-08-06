import { PrimaryButton, SecondaryButton } from "./Buttons";

export function AppPrimaryAction({ children, onClick, disabled = false }) {
  return <PrimaryButton onClick={onClick} disabled={disabled}>{children}</PrimaryButton>;
}

export function AppSecondaryAction({ children, onClick, disabled = false }) {
  return <SecondaryButton onClick={onClick} disabled={disabled}>{children}</SecondaryButton>;
}