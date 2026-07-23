# OwnerUid Migration Dry-Run

## Resume

- Date: 2026-07-22T17:09:24.772Z
- Project ID: budget-alexandre
- Database ID: (default)
- Backup: C:\Users\alext\budget-alexandre\backups\firestore\2026-07-22_17-08-53
- UID cible: wS0YVERetOhpl2UcVCeQ9WtIO9x1
- Mode par defaut: DRY-RUN
- Ecritures production: 0
- Verdict: DRY_RUN_OWNERUID_READY_FOR_EMULATOR_VALIDATION

## Perimetre

| Collection | Categorie | Documents | Migratables | Deja conformes | Conflits | Types invalides |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| accounts | A_PROTECTED_WITH_DOCUMENTS | 5 | 5 | 0 | 0 | 0 |
| activities | A_PROTECTED_WITH_DOCUMENTS | 13 | 13 | 0 | 0 | 0 |
| bankImports | A_PROTECTED_WITH_DOCUMENTS | 5 | 5 | 0 | 0 | 0 |
| budgets | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| categories | A_PROTECTED_WITH_DOCUMENTS | 34 | 34 | 0 | 0 | 0 |
| fixedExpenses | A_PROTECTED_WITH_DOCUMENTS | 11 | 11 | 0 | 0 | 0 |
| fraisFixes | C_NOT_COVERED_BY_RULES | 1 | 0 | 0 | 0 | 0 |
| goals | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| objectives | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| opportunities | A_PROTECTED_WITH_DOCUMENTS | 4 | 4 | 0 | 0 | 0 |
| parametres | C_NOT_COVERED_BY_RULES | 1 | 0 | 0 | 0 | 0 |
| projects | A_PROTECTED_WITH_DOCUMENTS | 3 | 3 | 0 | 0 | 0 |
| receiptDrafts | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| recurringIncome | A_PROTECTED_WITH_DOCUMENTS | 2 | 2 | 0 | 0 | 0 |
| subcategories | A_PROTECTED_WITH_DOCUMENTS | 54 | 54 | 0 | 0 | 0 |
| thirdParties | A_PROTECTED_WITH_DOCUMENTS | 50 | 50 | 0 | 0 | 0 |
| tickets | C_NOT_COVERED_BY_RULES | 1 | 0 | 0 | 0 | 0 |
| transactionDrafts | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |
| transactions | A_PROTECTED_WITH_DOCUMENTS | 215 | 215 | 0 | 0 | 0 |
| transfers | B_PROTECTED_EMPTY | 0 | 0 | 0 | 0 | 0 |

## Patch simule

```json
{
  "ownerUid": "wS0YVERetOhpl2UcVCeQ9WtIO9x1"
}
```

Champs metier modifies: AUCUN.

## Batches

- Documents migratables: 396
- Taille batch: 450
- Nombre de batches: 1
- Derniere batch: 396
- Nombre exact d'ecritures futures: 396

## Collections hors perimetre

- fraisFixes: Keep out of this migration. Review usage separately before deciding whether to add rules coverage, archive, or map to a modern collection.
- parametres: Keep out of this migration. Review usage separately before deciding whether to add rules coverage, archive, or map to a modern collection.
- tickets: Keep out of this migration. Review usage separately before deciding whether to add rules coverage, archive, or map to a modern collection.

## Bloquants

- Aucun bloqueur detecte dans le backup analyse.

## Warnings

- Out-of-scope historical collections detected: fraisFixes, parametres and/or tickets. They are not migrated in this sprint.

## Interdictions respectees

- Migration production: NON EFFECTUEE
- Deploiement Firestore Rules: NON EFFECTUE
- Deploiement Hosting: NON EFFECTUE
- Documents Firestore production modifies: 0
