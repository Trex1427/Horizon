# Firebase Auth Setup

## Objectif

Horizon utilise Firebase Authentication avec le provider Google pour obtenir un UID stable. Cet UID servira ensuite a preparer l'ajout de `ownerUid` dans les documents Firestore.

Aucune migration Firestore et aucun deploiement de rules ne doivent etre faits pendant cette etape.

## Configuration Firebase Console

Codex ne peut pas confirmer automatiquement que Google Sign-In est active dans Firebase Console. Verification manuelle requise :

1. Ouvrir Firebase Console.
2. Selectionner le projet `budget-alexandre`.
3. Aller dans Authentication.
4. Cliquer sur Commencer si necessaire.
5. Ouvrir Sign-in method.
6. Activer Google.
7. Choisir l'adresse e-mail de support.
8. Enregistrer.
9. Verifier les domaines autorises :
   - `localhost`
   - `budget-alexandre.web.app`
   - `budget-alexandre.firebaseapp.com`

## Variables d'environnement

Ajouter l'allowlist dans les fichiers d'environnement locaux ou dans la configuration Hosting :

```env
VITE_ALLOWED_FIREBASE_UIDS=uid1,uid2
```

Ne jamais versionner le fichier `.env` reel. `.env.example` contient uniquement des placeholders.

En developpement, si `VITE_ALLOWED_FIREBASE_UIDS` est vide, Horizon autorise la connexion et affiche un diagnostic local avec `displayName`, `email` et `uid`. Ce diagnostic sert a relever le UID cible. Aucun token n'est affiche ni stocke.

En production, configurer `VITE_ALLOWED_FIREBASE_UIDS` avant tout deploiement Hosting pour eviter un blocage ou un acces non desire.

## Parcours de validation

Desktop :

- connexion Google ;
- rechargement de page ;
- session restauree ;
- deconnexion ;
- compte non autorise bloque.

Tablette :

- bouton visible ;
- pas d'overflow ;
- session restauree.

Android/PWA :

- connexion Google ;
- fallback redirect si popup bloquee ;
- retour correct dans la PWA ;
- rechargement sans perte de session ;
- deconnexion correcte.

## Recuperation en cas de blocage

Si le proprietaire est bloque :

1. Ne pas deployer les Firestore Rules.
2. Verifier le UID affiche en developpement.
3. Corriger `VITE_ALLOWED_FIREBASE_UIDS`.
4. Reconstruire l'application.
5. Valider localement avant tout deploiement Hosting.

## Etape suivante

Apres identification du UID cible :

1. Adapter les services d'ecriture pour ajouter `ownerUid` depuis Firebase Auth.
2. Tester en Emulator.
3. Preparer une migration controlee des documents existants.
4. Deployer les Firestore Rules uniquement apres validation complete.
