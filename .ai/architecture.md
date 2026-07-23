# Architecture

The project architecture is organized around clear separation of responsibilities.

## Layers

- services: Firestore access only
- hooks: business logic and shared state
- components: presentational UI only
- pages: screen composition

## Rules

- No visual component should call Firestore directly.
- Business calculations must be separated from UI rendering.
- Data access should stay centralized in services or hooks.
- The UI should consume prepared data rather than perform data work itself.

## Expected structure

- services/ for Firestore operations
- hooks/ for reusable logic
- components/ for display-only components
- pages/ for page composition
- utils/ for small shared helpers when needed
