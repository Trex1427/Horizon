# Versionnage et publication de Horizon

Horizon utilise Semantic Versioning et reste en préversion jusqu'à la
publication de `v1.0.0`.

## Semantic Versioning

Une version suit le format `MAJOR.MINOR.PATCH` :

- `MAJOR` augmente lors d'un changement incompatible ou d'une refonte
  importante ;
- `MINOR` augmente lors d'une nouvelle fonctionnalité rétrocompatible ;
- `PATCH` augmente lors d'une correction rétrocompatible.

Exemples :

- `1.0.0` vers `2.0.0` : rupture de compatibilité ;
- `1.0.0` vers `1.1.0` : nouvelle fonctionnalité compatible ;
- `1.0.0` vers `1.0.1` : correction de bug compatible.

Tant que Horizon est en bêta, les préversions permettent de stabiliser la
première version publique sans prétendre qu'elle est définitive.

## Bêta, release candidate et version stable

- `v1.0.0-beta.1` désigne une version fonctionnelle encore susceptible de
  recevoir des changements et des corrections importants.
- `v1.0.0-beta.2` désigne l'itération bêta suivante.
- `v1.0.0-rc.1` est une release candidate : le périmètre fonctionnel est figé
  et seuls les défauts bloquants doivent encore être corrigés.
- `v1.0.0` est la version stable validée.

Une nouvelle préversion incrémente son suffixe : `beta.1`, `beta.2`, puis
`rc.1`, `rc.2`. Le passage à la version stable retire le suffixe.

## Tags Git et Releases GitHub

Les tags sont annotés et commencent par `v` :

```text
v1.0.0-beta.1
v1.0.0-beta.2
v1.0.0-rc.1
v1.0.0
v1.0.1
```

Un tag de version est créé uniquement depuis `main`, après validation de la
Pull Request, des tests et du build.

Le titre d'une Release GitHub suit la convention :

```text
Horizon v1.0.0-beta.1
```

Une préversion GitHub doit être marquée « pre-release ». Une version stable ne
doit pas porter ce marqueur.

## Procédure complète d'une release

L'ordre de publication est toujours le suivant :

1. fusionner toutes les Pull Requests prévues ;
2. mettre `main` à jour ;
3. lancer les tests ;
4. lancer le build ;
5. finaliser le changelog ;
6. créer le commit de release ;
7. créer un tag annoté ;
8. pousser `main` et le tag ;
9. créer la Release GitHub ;
10. vérifier la version déployée.

Le tag n'est jamais créé avant la fusion de la Pull Request de release et la
validation de `main`.

## Préparer une version

1. Fusionner toutes les Pull Requests prévues.
2. Mettre `main` à jour.
3. Créer une branche de préparation de release.
4. Lancer les tests.
5. Lancer le build.
6. Finaliser `CHANGELOG.md` sans date fictive.
7. Faire relire la Pull Request de release.

Commandes PowerShell :

```powershell
Set-Location 'C:\Users\alext\budget-alexandre'
git switch main
git pull --ff-only origin main
git switch -c 'chore/release-v1.0.0-beta.1'
npm test
npm run build
git status --short
git diff --check
```

Déplacer les éléments concernés de `Non publié` vers la section de version,
remplacer « date à compléter lors de la release » par la date réelle du jour de
publication, puis préparer le commit :

```powershell
git add CHANGELOG.md
git commit -m 'chore: préparer la release v1.0.0-beta.1'
git push -u origin chore/release-v1.0.0-beta.1
```

Ouvrir ensuite une Pull Request vers `main`. Les commandes de commit et de push
ne doivent être exécutées qu'après revue explicite des changements.

## Publier une version

Après validation et fusion de la Pull Request de release :

```powershell
git switch main
git pull --ff-only origin main
npm test
npm run build
git tag -a 'v1.0.0-beta.1' -m 'Horizon v1.0.0-beta.1'
git push origin main
git push origin 'v1.0.0-beta.1'
```

Créer ensuite la Release GitHub à partir du tag :

```powershell
gh release create 'v1.0.0-beta.1' --title 'Horizon v1.0.0-beta.1' --generate-notes --prerelease
```

Pour une version stable, omettre `--prerelease` :

```powershell
gh release create 'v1.0.0' --title 'Horizon v1.0.0' --generate-notes
```

Enfin, vérifier la version déployée et les parcours fonctionnels ciblés.

## Releases impliquant des données

Avant une release qui comporte une migration ou une modification de données :

1. créer une sauvegarde Firestore ;
2. valider la migration sur Firestore Emulator ou un environnement Firebase
   séparé ;
3. documenter les compteurs et invariants avant/après ;
4. préparer et tester une procédure de rollback ;
5. n'appliquer la migration en production qu'avec les garde-fous validés.

Commande de sauvegarde Horizon :

```powershell
npm run backup:firestore
```

Le rollback doit préciser la sauvegarde utilisée, les documents ciblés, les
contrôles de projet et de base, ainsi que la validation après restauration. Il
ne doit jamais être improvisé directement sur les données de production.

## Corriger une version publiée

Créer le correctif depuis `main` à jour :

```powershell
git switch main
git pull --ff-only origin main
git switch -c 'fix/v1.0.1-correction-transactions'
```

Après la correction :

```powershell
npm test
npm run build
git diff --check
git add chemin/du/fichier-corrige CHANGELOG.md
git commit -m 'fix: corriger le problème de transactions'
git push -u origin fix/v1.0.1-correction-transactions
```

Ouvrir une Pull Request. Après fusion, suivre la procédure de publication avec
le nouveau tag `v1.0.1`. Ne jamais déplacer le tag de la version précédente.

## Annuler une mauvaise release

Ne jamais supprimer ou déplacer silencieusement un tag publié et ne jamais
réécrire l'historique de `main`.

Identifier le commit fautif, puis créer un commit inverse :

```powershell
git switch main
git pull --ff-only origin main
git switch -c 'fix/revert-v1.0.0-beta.1'
git log --oneline --decorate -20
git revert <identifiant-du-commit>
npm test
npm run build
git push -u origin fix/revert-v1.0.0-beta.1
```

Faire valider ce revert par Pull Request, puis publier une nouvelle version
corrective. Conserver l'ancienne Release GitHub pour la traçabilité et
l'identifier clairement comme défectueuse ou obsolète dans sa description.

Si la release a modifié des données, appliquer uniquement la procédure de
rollback préalablement documentée et testée, puis comparer les données avant et
après. Un `git revert` n'annule pas une migration Firestore.
