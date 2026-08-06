const palette = {
  ink: "#172A2F",
  muted: "#61777B",
  surface: "#F6F8F4",
  border: "rgba(23, 42, 47, 0.12)",
  accent: "#0F5F8F",
  success: "#147D64",
  warning: "#D97706",
  danger: "#C24135",
};

export const colors = {
  text: {
    primary: palette.ink,
    secondary: palette.muted,
  },
  surface: {
    base: palette.surface,
    raised: "#FFFFFF",
  },
  border: {
    subtle: palette.border,
  },
  action: {
    accent: palette.accent,
  },
  status: {
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
  },
  
  // Backward-compatible aliases
  ink: palette.ink,
  muted: palette.muted,
  accent: palette.accent,
  success: palette.success,
  warning: palette.warning,
  danger: palette.danger,
};
