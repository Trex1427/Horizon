# Security

## Architecture Firestore

La configuration Firestore versionnee du projet repose sur trois fichiers racine :

- `firestore.rules` contient les regles de securite.
- `firestore.indexes.json` contient les index declaratifs Firestore.
- `firebase.json` reference explicitement ces deux fichiers et configure l'emulator Firestore.

Les rules appliquent un modele de propriete par document avec le champ `ownerUid`. Les collections metier connues sont autorisees uniquement quand l'utilisateur authentifie lit, cree, met a jour ou supprime ses propres documents. Toute collection non declaree est refusee par defaut.

Collections couvertes :

- `accounts`
- `transactions`
- `categories`
- `subcategories`
- `thirdParties`
- `activities`
- `projects`
- `budgets`
- `goals`
- `objectives`
- `fixedExpenses`
- `recurringIncome`
- `bankImports`
- `receiptDrafts`
- `transactionDrafts`
- `opportunities`
- `transfers`

## Architecture Firebase Auth

Horizon initialise Firebase Auth dans `src/firebase.js` en reutilisant l'application Firebase existante. Le provider retenu est Google via les API modulaires Firebase :

- `getAuth`
- `GoogleAuthProvider`
- `signInWithPopup`
- `signInWithRedirect`
- `getRedirectResult`
- `onAuthStateChanged`
- `signOut`
- `browserLocalPersistence`

La couche React est composee de :

- `src/auth/AuthProvider.jsx` pour exposer `user`, `uid`, `loading`, `isAuthenticated`, `signInWithGoogle`, `logout` et `authError` ;
- `src/auth/useAuth.js` pour consommer le contexte ;
- `src/auth/AuthGate.jsx` pour bloquer l'interface tant que l'etat Auth et l'autorisation ne sont pas connus.

`AuthGate` enveloppe les providers metier afin d'eviter le flash de contenu prive et de retarder les listeners Firestore metier jusqu'a l'utilisateur autorise.

## Allowlist temporaire

La variable `VITE_ALLOWED_FIREBASE_UIDS` contient les UID Firebase autorises, separes par des virgules.

Cette verification frontend est temporaire et ne constitue pas la securite finale. Les Firestore Rules basees sur `ownerUid` devront assurer la protection reelle apres adaptation des services et migration controlee des donnees.

En developpement, si l'allowlist est vide, Horizon permet la connexion et affiche un diagnostic local avec `displayName`, `email` et `uid`. Aucun token n'est affiche ni stocke.

En production, configurer `VITE_ALLOWED_FIREBASE_UIDS` avant tout deploiement Hosting.

## Connexion et deconnexion

La connexion utilise Google. Sur desktop, `signInWithPopup` est tente en premier. Si le popup est bloque ou indisponible, Horizon bascule vers `signInWithRedirect`, ce qui couvre mieux les contextes Android/PWA.

La deconnexion est disponible dans la barre superieure desktop et dans le menu mobile. Apres deconnexion, l'interface financiere est demontee et l'ecran de connexion est affiche.

## Recuperation Auth

Si le proprietaire est bloque :

1. Ne pas deployer les Firestore Rules.
2. Verifier le UID Firebase en environnement de developpement.
3. Corriger `VITE_ALLOWED_FIREBASE_UIDS`.
4. Rebuilder l'application.
5. Valider connexion, rechargement, restauration de session et deconnexion avant tout deploiement Hosting.

Voir aussi `AUTH_SETUP.md`.

## Deploiement

Le deploiement des rules ne doit pas etre automatique pendant les sprints de securisation. Apres validation, utiliser uniquement une commande explicite :

```powershell
firebase deploy --only firestore:rules,firestore:indexes
```

Avant tout deploiement, verifier que les donnees existantes et les chemins d'ecriture applicatifs renseignent bien `ownerUid`. Les rules refuseront les documents sans proprietaire explicite.

## Contrat ownerUid cote services

Les creations Firestore cote application doivent ecrire `ownerUid` depuis `auth.currentUser.uid` via `src/auth/requireCurrentUid.js`. Les payloads de creation et de mise a jour ne doivent jamais accepter `ownerUid`, `createdBy`, `uid`, `userId` ou `ownerId` depuis une saisie utilisateur.

Les scripts Admin qui creent des donnees hors emulator doivent recevoir explicitement `HORIZON_OWNER_UID` avant execution afin de produire des documents compatibles avec les rules. Aucun script de seed ne doit deduire un proprietaire depuis des donnees existantes ou une valeur utilisateur libre.

### Initialisation explicite des comptes

Le montage de `useAccounts` est strictement en lecture et ne declenche aucun seed. Une liste vide, y compris depuis un cache froid ou hors ligne, ne constitue jamais une autorisation d'ecriture.

L'initialisation des cinq comptes par defaut est conservee comme action de service explicite uniquement. Elle verifie la collection avec `getDocsFromServer()`, propage toute erreur reseau ou de permissions et exige `auth.currentUser.uid`. Les documents crees recoivent toujours cet UID via `withOwnerUidForCreate`; un `ownerUid` fourni par l'appelant est ignore.

Voir `ACCOUNTS_INITIALIZATION_ARCHITECTURE.md`.

## Emulator

L'emulator Firestore est configure dans `firebase.json` sur le port `8080`, avec l'interface emulator sur le port `4000`.

Demarrage manuel :

```powershell
npm run emulators:start
```

Execution ponctuelle des tests de rules :

```powershell
npm run test:rules
```

## Dry-run de migration ownerUid

La migration des documents existants vers `ownerUid` est preparee par `scripts/migrations/migrate-owner-uid.mjs`.

Contrat de securite :

- le mode par defaut est toujours `--dry-run` ;
- le UID cible doit etre fourni explicitement via `--owner-uid` ou `MIGRATION_OWNER_UID` ;
- le projet et la base doivent etre fournis explicitement ;
- la source de verite du dry-run est une sauvegarde Firestore locale creee avant analyse ;
- le patch simule et applique en Emulator est strictement `{ ownerUid: <UID> }` ;
- les documents avec `ownerUid` conflictuel ou de type invalide ne sont pas ecrases ;
- `ALLOW_PRODUCTION_APPLY` reste a `false` pendant ce sprint ;
- `--apply` refuse de demarrer sans `FIRESTORE_EMULATOR_HOST` ;
- le rollback `scripts/migrations/rollback-owner-uid.mjs` fonctionne uniquement sur Emulator et ne supprime `ownerUid` que sur les documents listes comme appliques par le rapport de migration.

Commandes explicites :

```powershell
$env:MIGRATION_OWNER_UID="<uid explicite>"
$env:MIGRATION_BACKUP_PATH="C:\Users\alext\budget-alexandre\backups\firestore\<backup>"
npm run audit:owneruid:migration
npm run migrate:owneruid:dry-run
npm run migrate:owneruid:emulator
npm run rollback:owneruid:emulator
```

Aucune commande de ce groupe ne deploie Firestore Rules ou Hosting.

## Tests

Les tests de rules sont dans `scripts/integration/firestore-rules-emulator.mjs`. Ils utilisent exclusivement l'emulator local via `FIRESTORE_EMULATOR_HOST`.

Cas controles :

- lecture autorisee pour un utilisateur connecte proprietaire ;
- lecture refusee pour un utilisateur anonyme ;
- ecriture refusee quand `ownerUid` ne correspond pas a l'utilisateur connecte ;
- suppression refusee hors proprietaire ;
- creation valide ;
- mise a jour valide ;
- mutation de `ownerUid` refusee ;
- collection inexistante refusee.

## Procedure de validation

Avant validation d'un changement de securite :

```powershell
npm run test:rules
npm test
npm run build
```

Verifier ensuite manuellement :

- `firebase.json` reference `firestore.rules` et `firestore.indexes.json` ;
- aucune rule locale indispensable n'est hors depot ;
- aucune donnee Firestore distante n'a ete modifiee ;
- aucun deploiement n'a ete effectue ;
- les collections ajoutees cote application sont ajoutees aux rules et aux tests avant mise en production.

## Secrets et donnees

Ne pas versionner de service account, export Firestore, backup, secret local ou fichier `.env` contenant des valeurs sensibles. Les scripts qui manipulent Firestore doivent rester explicites sur leur cible et privilegier l'emulator pour les validations automatisees.
