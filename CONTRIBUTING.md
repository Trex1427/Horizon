# Contribuer à Horizon

## Principes Git

La branche `main` est toujours stable et déployable. Aucun développement ne doit
être effectué directement sur `main`.

Chaque sprint utilise une branche dédiée, nommée selon la nature du changement :

- `feat/` : nouvelle fonctionnalité ;
- `fix/` : correction ;
- `refactor/` : restructuration sans changement fonctionnel ;
- `chore/` : maintenance technique ou outillage ;
- `docs/` : documentation.

Une branche doit contenir une seule évolution cohérente.

## Cycle d'un sprint

1. Mettre `main` à jour.
2. Créer une branche depuis `main`.
3. Effectuer une seule évolution cohérente.
4. Lancer les tests et le build.
5. Créer un commit.
6. Pousser la branche.
7. Ouvrir une Pull Request.
8. Fusionner après validation.
9. Supprimer la branche devenue inutile.

## Convention de commits

Utiliser un message court, précis et préfixé :

- `feat:` : nouvelle fonctionnalité ;
- `fix:` : correction ;
- `refactor:` : refactorisation ;
- `chore:` : maintenance ou outillage ;
- `docs:` : documentation ;
- `test:` : ajout ou correction de tests.

Exemple :

```text
chore: documenter le workflow Git
```

## Firestore et sécurité des données

Une sauvegarde Firestore est obligatoire avant :

- une migration ;
- un script de maintenance ;
- une modification risquée des données ;
- un gros sprint métier.

Les tests destructifs doivent utiliser Firestore Emulator ou un environnement
Firebase séparé. Ils ne doivent jamais employer la base de production comme
environnement de test.

## Validation avant fusion

La validation minimale comprend :

- les tests automatisés avec `npm test` ;
- le build Vite avec `npm run build` ;
- une vérification fonctionnelle ciblée sur le périmètre du sprint.

Exécuter également les suites spécialisées pertinentes, notamment
`npm run test:rules` lorsqu'un changement concerne Firestore.

## Fichiers interdits dans Git

Ne jamais committer :

- les fichiers `.env` et leurs variantes contenant des secrets ;
- les clés Firebase Admin ;
- les comptes de service ;
- les sauvegardes Firestore ;
- les captures et artefacts temporaires.

Avant chaque commit, contrôler les fichiers préparés avec `git status` et
`git diff --staged`.

## Versionnage et changelog

Horizon suit Semantic Versioning (`MAJOR.MINOR.PATCH`) avec des préversions
comme `v1.0.0-beta.1` et `v1.0.0-rc.1`.

Tout changement visible par l'utilisateur doit mettre à jour la section
`Non publié` de `CHANGELOG.md`. La procédure complète est décrite dans
`docs/VERSIONING.md`.

Un tag de version ne doit jamais être créé depuis une branche autre que `main`.
Il est créé uniquement après validation et fusion de la Pull Request de release,
puis réussite des tests et du build sur `main` à jour.
