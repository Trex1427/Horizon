# Compatibilite des services avec ownerUid

## Resume executif

Sprint realise sans migration, sans deploiement et sans modification de donnees Firestore de production.

Objectif atteint : les flux applicatifs de creation Firestore ecrivent maintenant `ownerUid` depuis l'utilisateur Firebase authentifie, et les flux de mise a jour retirent les champs d'identite proteges avant ecriture.

Backup effectue avant intervention :

- Dossier : `backups/firestore/2026-07-17_11-58-02`
- Collections racine : 14
- Documents sauvegardes : 399
- `accounts` : 10 documents
- `transactions` : 211 documents

## OwnerUid actuel

L'UID autorise est configure localement via Firebase Auth et `VITE_ALLOWED_FIREBASE_UIDS`.

Aucune valeur d'UID n'est recopiee dans ce rapport. Les services utilisent uniquement `auth.currentUser.uid` au moment de l'ecriture.

## Services verifies et corriges

| Domaine | Fichier | Statut |
|---|---|---|
| Transactions | `src/services/transactionsService.js` | Creation avec `ownerUid`, update sans champs proteges |
| Comptes | `src/services/accountsService.js` | Creation et seed par defaut avec `ownerUid`, update assaini |
| Categories | `src/services/categoriesService.js` | Creation et seed avec `ownerUid`, update assaini |
| Sous-categories | `src/services/subcategoriesService.js` | Creation avec `ownerUid`, update whitelist |
| Tiers | `src/services/thirdPartiesService.js` | Creation avec `ownerUid`, update whitelist |
| Activites | `src/services/activitiesService.js` | Creation avec `ownerUid`, update whitelist |
| Projets | `src/services/projectsService.js` | Creation avec `ownerUid`, update whitelist |
| Budgets | `src/services/budgetsService.js` | Creation avec `ownerUid`, update assaini |
| Objectifs | `src/services/objectivesService.js` | Creation avec `ownerUid`, update assaini |
| Frais fixes | `src/services/fixedExpensesService.js` | Creation transactionnelle avec `ownerUid`, update assaini |
| Revenus recurrents | `src/services/recurringIncomeService.js` | Creation avec `ownerUid`, update assaini |
| Opportunites | `src/services/opportunitiesService.js` | Creation avec `ownerUid`, update whitelist |
| Opportunite realisee | `src/services/opportunityTransactionLink.js` | Transaction liee avec `ownerUid`, payload assaini |
| Virements | `src/features/transfers/services/transfersService.js` | Creation avec `ownerUid`, update assaini |
| Import bancaire | `src/features/bankingImport/services/importCommitService.js` | Transactions, virements et journal d'import avec `ownerUid` |
| Ajustement caisse | `src/services/cashBalanceAdjustmentService.js` | Transaction d'ajustement avec `ownerUid` |
| Mises a jour masse | `src/services/transactionBulkUpdateService.js` | Patch assaini avant update batch |

## Helper de securite

Le seed de comptes mentionne ci-dessus n'est plus automatique : `useAccounts` ne fait qu'ecouter la collection. `initializeDefaultAccountsIfEmpty()` reste une action explicite, avec verification serveur obligatoire par `getDocsFromServer()` et refus sans utilisateur authentifie.

Ajout de `src/auth/requireCurrentUid.js` :

- `requireCurrentUid(auth)` refuse toute ecriture si aucun utilisateur Firebase n'est connecte ;
- `sanitizeUserPayload(payload)` retire `ownerUid`, `createdBy`, `uid`, `userId`, `ownerId` ;
- `withOwnerUidForCreate(payload, { auth })` force `ownerUid` depuis `auth.currentUser.uid`.

## Champs proteges

Les champs suivants sont retires des payloads de creation ou de mise a jour quand ils proviennent de l'application ou d'une ligne importee :

- `ownerUid`
- `createdBy`
- `uid`
- `userId`
- `ownerId`

Pour les payloads bruts, les champs systeme suivants peuvent aussi etre retires :

- `id`
- `createdAt`
- `updatedAt`

## Import bancaire

Le commit d'import bancaire exige maintenant un utilisateur Firebase actif. Les documents crees dans `transactions`, `transfers` et `bankImports` portent le meme `ownerUid`.

Les lignes importees sont assainies avant mapping afin qu'un fichier bancaire ne puisse pas injecter un proprietaire.

## OCR ticket

Aucun flux Firestore direct de brouillon OCR n'a ete trouve dans les services modifies. Le parcours OCR produit un brouillon applicatif ; la persistance finale passe par les services transactionnels, maintenant compatibles `ownerUid`.

Les collections `receiptDrafts` et `transactionDrafts` restent couvertes par les Firestore Rules existantes.

## Scripts

| Script | Correction |
|---|---|
| `scripts/seed-test-emulator-data.mjs` | Ajout d'un `ownerUid` de test stable pour les fixtures emulator |
| `scripts/seed-demo-data.mjs` | Creation bloquee sans `HORIZON_OWNER_UID` |
| `scripts/seed-reference-data.mjs` | Creation bloquee sans `HORIZON_OWNER_UID` |
| `scripts/backup-firestore.mjs` | Finalisation de backup rendue robuste aux erreurs Windows `EPERM`/`EBUSY` |

Les scripts de nettoyage, dry-run, audit et verification n'ont pas ete transformes en create flows `ownerUid`, car ils ne creent pas de nouveaux documents metier applicatifs.

## Tests ajoutes ou completes

| Fichier | Couverture |
|---|---|
| `src/auth/requireCurrentUid.test.js` | UID requis, refus anonyme, suppression des champs proteges, creation avec UID courant |
| `src/features/bankingImport/tests/importCommitService.test.js` | Import bancaire ecrit le meme `ownerUid` sur les documents crees |
| `src/services/opportunityTransactionLink.test.js` | Transaction liee avec `ownerUid` et rejet des proprietaires injectes |

## Validation

| Commande | Resultat |
|---|---|
| Backup Firestore | OK, backup local cree avant modifications |
| Tests cibles ownerUid | OK, 23 tests passes |
| `npm test` | OK, 464 tests passes |
| `npm run test:rules` | OK apres escalade locale Firebase CLI ; aucun deploiement |
| `npm run build` | OK |

Notes build :

- warning existant sur un chunk superieur a 500 kB ;
- warnings existants sur imports dynamiques inefficaces ;
- warning existant `node:zlib` externalise pour le navigateur.

## Migration

NON EFFECTUEE.

Aucun document Firestore de production n'a ete modifie. Le sprint prepare uniquement la compatibilite des nouveaux flux d'ecriture.

## Deploiement

NON EFFECTUE.

Aucune commande `firebase deploy` n'a ete lancee.

## Risques residuels

| Risque | Niveau | Commentaire |
|---|---|---|
| Donnees existantes sans `ownerUid` | Eleve | Les rules strictes refuseront ces documents tant qu'une migration controlee n'aura pas ete faite |
| Requetes non filtrees par `ownerUid` | Moyen | Non modifie volontairement dans ce sprint ; les rules filtrent par document, mais la V2 devra aligner les requetes |
| Fixtures integration Admin historiques | Faible | Certaines fixtures emulator hors services app peuvent creer sans `ownerUid`, mais elles ne touchent pas la production |

## Compte rendu

## Firestore Rules

Trouvees et conservees. Aucune modification de rules dans ce sprint.

## Services compatibles

Transactions, comptes, categories, sous-categories, tiers, activites, projets, budgets, objectifs, frais fixes, revenus recurrents, opportunites, import bancaire, virements et ajustements caisse.

## Flux encore incompatibles

Aucun flux applicatif de creation Firestore identifie comme incompatible apres corrections.

## Tests Emulator

OK via `npm run test:rules`.

## Tests Rules

OK.

## npm test

OK, 464 tests passes.

## Build

OK.

## Donnees

0 document de production modifie.

## Migration

NON EFFECTUEE.

## Deploiement

NON EFFECTUE.

## Conclusion

Les services Horizon V1 sont compatibles avec le modele Firestore Rules base sur `ownerUid` pour les nouveaux documents. La prochaine etape reste une migration dry-run puis controlee des documents existants avant de deployer les rules strictes.
