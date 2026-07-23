# OwnerUid Compatibility Audit

## Resume

- Date: 2026-07-17T11:20:58.573Z
- Project ID: budget-alexandre
- Backup utilise: C:\Users\alext\budget-alexandre\backups\firestore\2026-07-17_11-18-22
- UID attendu: not_determined
- Verdict: NOT_READY_FOR_RULES_DEPLOYMENT

## Inventaire des rules

| Collection | Read | Create | Update | Delete | ownerUid requis |
| --- | --- | --- | --- | --- | --- |
| accounts | get,list if authenticated ownerUid == request.auth.uid | request.resource.data.ownerUid string == request.auth.uid | existing ownerUid == request.auth.uid and incoming ownerUid unchanged | existing ownerUid == request.auth.uid | oui |
| transactions | get,list if authenticated ownerUid == request.auth.uid | request.resource.data.ownerUid string == request.auth.uid | existing ownerUid == request.auth.uid and incoming ownerUid unchanged | existing ownerUid == request.auth.uid | oui |
| categories | get,list if authenticated ownerUid == request.auth.uid | request.resource.data.ownerUid string == request.auth.uid | existing ownerUid == request.auth.uid and incoming ownerUid unchanged | existing ownerUid == request.auth.uid | oui |
| subcategories | get,list if authenticated ownerUid == request.auth.uid | request.resource.data.ownerUid string == request.auth.uid | existing ownerUid == request.auth.uid and incoming ownerUid unchanged | existing ownerUid == request.auth.uid | oui |
| thirdParties | get,list if authenticated ownerUid == request.auth.uid | request.resource.data.ownerUid string == request.auth.uid | existing ownerUid == request.auth.uid and incoming ownerUid unchanged | existing ownerUid == request.auth.uid | oui |
| activities | get,list if authenticated ownerUid == request.auth.uid | request.resource.data.ownerUid string == request.auth.uid | existing ownerUid == request.auth.uid and incoming ownerUid unchanged | existing ownerUid == request.auth.uid | oui |
| projects | get,list if authenticated ownerUid == request.auth.uid | request.resource.data.ownerUid string == request.auth.uid | existing ownerUid == request.auth.uid and incoming ownerUid unchanged | existing ownerUid == request.auth.uid | oui |
| budgets | get,list if authenticated ownerUid == request.auth.uid | request.resource.data.ownerUid string == request.auth.uid | existing ownerUid == request.auth.uid and incoming ownerUid unchanged | existing ownerUid == request.auth.uid | oui |
| goals | get,list if authenticated ownerUid == request.auth.uid | request.resource.data.ownerUid string == request.auth.uid | existing ownerUid == request.auth.uid and incoming ownerUid unchanged | existing ownerUid == request.auth.uid | oui |
| objectives | get,list if authenticated ownerUid == request.auth.uid | request.resource.data.ownerUid string == request.auth.uid | existing ownerUid == request.auth.uid and incoming ownerUid unchanged | existing ownerUid == request.auth.uid | oui |
| fixedExpenses | get,list if authenticated ownerUid == request.auth.uid | request.resource.data.ownerUid string == request.auth.uid | existing ownerUid == request.auth.uid and incoming ownerUid unchanged | existing ownerUid == request.auth.uid | oui |
| recurringIncome | get,list if authenticated ownerUid == request.auth.uid | request.resource.data.ownerUid string == request.auth.uid | existing ownerUid == request.auth.uid and incoming ownerUid unchanged | existing ownerUid == request.auth.uid | oui |
| bankImports | get,list if authenticated ownerUid == request.auth.uid | request.resource.data.ownerUid string == request.auth.uid | existing ownerUid == request.auth.uid and incoming ownerUid unchanged | existing ownerUid == request.auth.uid | oui |
| receiptDrafts | get,list if authenticated ownerUid == request.auth.uid | request.resource.data.ownerUid string == request.auth.uid | existing ownerUid == request.auth.uid and incoming ownerUid unchanged | existing ownerUid == request.auth.uid | oui |
| transactionDrafts | get,list if authenticated ownerUid == request.auth.uid | request.resource.data.ownerUid string == request.auth.uid | existing ownerUid == request.auth.uid and incoming ownerUid unchanged | existing ownerUid == request.auth.uid | oui |
| opportunities | get,list if authenticated ownerUid == request.auth.uid | request.resource.data.ownerUid string == request.auth.uid | existing ownerUid == request.auth.uid and incoming ownerUid unchanged | existing ownerUid == request.auth.uid | oui |
| transfers | get,list if authenticated ownerUid == request.auth.uid | request.resource.data.ownerUid string == request.auth.uid | existing ownerUid == request.auth.uid and incoming ownerUid unchanged | existing ownerUid == request.auth.uid | oui |

## Audit Firestore lecture seule

| Collection | Documents | ownerUid present | ownerUid absent | invalide | valeurs distinctes |
| --- | --- | --- | --- | --- | --- |
| accounts | 5 | 0 | 5 | 0 | 0 |
| transactions | 211 | 0 | 211 | 0 | 0 |
| categories | 34 | 0 | 34 | 0 | 0 |
| subcategories | 53 | 0 | 53 | 0 | 0 |
| thirdParties | 50 | 0 | 50 | 0 | 0 |
| activities | 13 | 0 | 13 | 0 | 0 |
| projects | 3 | 0 | 3 | 0 | 0 |
| budgets | 0 | 0 | 0 | 0 | 0 |
| goals | 0 | 0 | 0 | 0 | 0 |
| objectives | 0 | 0 | 0 | 0 | 0 |
| fixedExpenses | 11 | 0 | 11 | 0 | 0 |
| recurringIncome | 2 | 0 | 2 | 0 | 0 |
| bankImports | 5 | 0 | 5 | 0 | 0 |
| receiptDrafts | 0 | 0 | 0 | 0 | 0 |
| transactionDrafts | 0 | 0 | 0 | 0 | 0 |
| opportunities | 4 | 0 | 4 | 0 | 0 |
| transfers | 0 | 0 | 0 | 0 | 0 |

## UID attendu

Aucun UID Firebase Authentication fiable n'a pu etre determine: src/firebase.js initialise Firestore et Storage mais aucun module Auth n'est configure, et les donnees auditees ne contiennent pas un ownerUid unique exploitable.

Valeurs ownerUid distinctes detectees: aucune.

## Services d'ecriture

| Flux | Fichier | Collection | Creation | ownerUid ecrit | Mise a jour sure |
| --- | --- | --- | --- | --- | --- |
| scripts/cleanup-demo-data.mjs | scripts/cleanup-demo-data.mjs | transactions | non | non | oui |
| scripts/cleanup-reference-data.mjs | scripts/cleanup-reference-data.mjs | activities, projects, subcategories, thirdParties | non | non | oui |
| scripts/cleanup-test-emulator-data.mjs | scripts/cleanup-test-emulator-data.mjs | accounts, activities, categories, projects, subcategories, thirdParties, transactions | non | non | oui |
| scripts/integration/default-accounts-idempotency-emulator.mjs | scripts/integration/default-accounts-idempotency-emulator.mjs | accounts, transactions | oui | non | oui |
| scripts/integration/default-seed-accounts-cleanup-emulator.mjs | scripts/integration/default-seed-accounts-cleanup-emulator.mjs | accounts, bankImports, budgets, fixedExpenses, objectives, opportunities, recurringIncome, transactions | non | non | oui |
| scripts/integration/duplicate-accounts-cleanup-emulator.mjs | scripts/integration/duplicate-accounts-cleanup-emulator.mjs | accounts, transactions | non | non | oui |
| scripts/integration/fixed-expense-architecture-emulator.mjs | scripts/integration/fixed-expense-architecture-emulator.mjs | fixedExpenses, transactions | oui | non | non |
| scripts/integration/fixed-expense-merge-emulator.mjs | scripts/integration/fixed-expense-merge-emulator.mjs | accounts, categories, fixedExpenses, transactions | oui | non | oui |
| scripts/integration/opportunity-realized-transaction-emulator.mjs | scripts/integration/opportunity-realized-transaction-emulator.mjs | opportunities, transactions | oui | non | non |
| scripts/maintenance/cleanup-default-seed-accounts.mjs | scripts/maintenance/cleanup-default-seed-accounts.mjs | accounts, transactions, transfers | non | non | oui |
| scripts/maintenance/cleanup-duplicate-accounts.mjs | scripts/maintenance/cleanup-duplicate-accounts.mjs | accounts, transactions | non | non | oui |
| scripts/maintenance/cleanup-duplicate-categories.mjs | scripts/maintenance/cleanup-duplicate-categories.mjs | categories | non | non | non |
| scripts/maintenance/cleanup-ux-test-references.mjs | scripts/maintenance/cleanup-ux-test-references.mjs | accounts, activities, categories, projects, subcategories, thirdParties, transactions | non | non | oui |
| scripts/maintenance/merge-duplicate-fixed-expenses.mjs | scripts/maintenance/merge-duplicate-fixed-expenses.mjs | accounts, activities, categories, fixedExpenses, projects, subcategories, thirdParties, transactions | non | non | non |
| scripts/maintenance/verify-mass-classification-controlled.mjs | scripts/maintenance/verify-mass-classification-controlled.mjs | categories, transactions | non | non | non |
| scripts/maintenance/verify-mass-uncategorized-controlled.mjs | scripts/maintenance/verify-mass-uncategorized-controlled.mjs | transactions | non | non | non |
| scripts/validation/audit-owner-uid-compatibility.mjs | scripts/validation/audit-owner-uid-compatibility.mjs | accounts, activities, bankImports, budgets, categories, fixedExpenses, goals, objectives, opportunities, projects, receiptDrafts, recurringIncome, subcategories, thirdParties, transactionDrafts, transactions, transfers | oui | oui | oui |
| src/features/bankingImport/services/bankImportsService.js | src/features/bankingImport/services/bankImportsService.js | bankImports, transactions | oui | non | non |
| src/features/bankingImport/services/importCommitService.js | src/features/bankingImport/services/importCommitService.js | bankImports, transactions, transfers | oui | non | non |
| src/features/transfers/services/transfersService.js | src/features/transfers/services/transfersService.js | transfers | oui | non | non |
| src/services/accountsService.js | src/services/accountsService.js | accounts | oui | non | non |
| src/services/activitiesService.js | src/services/activitiesService.js | activities | oui | non | non |
| src/services/budgetsService.js | src/services/budgetsService.js | budgets | oui | non | non |
| src/services/cashBalanceAdjustmentService.js | src/services/cashBalanceAdjustmentService.js | transactions | oui | non | oui |
| src/services/categoriesService.js | src/services/categoriesService.js | categories | oui | non | non |
| src/services/fixedExpensesService.js | src/services/fixedExpensesService.js | fixedExpenses | oui | non | non |
| src/services/maintenanceService.js | src/services/maintenanceService.js | accounts, bankImports, budgets, categories, fixedExpenses, objectives, recurringIncome, transactionDrafts, transactions | oui | non | non |
| src/services/objectivesService.js | src/services/objectivesService.js | objectives | oui | non | non |
| src/services/opportunitiesService.js | src/services/opportunitiesService.js | opportunities | oui | non | non |
| src/services/opportunityTransactionLink.js | src/services/opportunityTransactionLink.js | opportunities, transactions | oui | non | non |
| src/services/projectsService.js | src/services/projectsService.js | projects | oui | non | non |
| src/services/recurringIncomeService.js | src/services/recurringIncomeService.js | recurringIncome | oui | non | non |
| src/services/subcategoriesService.js | src/services/subcategoriesService.js | subcategories, transactions | oui | non | non |
| src/services/thirdPartiesService.js | src/services/thirdPartiesService.js | thirdParties | oui | non | non |
| src/services/transactionBulkUpdateService.js | src/services/transactionBulkUpdateService.js | transactions | oui | non | non |
| src/services/transactionsService.js | src/services/transactionsService.js | transactions | oui | non | non |

## Tests Emulator

A executer via npm run test:rules; le test couvre les refus anonyme/mauvais UID et les operations ownerUid.

## Bloquants

- CRITIQUE: 391 documents couverts par les rules n'ont pas ownerUid.
- CRITIQUE: 27 flux d'ecriture ne garantissent pas ownerUid.
- IMPORTANT: UID attendu non determine depuis la configuration Auth, la session ou les donnees.

## Plan de correction

- Ne pas deployer les rules tant que les donnees existantes n'ont pas ownerUid valide.
- Determiner le UID Firebase Authentication cible depuis une session Auth reelle ou une source d'identite fiable.
- Preparer un script de migration dry-run qui ne selectionne que les documents sans ownerUid des collections couvertes.
- Ajouter des garde-fous: projectId attendu, sauvegarde obligatoire, confirmation explicite, compteur avant/apres, journal d'execution.
- Tester la migration sur Firestore Emulator avec une copie representative avant toute execution distante.
- Modifier les services de creation pour ecrire ownerUid depuis l'utilisateur authentifie, jamais depuis une saisie utilisateur.
- Modifier les services de mise a jour pour conserver ownerUid et refuser toute mutation de proprietaire.
- Relancer npm run test:rules, npm test et npm run build apres corrections.
- Prevoir rollback par restauration depuis la sauvegarde si une migration future introduit une incoherence.

## Deploiement

NON EFFECTUE

## Conclusion

NOT_READY_FOR_RULES_DEPLOYMENT
