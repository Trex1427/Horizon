# Intégration continue de Horizon

Le workflow GitHub Actions est défini dans `.github/workflows/ci.yml`. Il
contrôle qu'une modification peut être installée, analysée, testée et construite
avant sa fusion.

## Déclencheurs

La CI s'exécute automatiquement :

- pour chaque Pull Request ciblant `main` ;
- pour chaque push sur `main`.

Elle ne se déclenche pas pour un simple push sur une branche de travail tant
qu'aucune Pull Request vers `main` n'est ouverte.

## Environnement

Le workflow utilise :

- `ubuntu-latest` ;
- Node.js 22 LTS ;
- npm et le lockfile racine `package-lock.json` ;
- le cache npm de `actions/setup-node`.

Node 22 respecte la contrainte de Vite 8, qui demande Node `^20.19.0` ou
`>=22.12.0`.

## Étapes et commandes

Le job `CI checks` exécute, dans cet ordre :

```text
npm ci
npm run lint
npm test
npm run build
```

Une étape en échec arrête le job. Aucun `continue-on-error` n'est utilisé.

Le workflow emploie des permissions GitHub en lecture seule et ne contient
aucune étape de déploiement.

### État initial du lint

Lors de la création de la CI, `npm run lint` atteint correctement les sources
mais signale une dette ESLint existante. Le contrôle reste volontairement
bloquant : aucun `continue-on-error`, filtre artificiel ou faux succès n'est
ajouté. Les erreurs devront être traitées dans un sprint dédié avant que le
check complet puisse devenir vert.

Les profils Chrome locaux `.chrome-*` sont des artefacts générés et sont exclus
de l'analyse ESLint ; les sources applicatives, tests et scripts restent
analysés.

## Variables et secrets

Les contrôles retenus ne nécessitent aucun secret GitHub et aucune variable
Firebase de production.

Le build Vite transforme les références `VITE_*` sans avoir besoin de se
connecter à Firebase. Les tests automatisés utilisent leurs propres doubles,
fixtures ou valeurs de test et ne doivent pas joindre les services de
production.

Ne jamais ajouter au workflow :

- un fichier `.env` réel ;
- une clé Firebase Admin ;
- un compte de service ;
- un secret OpenAI ;
- un identifiant permettant d'écrire dans Firestore de production.

## Tests Firestore Rules

Le script `npm run test:rules` existe et utilise Firestore Emulator. Il n'est
pas encore exécuté par cette CI, car `firebase-tools` n'est pas une dépendance
verrouillée par le `package-lock.json` racine. Sur un poste configuré, la
commande dépend actuellement d'une installation externe de Firebase CLI.

L'ajouter implicitement avec une installation non verrouillée rendrait la CI
moins reproductible. Son intégration devra faire l'objet d'un sprint dédié qui
verrouillera l'outil et validera Java et le téléchargement de l'Emulator, sans
secret ni accès à la production.

Les autres scripts d'intégration, E2E, maintenance, migration, sauvegarde et
seed ne font pas partie de cette CI. Certains nécessitent un navigateur, un
service externe, un compte de service ou un environnement spécifique.

## Diagnostiquer un échec

Dans la Pull Request :

1. ouvrir l'onglet **Checks** ;
2. sélectionner le workflow **CI** ;
3. ouvrir le job **CI checks** ;
4. repérer la première étape en échec ;
5. développer les logs de cette étape ;
6. reproduire localement la commande correspondante.

Reproduire l'ensemble de la CI depuis PowerShell :

```powershell
Set-Location 'C:\Users\alext\budget-alexandre'
npm ci
npm run lint
npm test
npm run build
```

## Relancer la CI

Après une correction, pousser un nouveau commit sur la branche de la Pull
Request relance automatiquement la CI.

GitHub permet également de relancer un workflow sans nouveau commit :

1. ouvrir l'onglet **Checks** de la Pull Request ou l'onglet **Actions** du
   dépôt ;
2. ouvrir l'exécution concernée ;
3. choisir **Re-run jobs** puis **Re-run failed jobs**.

## Protection de Firestore

La CI ne doit jamais lire ni écrire Firestore en production. Aucun script de
maintenance, migration, seed, nettoyage, sauvegarde ou déploiement Firebase ne
doit être ajouté à ce workflow.

Si un futur contrôle Firestore est nécessaire, il doit cibler exclusivement
Firestore Emulator ou un environnement Firebase de test séparé.
