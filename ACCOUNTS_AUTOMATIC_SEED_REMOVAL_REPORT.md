# Rapport de sprint — suppression du seed automatique des comptes

## Sauvegarde Firestore

- Statut : succes
- Chemin : `C:\Users\alext\budget-alexandre\backups\firestore\2026-07-21_19-11-25`
- projectId : `budget-alexandre`
- databaseId : `(default)`
- Collections racine : 14
- Documents : 404
- Comptes : 10
- Transactions : 215
- IDs accounts : `0avb84dmhKodiC7OxZ5p`, `Rk8aRhNrov5Yc4hW7ndu`, `WDhjgHcNqiCkSPQz9U5S`, `WeNZaVlY4BCsudxSSxhP`, `default-cash`, `default-current-account`, `default-paypal`, `default-professional-account`, `default-savings-a`, `g7fftTkK60S66pTnBHaq`

## Architecture corrigee

`useAccounts` n'appelle plus aucune fonction de seed. Un snapshot vide met simplement `accounts` a `[]` et termine le chargement. L'action explicite `initializeDefaultAccountsIfEmpty()` est conservee dans le service, mais son controle d'existence utilise exclusivement `getDocsFromServer()` et propage les erreurs.

Les IDs restent deterministes, le commit reste atomique et `withOwnerUidForCreate` impose l'UID Firebase courant en ignorant les champs d'identite fournis par l'appelant.

## Validations

- Tests cibles : 18/18 passes apres ajout du contrat serveur.
- `npm test` : 478 tests passes, 0 echec.
- `npm run test:accounts-emulator` : succes ; cinq comptes canoniques conserves apres montages repetes, aucun `default-*`, action explicite idempotente et appels concurrents limites a cinq documents.
- `npm run test:rules` : succes sur Emulator uniquement.
- `npm run build` : succes ; avertissements existants sur la taille du chunk, les imports dynamiques et `node:zlib`.

Aucun nettoyage, aucune migration et aucun deploiement ne font partie de ce changement. Aucun document Firestore de production n'a ete ecrit ou supprime.
