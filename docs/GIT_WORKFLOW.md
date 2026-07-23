# Workflow Git pratique pour Horizon

Ce guide utilise PowerShell et suppose que le dépôt se trouve dans
`C:\Users\alext\budget-alexandre`.

## Démarrer un sprint

Se placer dans le dépôt, revenir sur `main`, puis récupérer sa dernière version :

```powershell
Set-Location 'C:\Users\alext\budget-alexandre'
git switch main
git pull --ff-only origin main
```

`--ff-only` évite de créer automatiquement un commit de fusion inattendu sur
`main`.

## Créer une branche

Choisir un préfixe adapté et un nom court :

```powershell
git switch -c 'chore/git-workflow'
```

Autres exemples Horizon :

```powershell
git switch -c 'feat/forecast-export'
git switch -c 'fix/account-balance-display'
git switch -c 'docs/firestore-runbook'
```

Vérifier la branche active :

```powershell
git branch --show-current
```

## Voir les changements

Afficher l'état synthétique et le détail des modifications :

```powershell
git status --short
git diff
```

Voir uniquement les noms de fichiers modifiés :

```powershell
git diff --name-only
```

## Ajouter les fichiers

Préparer des fichiers précis plutôt que tout le dépôt :

```powershell
git add CONTRIBUTING.md
git add .github/pull_request_template.md
git add .github/ISSUE_TEMPLATE
git add docs/GIT_WORKFLOW.md
```

Contrôler ce qui sera committé :

```powershell
git diff --staged
git status --short
```

## Créer un commit

Utiliser la convention de commits du projet :

```powershell
git commit -m 'chore: mettre en place le workflow Git'
```

Un commit doit représenter une évolution cohérente.

## Pousser la branche

Lors du premier push, associer la branche locale à la branche distante :

```powershell
git push -u origin chore/git-workflow
```

Les fois suivantes :

```powershell
git push
```

Ouvrir ensuite une Pull Request vers `main`.

## Récupérer les changements de `main`

Depuis la branche de travail :

```powershell
git fetch origin
git rebase origin/main
```

Relancer les tests après le rebase, puis pousser :

```powershell
npm test
npm run build
git push --force-with-lease
```

`--force-with-lease` protège les changements distants qui ne seraient pas
présents localement. Ne jamais utiliser un push forcé sur `main`.

## Résoudre le cas simple d'une branche en retard

Si la branche n'a pas de changements locaux non commités :

```powershell
git status --short
git fetch origin
git rebase origin/main
```

En cas de conflit, Git indique les fichiers concernés. Corriger chaque fichier,
puis continuer :

```powershell
git add chemin/du/fichier-corrige
git rebase --continue
```

Répéter jusqu'à la fin, exécuter les validations, puis :

```powershell
git push --force-with-lease
```

## Revenir sur une modification non commitée

Inspecter d'abord la modification :

```powershell
git diff -- chemin/du/fichier
```

Puis restaurer uniquement le fichier voulu :

```powershell
git restore -- chemin/du/fichier
```

Cette opération supprime les modifications locales non commitées du fichier.
Ne pas l'exécuter si elles doivent être conservées.

Pour retirer un fichier de la zone de préparation sans effacer son contenu :

```powershell
git restore --staged -- chemin/du/fichier
```

## Annuler un commit déjà partagé

Ne pas réécrire l'historique partagé. Créer un commit inverse avec `git revert` :

```powershell
git log --oneline -10
git revert <identifiant-du-commit>
git push
```

Exemple :

```powershell
git revert a1b2c3d
```

## Créer un tag de version

Créer un tag annoté uniquement depuis une version validée de `main` :

```powershell
git switch main
git pull --ff-only origin main
npm test
npm run build
git tag -a 'v1.0.0-beta.1' -m 'Horizon v1.0.0-beta.1'
```

Pousser ensuite le tag explicitement :

```powershell
git push origin 'v1.0.0-beta.1'
```

Afficher les tags et inspecter une version :

```powershell
git tag --list
git show 'v1.0.0-beta.1'
```

Si un tag local vient d'être créé par erreur et n'a jamais été publié, le
supprimer localement :

```powershell
git tag --delete 'v1.0.0-beta.1'
```

Vérifier auparavant qu'il n'existe pas sur le remote :

```powershell
git ls-remote --tags origin 'refs/tags/v1.0.0-beta.1'
```

Ne jamais supprimer, déplacer ou recréer silencieusement un tag déjà publié.
Publier une nouvelle version corrective afin de préserver la traçabilité.

## Créer un correctif depuis `main`

Partir de la version stable la plus récente :

```powershell
git switch main
git pull --ff-only origin main
git switch -c 'fix/v1.0.1-correction-transactions'
```

Après la correction et la mise à jour du changelog :

```powershell
npm test
npm run build
git diff --check
git add chemin/du/fichier-corrige CHANGELOG.md
git commit -m 'fix: corriger le problème de transactions'
git push -u origin fix/v1.0.1-correction-transactions
```

Ouvrir une Pull Request vers `main`. Le nouveau tag est créé seulement après sa
fusion et la validation du build sur `main`.

## Afficher l'historique

Historique compact avec les branches et tags :

```powershell
git log --oneline --graph --decorate --all -20
```

Historique d'un fichier précis :

```powershell
git log --oneline -- docs/GIT_WORKFLOW.md
```

## Validation avant Pull Request

Pour un sprint applicatif Horizon, exécuter au minimum :

```powershell
npm test
npm run build
```

Pour un changement Firestore Rules :

```powershell
npm run test:rules
```

Terminer par une vérification fonctionnelle ciblée, puis contrôler une dernière
fois les fichiers préparés :

```powershell
git diff --check
git status --short
git diff --staged
```
