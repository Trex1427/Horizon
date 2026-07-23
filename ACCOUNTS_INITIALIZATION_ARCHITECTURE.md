# Initialisation des comptes

## Principe

`useAccounts` est strictement passif vis-a-vis de Firestore : son montage ouvre un listener et expose les donnees, le chargement, les erreurs et les operations CRUD explicites. Un snapshot vide signifie uniquement qu'aucun compte n'est actuellement visible. Il ne declenche aucune ecriture.

Le seed automatique a ete supprime parce qu'un snapshot ou un `getDocs()` cache-compatible peut etre vide lorsque le cache local est froid, incomplet ou hors ligne, alors que des comptes existent sur le serveur. Utiliser cet etat pour creer des documents recréait les cinq comptes `default-*` a cote des comptes canoniques.

## Initialisation explicite

`initializeDefaultAccountsIfEmpty()` dans `src/services/accountsService.js` est conservee uniquement pour une action volontaire d'onboarding ou d'administration. Aucun composant ni hook ne l'appelle automatiquement.

Cette action :

- exige un utilisateur Firebase authentifie via `withOwnerUidForCreate` ;
- ignore tout `ownerUid` fourni par l'appelant et utilise l'UID Auth ;
- verifie l'existence des comptes avec `getDocsFromServer()` ;
- refuse implicitement l'operation si le serveur est indisponible ou refuse la lecture ;
- ne cree rien lorsqu'au moins un compte existe ;
- utilise cinq IDs deterministes et un batch atomique.

## Comportement hors ligne

Le listener peut afficher les comptes deja presents dans le cache. Un cache vide peut afficher une liste vide. Dans les deux cas, le montage n'ecrit rien. Une initialisation explicite hors ligne echoue lors de la lecture serveur et ne doit jamais convertir cette erreur en « collection vide ».

## Non-regression

Le test `src/hooks/useAccounts.architecture.test.js` interdit :

- l'import ou l'appel du seed depuis `useAccounts` ;
- une creation par defaut dans le hook ;
- le retour de `hasAnyAccountDocuments()` a `getDocs()` ;
- l'interception d'une erreur serveur comme si la collection etait vide.

Le scenario Emulator `npm run test:accounts-emulator` valide l'idempotence de l'action explicite. Les tests du hook garantissent que cache froid, mode hors ligne, montage multiple et StrictMode produisent zero ecriture de compte.
