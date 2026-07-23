# Sprint Firebase Auth

## Sauvegarde Firestore

Sauvegarde executee avant modification :

- Resultat: succes
- Chemin: `C:\Users\alext\budget-alexandre\backups\firestore\2026-07-17_11-28-46`
- Collections racine: 14
- Documents totaux: 394
- `accounts`: 5 documents
- `transactions`: 211 documents

Cette sauvegarde ne constitue pas une autorisation de migration.

## Etat Firebase initial

- `src/firebase.js` initialisait Firebase App, Firestore et Storage.
- Firebase Auth n'etait pas initialise.
- `src/main.jsx` rendait directement `App`.
- `src/App.jsx` montait `TransactionsProvider` directement, ce qui permettait aux listeners metier de demarrer au montage de l'application.
- La configuration Firebase etait chargee via variables Vite.
- Aucun mecanisme de session utilisateur n'etait present.

## Implementation

Provider retenu : Google avec Firebase Auth modulaire.

Fichiers crees :

- `src/auth/AuthProvider.jsx`
- `src/auth/useAuth.js`
- `src/auth/AuthGate.jsx`
- `src/auth/authConfig.js`
- `src/auth/authConfig.test.js`
- `src/auth/authArchitecture.source.test.js`
- `.env.example`
- `AUTH_SETUP.md`

Fichiers modifies :

- `src/firebase.js`
- `src/App.jsx`
- `.gitignore`
- `SECURITY.md`

## AuthProvider

`AuthProvider` expose :

- `user`
- `uid`
- `loading`
- `signingIn`
- `isAuthenticated`
- `isAuthorized`
- `signInWithGoogle`
- `logout`
- `authError`

Il gere :

- `onAuthStateChanged`
- `getRedirectResult`
- `signInWithPopup`
- fallback `signInWithRedirect`
- `signOut`
- nettoyage du listener au demontage.

## AuthGate

`AuthGate` bloque l'application tant que l'etat Auth n'est pas resolu ou que l'utilisateur n'est pas autorise.

`TransactionsProvider` est maintenant monte uniquement derriere `AuthGate`.

## Allowlist UID

Variable ajoutee :

```env
VITE_ALLOWED_FIREBASE_UIDS=
```

En developpement, si la variable est vide, l'utilisateur connecte est autorise et un diagnostic local affiche `displayName`, `email` et `uid`. Aucun token n'est affiche ou stocke.

En production, l'allowlist doit etre configuree avant tout deploiement Hosting.

## Configuration Firebase Console

Action manuelle requise : l'activation Google Sign-In n'a pas pu etre verifiee automatiquement.

Etapes documentees dans `AUTH_SETUP.md` :

- activer Authentication ;
- activer Google ;
- configurer l'e-mail support ;
- verifier les domaines autorises `localhost`, `budget-alexandre.web.app`, `budget-alexandre.firebaseapp.com`.

## Validations

- `npm test`: succes, 458 tests passes.
- `npm run build`: succes.

Warnings build existants :

- chunk principal superieur a 500 kB ;
- imports dynamiques Firestore inefficaces ;
- `node:zlib` externalise pour compatibilite navigateur.

## Restrictions respectees

- Firestore production modifie: non.
- Migration ownerUid: non effectuee.
- Deploiement Firestore Rules: non effectue.
- Deploiement Hosting: non effectue.
- Aucun `ownerUid` injecte dans les services metier.

## Prochaine etape

La prochaine etape devra etre :

- adaptation des services a `ownerUid` ;
- tests Emulator ;
- migration controlee des donnees ;
- deploiement des rules apres validation complete.
