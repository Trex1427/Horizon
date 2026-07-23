# AUDIT HORIZON V1

Date: 2026-07-17  
Mode: audit QA senior, sans correction de code, sans migration, sans écriture Firestore volontaire.

## Résumé exécutif

Horizon V1 est globalement sain côté logique métier pure: la suite de tests est large, les calculs financiers importants sont isolés et l'import bancaire est très couvert. Le risque principal avant V2 n'est pas un manque de fonctionnalités, mais l'accumulation de dette structurelle: plusieurs écrans dépassent 500 lignes, le bundle principal est massif, le routage n'est pas découpé, les règles Firestore ne sont pas présentes dans le dépôt, et certains scripts de validation UX sont déjà désynchronisés du produit.

Le point critique le plus sérieux est l'absence de fichier Firestore Rules versionné ou référencé dans `firebase.json`. Sans règles dans le repo, impossible d'auditer localement la protection réelle des collections. Le second risque est la taille de `Transactions.jsx` avec 3266 lignes: c'est un point de fragilité majeur pour V2, car il concentre import bancaire, OCR, édition, filtres, quick-create, bulk actions et orchestration d'écran.

Commandes exécutées:

- `npm.cmd run build`: succès, build en environ 511 ms.
- `npm.cmd test`: succès, 449 tests passés.
- `npm.cmd run lint`: timeout après 120 s, aucun résultat exploitable.

## Architecture

### Structure générale

La structure est lisible:

- `src/pages`: écrans fonctionnels.
- `src/components`: composants UI transverses.
- `src/hooks`: abonnements et orchestration.
- `src/services`: Firestore, calculs et payloads.
- `src/utils`: transformations et logique pure.
- `src/features/bankingImport` et `src/features/transfers`: domaines plus isolés.
- `functions/src`: Cloud Function OCR ticket.
- `scripts`: seed, maintenance, validation, intégration.

### Composants et fichiers trop gros

Fichiers source hors tests de plus de 500 lignes:

| Fichier | Lignes | Risque |
|---|---:|---|
| `src/pages/Transactions.jsx` | 3266 | Critique: écran central trop large, forte probabilité de régression |
| `src/components/HorizonCockpit.jsx` | 1113 | Important: cockpit difficile à faire évoluer |
| `src/pages/Analyse.jsx` | 811 | Important: logique UI et analyse très imbriquées |
| `src/pages/Referentiels.jsx` | 773 | Important: beaucoup de référentiels dans un seul écran |
| `src/utils/analysisDataUtils.js` | 708 | Important: logique d'analyse dense, duplication de calculs possible |
| `src/components/OpportunityForm.jsx` | 629 | Important: formulaire avec quick-create et validation volumineux |
| `src/components/TransactionBulkEditDialog.jsx` | 594 | Important: bulk edit sensible, composants internes à extraire |
| `src/features/bankingImport/components/ImportValidationStep.jsx` | 585 | Important: validation import encore dense malgré UX améliorée |
| `src/features/bankingImport/components/BankingImportWizard.jsx` | 537 | Important: orchestration d'import trop centralisée |
| `src/pages/Opportunites.jsx` | 506 | Moyen: page proche de la limite |
| `src/App.jsx` | 503 | Moyen: navigation, layout, dashboard et actions globales mélangés |

### Fichiers potentiellement orphelins

Détection par références textuelles:

- `src/components/CardBudget.jsx`: 0 référence détectée. Suspect orphelin.
- `src/components/FinancialDashboard.jsx`: 1 référence détectée, probablement uniquement lui-même ou peu utilisé. À confirmer.
- `src/pages/Dashboard.jsx`: page présente mais `App.jsx` utilise le cockpit directement pour HOME. À vérifier avant suppression.
- `src/assets/firebase.js`, `src/assets/react.svg`, `src/assets/vite.svg`: assets hérités/suspects.

### Duplication et dette de logique

Constats:

- Normalisation de dates et montants répétée dans plusieurs services (`budgetsService`, `recurringIncomeService`, `annualTrajectoryService`, `analysisDataUtils`, `financeCalculations`).
- Les notions `isActive`, `isDeleted`, `deletedAt` ne sont pas uniformes selon les domaines.
- Les calculs trajectoire/analyse/budget utilisent des helpers proches mais séparés.
- Plusieurs validations UX sont des tests source par recherche de chaînes, utiles mais fragiles.

## Firestore

### Collections identifiées

Collections métier visibles dans le code:

- `transactions`
- `accounts`
- `budgets`
- `fixedExpenses`
- `recurringIncome`
- `categories`
- `subcategories`
- `activities`
- `thirdParties`
- `projects`
- `opportunities`
- `objectives`
- `transfers`
- `bankImports`
- `transactionDrafts` mentionnée dans la maintenance, schéma non clairement porté par un service dédié.
- `settings` mentionnée dans la documentation/maintenance, non auditée comme domaine fonctionnel complet.

### Références croisées à contrôler en production

Références principales:

- `transactions.accountId -> accounts`
- `transactions.categoryId -> categories`
- `transactions.subcategoryId -> subcategories`
- `transactions.thirdPartyId -> thirdParties`
- `transactions.activityId -> activities`
- `transactions.projectId -> projects`
- `transactions.fixedExpenseId -> fixedExpenses`
- `transactions.importId/importBatchId -> bankImports`
- `budgets.accountId -> accounts`
- `budgets.categoryId -> categories`
- `fixedExpenses.accountId/categoryId -> accounts/categories`
- `recurringIncome.accountId/categoryId -> accounts/categories`
- `projects.activityId -> activities`
- `transfers.sourceAccountId/destinationAccountId -> accounts`
- `opportunities.accountId/activityId/projectId/thirdPartyId/realizedTransactionId -> référentiels/transactions`

### Risques Firestore

1. Critique: aucun `firestore.rules` ni référence `firestore.rules` dans `firebase.json`. Les règles ne sont donc pas auditables depuis le dépôt.
2. Important: l'audit n'a pas vérifié les données live, conformément à l'interdiction de toucher Firestore. Aucune garantie factuelle ne peut être donnée sur l'absence de références cassées en production.
3. Important: suppression logique non uniforme. Transactions/opportunités utilisent `isDeleted`; référentiels et budgets utilisent `isActive`; sous-catégories peuvent être supprimées physiquement via `deleteDoc`.
4. Important: les abonnements `onSnapshot` lisent parfois toute une collection côté client puis filtrent (`transactions` lit toute la collection et filtre `isDeleted` côté client).
5. Moyen: certaines collections de maintenance (`transactionDrafts`, `settings`) sont mentionnées sans modèle applicatif clair.

## Métier

### Transactions

Points forts:

- Normalisation de type via `normalizeTransactionType`.
- Suppression logique par `isDeleted`.
- Tests nombreux sur filtres, tri, catégorisation, édition, bulk update.

Risques:

- `Transactions.jsx` concentre trop de responsabilités.
- Lecture complète de `transactions` sans requête `where("isDeleted", "!=", true)` ou pagination.
- Préférences de tri en `localStorage`, risque UX multi-appareil.

### Budgets

Points forts:

- Calcul de consommation centralisé avec `calculateBudgetSpentAmount`.
- Filtre `isActive`.

Risques:

- `categoryName` dupliqué avec `categoryId`; si la catégorie est renommée, incohérence d'affichage possible.
- Référence `accountId` optionnelle: bon pour flexibilité, mais nécessite audit de cohérence.

### Prévisions / trajectoire annuelle

Points forts:

- Tests nombreux sur revenus futurs, dépenses fixes, opportunités, soldes négatifs.
- Calcul centralisé dans `annualTrajectoryService`.

Risques:

- Duplication de logique avec `analysisDataUtils`.
- `fallbackAccount` sur "Compte courant" ou premier compte actif: peut masquer une donnée sans `accountId`.

### Objectifs

Points forts:

- CRUD simple et tests UI source partiels.

Risques:

- Schéma moins documenté que transactions/budgets.
- Références `goalId` demandées dans l'audit mais non observées comme domaine fortement structuré dans le code lu.

### Comptes

Points forts:

- Initialisation idempotente de comptes par défaut.
- Scripts et tests de nettoyage des doublons de comptes.

Risques:

- Suppression de comptes par `isActive=false`, mais les transactions liées restent possibles et doivent être auditables.
- Nettoyage de doublons maintenu par scripts séparés, signe d'un risque historique.

### Frais fixes

Points forts:

- Création transactionnelle avec ID stable.
- Détection de doublons et tests dédiés.

Risques:

- Service de fusion/suppression de doublons complexe en maintenance.
- Champ `category` legacy maintenu en parallèle de `categoryName`.

### Revenus récurrents

Points forts:

- Variations de montant testées.
- Calcul séparé de l'occurrence.

Risques:

- Normalisation fréquence `mensuel`/`monthly`/`annuel` répétée.
- Même duplication `category`/`categoryName`.

### Import bancaire

Points forts:

- Domaine bien isolé.
- Tests très nombreux: parsing CSV/PDF, doublons, commit, historique, suggestions.
- Commit batché.

Risques:

- Composants d'import encore volumineux.
- Logs diagnostics `console.info` encore présents dans production.
- Plusieurs parseurs/formats restent placeholders ou non exposés au commit complet.

### Analyse

Points forts:

- Calculs couverts par tests.
- Résolution des catégories invalides visible ("Categorie introuvable").

Risques:

- `Analyse.jsx` et `analysisDataUtils.js` sont denses.
- Calculs potentiellement coûteux côté client sur de gros volumes.

### Cockpit

Points forts:

- Forte couverture source et UX.
- Trajectoire annuelle testée.

Risques:

- `HorizonCockpit.jsx` dépasse 1100 lignes.
- Cockpit chargé dès HOME avec calculs de plusieurs domaines en mémoire.

### OCR Ticket

Points forts:

- Cloud Function avec CORS allowlist, secret OpenAI, limite de taille image, tests d'erreurs.

Risques:

- `console.error` journalise `stack`, `message`, `status`, `code`, potentiellement trop verbeux en production.
- Pas de persistance serveur des brouillons, donc reprise multi-device limitée.

## UX

### Points forts

- Scripts CDP pour desktop/tablette/android existent.
- Navigation mobile dédiée.
- Plusieurs écrans ont déjà reçu des validations contre overflow, textes invalides (`NaN`, `undefined`) et labels manquants.

### Risques UX détectés

1. Les scripts UX publics utilisent des bundle hashes figés (`EXPECTED_BUNDLE`). Ils deviennent faux à chaque build.
2. `banking-import-ux-public-validation.mjs` attend encore `Mapping` et `Preview`, alors que le sprint UX import les a remplacés.
3. Navigation desktop avec beaucoup d'items dans une bottom nav fixe: risque de surcharge.
4. Plusieurs gros écrans restent probablement chargés visuellement: Transactions, Analyse, Référentiels, Cockpit.
5. Paramètres expose des actions "placeholder" d'import/export de sauvegarde.
6. Les diagnostics console visibles peuvent polluer la console utilisateur.

## Performance

### Mesures build

Build Vite:

- Succès.
- 938 modules transformés.
- Temps de build observé: environ 511 ms.
- Bundle principal: `dist/assets/index-DG89eQx8.js`, 1 601 244 octets.
- Gzip annoncé: environ 459.28 kB.
- CSS principal: 1.99 kB.
- Workbox généré, 15 entrées précachées, environ 1587.37 KiB.

### Warnings build

- `node:zlib` externalisé pour compatibilité navigateur, importé par `src/features/bankingImport/parsers/pdfParser.js`.
- Imports dynamiques inefficaces: `firebase/firestore` et `src/firebase.js` sont importés dynamiquement et statiquement.
- Chunk principal supérieur à 500 kB.

### Risques performance

1. Critique V2: absence de lazy loading par page, tout part dans un gros chunk principal.
2. Important: Firestore et Firebase sont statiquement présents dans le bundle principal.
3. Important: Transactions charge toute la collection côté client.
4. Important: calculs Analyse/Cockpit probablement recalculés côté client sur gros volumes.
5. Moyen: scripts UX de performance mesurent surtout la présence du bundle, pas les temps métier demandés.

Temps demandés mais non mesurés automatiquement dans cet audit:

- premier affichage réel;
- ouverture transactions;
- import;
- cockpit;
- analyse.

Raison: pas de lancement navigateur interactif ni de scénario live Firestore afin de rester dans un audit sans données et sans écriture.

## PWA

Points forts:

- `vite-plugin-pwa` configuré.
- `registerType: "autoUpdate"`.
- Manifest présent.
- Workbox génère un service worker.
- Icônes 192/512 présentes.

Risques:

- Pas d'UX explicite de mise à jour disponible/hors-ligne.
- Pas de tests automatisés PWA offline/install/refresh Android identifiés.
- Cache Workbox large sur assets; stratégie runtime non explicitée.
- Refresh Android non validé pendant cet audit.

## Sécurité

### Points forts

- Secret `OPENAI_API_KEY` côté Cloud Functions via `defineSecret`.
- CORS OCR restreint à localhost et domaines Firebase.
- Taille image OCR limitée.
- Scripts de maintenance destructifs ont plusieurs garde-fous et dry-run.

### Risques

1. Critique: règles Firestore absentes du dépôt et non référencées par `firebase.json`.
2. Important: aucun fichier `storage.rules` versionné détecté alors que `getStorage(app)` est initialisé.
3. Important: configuration Firebase client requise via variables Vite; c'est normal pour Firebase, mais l'absence de règles auditables rend le contrôle incomplet.
4. Moyen: logs OCR et import bancaire détaillés en production.
5. Moyen: scripts de maintenance production nombreux; bien gardés, mais ils augmentent la surface d'erreur opérationnelle.

## Tests

### Résultats

- `npm.cmd test`: 449 tests passés.
- 90 fichiers de tests détectés dans `src`, `functions`, `scripts`.
- `npm.cmd run build`: succès.
- `npm.cmd run lint`: timeout après 120 s.

### Zones bien couvertes

- Import bancaire: parsing, doublons, commit, PDF, suggestions.
- Calculs financiers: budgets, soldes, trajectoire, analyse.
- OCR ticket: erreurs HTTP, CORS, validation extraction.
- Maintenance: nettoyage comptes, frais fixes, seeds.
- Référentiels: normalisation payloads, sous-catégories, tiers.
- Transactions: tri, filtres, bulk update, classification.

### Zones peu couvertes ou fragiles

- Firestore Rules: non testables dans le repo.
- PWA offline/install/update: pas de test dédié identifié.
- Tests UX publics avec bundle hash figé et textes obsolètes.
- Lint non exploitable car timeout.
- Tests source par `content.includes(...)`: rapides, mais fragiles aux changements de wording.

## Dette technique

| Priorité | Sujet | Impact | Effort | Risque |
|---|---|---:|---:|---|
| P0 | Versionner et auditer Firestore Rules | Très élevé | Moyen | Perte/exposition données |
| P0 | Découper `Transactions.jsx` | Très élevé | Élevé | Régressions V2 |
| P0 | Mettre en place lazy loading par page | Élevé | Moyen | Performance mobile |
| P0 | Désynchronisation tests UX publics | Élevé | Faible | Faux positifs/faux négatifs QA |
| P1 | Uniformiser suppression logique | Élevé | Moyen | Références cassées |
| P1 | Extraire `HorizonCockpit.jsx` | Élevé | Moyen | Maintenance difficile |
| P1 | Extraire `Analyse.jsx` et `analysisDataUtils.js` | Élevé | Élevé | Calculs incohérents |
| P1 | Supprimer/archiver composants orphelins | Moyen | Faible | Bruit maintenance |
| P1 | Remplacer bundle hash figé dans scripts UX | Moyen | Faible | Validation cassée |
| P1 | Ajouter tests PWA/offline/update | Moyen | Moyen | UX Android |
| P2 | Réduire logs production | Moyen | Faible | Confidentialité/bruit |
| P2 | Centraliser date/montant/fréquence | Moyen | Moyen | Incohérences métier |
| P2 | Ajouter audit read-only références Firestore | Élevé | Moyen | Données orphelines |
| P2 | Stabiliser lint | Moyen | Faible | Dette invisible |
| P2 | Documenter schémas `settings`/`transactionDrafts` | Moyen | Faible | Maintenance |

## Top 20 des améliorations V2

| Rang | Amélioration | Impact utilisateur | Facilité | ROI |
|---:|---|---:|---:|---:|
| 1 | Ajouter et tester Firestore Rules dans le repo | Très élevé | Moyen | Très élevé |
| 2 | Découper `Transactions.jsx` en modules | Très élevé | Moyen | Très élevé |
| 3 | Lazy loading des pages principales | Élevé | Moyen | Très élevé |
| 4 | Audit read-only des références cassées Firestore | Élevé | Moyen | Très élevé |
| 5 | Corriger les scripts UX à bundle dynamique | Moyen | Facile | Élevé |
| 6 | Extraire cockpit en sous-composants | Élevé | Moyen | Élevé |
| 7 | Extraire analyse en sections et services purs | Élevé | Difficile | Élevé |
| 8 | Standardiser `isActive`/`isDeleted`/`deletedAt` | Élevé | Moyen | Élevé |
| 9 | Ajouter tests PWA offline/update Android | Moyen | Moyen | Élevé |
| 10 | Ajouter mesures perf automatisées par page | Élevé | Moyen | Élevé |
| 11 | Paginer/filtrer les transactions côté requête | Élevé | Moyen | Élevé |
| 12 | Centraliser helpers date/montant/fréquence | Moyen | Moyen | Moyen |
| 13 | Réduire logs diagnostics en production | Moyen | Facile | Moyen |
| 14 | Documenter schéma de chaque collection | Moyen | Facile | Moyen |
| 15 | Nettoyer composants orphelins | Faible | Facile | Moyen |
| 16 | Remplacer tests source fragiles par tests composants | Moyen | Moyen | Moyen |
| 17 | Ajouter reporting CI sur `npm test/build/lint` | Moyen | Moyen | Moyen |
| 18 | Clarifier placeholders Paramètres | Moyen | Facile | Moyen |
| 19 | Introduire boundaries de domaine pour import/OCR | Moyen | Moyen | Moyen |
| 20 | Ajouter stratégie PWA runtime cache explicite | Moyen | Moyen | Moyen |

## Conclusion

Horizon V1 est exploitable et plutôt robuste sur les calculs et l'import bancaire. La V2 doit commencer par sécuriser et simplifier l'existant: règles Firestore versionnées, découpage des très gros écrans, lazy loading, tests UX maintenus, audit de références read-only. Le produit a une bonne base; le danger principal est de continuer à ajouter des capacités sur des écrans et scripts déjà trop concentrés.

## Compte rendu

### Nombre de problèmes détectés

27 problèmes ou risques distincts.

### Problèmes critiques

4:

- Firestore Rules absentes du dépôt.
- `Transactions.jsx` trop massif.
- Pas de lazy loading avec bundle principal très volumineux.
- Tests UX publics désynchronisés du produit et du bundle actuel.

### Problèmes importants

15:

- Gros fichiers Cockpit, Analyse, Référentiels, ImportValidation, BankingImportWizard.
- Lecture client large de `transactions`.
- Suppression logique non uniforme.
- Références live non auditées sans script read-only dédié.
- PWA offline/update non testée.
- Lint inutilisable dans le délai d'audit.
- Duplication dates/montants/fréquences.
- Logs diagnostics production.
- Placeholders Paramètres.
- Composants/fichiers suspects orphelins.
- Build warnings `node:zlib`.
- Imports dynamiques inefficaces Firebase.
- Tests source fragiles.
- Collections `settings`/`transactionDrafts` peu documentées.
- Scripts destructifs nombreux même s'ils sont gardés.

### Problèmes mineurs

8:

- Assets Vite/React hérités suspects.
- Navigation desktop chargée.
- Préférences locales non synchronisées.
- Labels encodés dégradés visibles dans certains fichiers lus via console.
- Scripts UX attendent des textes techniques obsolètes.
- `public/manifest.webmanifest` duplique la config PWA générée.
- Absence de mesure automatisée de temps import/cockpit/analyse.
- CSS très léger mais UI majoritairement portée par composants MUI, rendant les audits visuels dépendants du rendu.

### Dette technique

Dette principale: concentration de responsabilités dans quelques fichiers, absence de rules versionnées, outillage QA partiellement désynchronisé, performance mobile menacée par le bundle unique.

### Priorités recommandées

1. Versionner Firestore Rules et ajouter tests rules/emulator.
2. Découper `Transactions.jsx`.
3. Mettre en place lazy loading par page.
4. Réparer les scripts UX publics.
5. Créer un audit read-only de références Firestore.

### État général de Horizon

État général: bon socle V1, prêt pour une V2 à condition de traiter d'abord sécurité, architecture et performance. Ne pas ajouter de gros domaines avant ce nettoyage.
