# Foundations

Role:
- Defines Design Tokens used by all UI families.

Components and tokens:
- colors
- spacing
- typography
- radius
- elevation
- transitions
- breakpoints
- MuiPrimitives (bridge des primitives MUI via famille officielle)

When to use:
- Use Foundations for visual constants and shared scales.
- Do not place business logic or page composition here.

Rules:
- Tokens are the single source of visual constants.
- Changes must preserve backward compatibility unless documented.
- Tout nouveau composant UI doit appartenir a une famille.

Official token access examples:
- colors.status.danger
- spacing.md
- radius.lg
- typography.body.sm
- elevation.md
- transitions.fast
- breakpoints.up.md / breakpoints.down.sm
