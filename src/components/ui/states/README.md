# States

Role:
- Provides loading, empty, error, and no-result patterns.

Components present:
- EmptyState
- LoadingState
- Skeleton
- ErrorState
- LoadingMessageCard
- ResultsEmptyCard
- AppEmptyState

When to use:
- Use whenever data is loading, missing, filtered out, or unavailable.

Rules:
- Always include clear next-step messaging for users.
- Keep states reusable and domain-agnostic.
- Tout nouveau composant UI doit appartenir a une famille.
