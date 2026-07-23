# OwnerUid Migration Dry-Run

## Resume

- Date: 2026-07-22T17:15:40.966Z
- Project ID: budget-alexandre
- Database ID: (default)
- Backup: C:\Users\alext\budget-alexandre\tmp\owner-uid-emulator-backup
- UID cible: ownerUidFixture123
- Mode par defaut: DRY-RUN
- Ecritures production: 0
- Verdict: EMULATOR_OWNERUID_MIGRATION_APPLIED

## Perimetre

| Collection | Categorie | Documents | Migratables | Deja conformes | Conflits | Types invalides |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| accounts | A_PROTECTED_WITH_DOCUMENTS | 8 | 3 | 1 | 1 | 3 |
| activities | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| bankImports | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| budgets | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| categories | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| fixedExpenses | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| fraisFixes | C_NOT_COVERED_BY_RULES | 1 | 0 | 0 | 0 | 0 |
| goals | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| objectives | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| opportunities | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| projects | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| receiptDrafts | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| recurringIncome | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| subcategories | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| thirdParties | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| transactionDrafts | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| transactions | A_PROTECTED_WITH_DOCUMENTS | 260 | 260 | 0 | 0 | 0 |
| transfers | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |

## Patch simule

```json
{
  "ownerUid": "ownerUidFixture123"
}
```

Champs metier modifies: AUCUN.

## Batches

- Documents migratables: 263
- Taille batch: 100
- Nombre de batches: 3
- Derniere batch: 63
- Nombre exact d'ecritures futures: 263

## Collections hors perimetre

- fraisFixes: Keep out of this migration. Review usage separately before deciding whether to add rules coverage, archive, or map to a modern collection.
- parametres: Keep out of this migration. Review usage separately before deciding whether to add rules coverage, archive, or map to a modern collection.
- tickets: Keep out of this migration. Review usage separately before deciding whether to add rules coverage, archive, or map to a modern collection.

## Bloquants

- Aucun bloqueur detecte dans le backup analyse.

## Warnings

- Fixture review issue: 1 documents have a conflicting ownerUid.
- Fixture review issue: 3 documents have invalid ownerUid types.
- Out-of-scope historical collections detected: fraisFixes, parametres and/or tickets. They are not migrated in this sprint.

## Interdictions respectees

- Migration production: NON EFFECTUEE
- Deploiement Firestore Rules: NON EFFECTUE
- Deploiement Hosting: NON EFFECTUE
- Documents Firestore production modifies: 0
