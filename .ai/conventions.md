# Conventions

These conventions keep the codebase consistent and easy to maintain.

## File naming

- Use lowercase names for files and folders.
- Use descriptive names that reflect responsibility.
- Prefer simple names such as transactionsService.js or useTransactions.js.

## Component naming

- Use PascalCase for React components.
- Use clear names such as FinancialDashboard or SummaryCard.

## Import organization

- Group external dependencies first.
- Group local imports after that.
- Keep imports sorted and consistent.

## Hooks structure

- Hooks should expose reusable logic.
- Hooks should not contain direct UI rendering.
- Hooks should return simple, predictable values.

## Services structure

- Services should only handle data access.
- Services should remain focused on Firestore operations.
- Services should not depend on UI state.

## Transaction format

Transactions should keep a consistent shape with:
- date
- montant
- categorie
- description
- type
- createdAt or updatedAt when relevant

## Naming rules

- Use French names for user-facing copy when relevant.
- Use English names for code identifiers and technical files when consistent with the stack.
- Prefer clarity over cleverness.
