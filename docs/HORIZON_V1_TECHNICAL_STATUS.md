# Horizon V1

Version actuelle: Horizon V1 Beta

Etat general: 🟡 Stable pour tests

Dernier build: ✔ OK

Derniers tests: ✔ OK

Derniere validation fonctionnelle: En cours

Derniere mise a jour: 2026-07-12

Progression par sprint:

- Sprint 1: ██░░░░░░░░ 29 %
- Sprint 2: ░░░░░░░░░░ 0 %
- Sprint 3: ░░░░░░░░░░ 0 %
- Sprint 4: ░░░░░░░░░░ 0 %
- Sprint 5: ░░░░░░░░░░ 0 %

Progression globale basee sur les sprints: ░░░░░░░░░░ 5.8 %

Resume projet:

- Ou en est le projet: le socle V1 est stable et exploitable sur les modules Transactions, Objectifs, Frais fixes, Revenus recurrents, Budgets, Previsions, Categories et Dashboard.
- Sprint en cours: Sprint 1 - UX Beta Freeze.
- Ce qui est termine: Dialog transaction (validation utilisateur Android + desktop recue).
- Ce qui est implemente mais non valide: Classement de masse.
- Ce qui reste: tous les autres items UX, les referentiels, les imports, la couche learning et Dashboard V4.
- Logique de progression: la progression n'est plus calculee sur un total global de taches. Chaque sprint a sa propre progression, calculee sur la base `fonctionnalites au moins implementees / fonctionnalites listees dans le sprint`. Une fonctionnalite `🟡` ou `🟢` compte comme implementee pour le calcul du sprint. La progression globale correspond a la moyenne des progressions des 5 sprints.

Etats autorises pour les fonctionnalites:

- 🟢 Termine: implemente, tests OK, build OK, validation utilisateur reelle OK.
- 🟡 Implemente mais non valide: code termine, tests OK, build OK, validation reelle non faite.
- ⚪ Non commence.

====================================

## SPRINT ACTIF

### Sprint 1 - UX Beta Freeze

Objectif du sprint:

- supprimer tous les irritants d'utilisation

Checklist:

- 🟢 Dialog transaction
- ⚪ Dialog budgets
- ⚪ Dialog comptes
- ⚪ Dialog categories
- ⚪ Dialog activites
- 🟡 Classement de masse
- ⚪ Selection multiple

Etat du sprint: 🟡 En cours

Progression du sprint: ██░░░░░░░░ 29 %

Critères de validation du sprint:

- [x] npm test OK
- [x] npm run build OK
- [ ] Validation fonctionnelle mobile reelle
- [ ] Validation fonctionnelle desktop reelle

====================================

## SPRINTS SUIVANTS

### Sprint 2 - Referentiels

Objectif du sprint:

- structurer et stabiliser les referentiels metier reutilisables

Checklist:

- ⚪ Categories
- ⚪ Sous-categories
- ⚪ Activites
- ⚪ Tiers
- ⚪ Projets
- ⚪ Archivage
- ⚪ Fusion

Etat du sprint: ⚪ Non commence

Progression du sprint: ░░░░░░░░░░ 0 %

Critères de validation du sprint:

- [ ] A definir au demarrage du sprint
- [ ] npm test OK
- [ ] npm run build OK
- [ ] Validation fonctionnelle reelle

### Sprint 3 - Import

Objectif du sprint:

- ouvrir des flux d'import exploitables pour les releves bancaires et documents cibles

Checklist:

- ⚪ CSV
- ⚪ OFX
- ⚪ QIF
- ⚪ PDF Credit Agricole

Etat du sprint: ⚪ Non commence

Progression du sprint: ░░░░░░░░░░ 0 %

Critères de validation du sprint:

- [ ] A definir au demarrage du sprint
- [ ] npm test OK
- [ ] npm run build OK
- [ ] Validation fonctionnelle reelle

### Sprint 4 - Learning

Objectif du sprint:

- introduire une boucle d'apprentissage validee par l'utilisateur

Checklist:

- ⚪ Suggestions
- ⚪ Validation utilisateur
- ⚪ Historique

Etat du sprint: ⚪ Non commence

Progression du sprint: ░░░░░░░░░░ 0 %

Critères de validation du sprint:

- [ ] A definir au demarrage du sprint
- [ ] npm test OK
- [ ] npm run build OK
- [ ] Validation fonctionnelle reelle

### Sprint 5 - Dashboard V4

Objectif du sprint:

- faire evoluer le cockpit Horizon vers une lecture plus analytique et predictive

Checklist:

- ⚪ Analyses multidimensionnelles
- ⚪ Graphiques
- ⚪ Previsions

Etat du sprint: ⚪ Non commence

Progression du sprint: ░░░░░░░░░░ 0 %

Critères de validation du sprint:

- [ ] A definir au demarrage du sprint
- [ ] npm test OK
- [ ] npm run build OK
- [ ] Validation fonctionnelle reelle

====================================

## DETTE TECHNIQUE

### Convention de suppression logique non unifiee

- Priorite: Haute
- Impact: comportements de suppression et de filtrage divergents entre domaines (`isActive` vs `isDeleted`), avec risque de regressions sur les requetes, la maintenance et les futurs referentiels.
- Action prevue: unifier la convention de soft delete sur tous les domaines.

### Couverture de tests insuffisante hors calculs financiers

- Priorite: Haute
- Impact: risque de regression sur les services CRUD, les hooks critiques et les scenarios de compatibilite legacy.
- Action prevue: etendre la couverture aux services CRUD, hooks critiques et scenarios de compat legacy.

### Taille de bundle elevee au build

- Priorite: Moyenne
- Impact: chargement initial plus lourd et marge de manoeuvre reduite pour les prochaines evolutions UI.
- Action prevue: ajouter une strategie de code splitting.

### Import OFX encore en placeholder

- Priorite: Haute
- Impact: impossible d'utiliser OFX.
- Action prevue: implementer un flux d'import OFX complet.

### Timeout OCR sur Android

- Priorite: Moyenne
- Impact: blocages ou echecs potentiels sur l'import mobile base sur OCR.
- Action prevue: diagnostiquer le timeout Android et fiabiliser le traitement OCR.

====================================

## VERSIONNING

### v1.0

- Objectif: premiere beta exploitable.
- Etat: 🟡 Stable pour tests.
- Fonctionnalites prevues: socle V1 stable sur les modules Transactions, Objectifs, Frais fixes, Revenus recurrents, Budgets, Previsions, Categories et Dashboard.

### v1.1

- Objectif: fiabiliser l'experience beta et ouvrir les premiers imports prioritaires.
- Etat: ⚪ Non commence.
- Fonctionnalites prevues: Import OFX, Classement de masse, Dialogs.

### v1.2

- Objectif: introduire les premiers comportements d'apprentissage utiles.
- Etat: ⚪ Non commence.
- Fonctionnalites prevues: Learning Patterns.

### v1.3

- Objectif: renforcer l'analyse et la projection dans Horizon.
- Etat: ⚪ Non commence.
- Fonctionnalites prevues: Dashboard V4.

### v2.0

- Objectif: ouvrir une couche d'assistance financiere plus ambitieuse.
- Etat: ⚪ Non commence.
- Fonctionnalites prevues: IA financiere.

====================================

## REGLES DE MISE A JOUR

- Toute fonctionnalite terminee doit mettre a jour ce document.
- Toute dette technique decouverte doit etre ajoutee a ce document.
- Aucun sprint ne peut etre marque termine sans `npm test` OK, `npm run build` OK et validation fonctionnelle reelle.
- Tout sprint termine doit comporter `npm test` OK, `npm run build` OK et validation fonctionnelle reelle.
- Sinon le sprint reste au statut `🟡 Implemente mais non valide`.
- La progression doit etre recalculee par sprint a partir des fonctionnalites reellement implementees.
- La progression globale doit etre recalculee a partir de la moyenne des progressions de sprint.

====================================

## ANNEXE TECHNIQUE

### Architecture generale

Horizon est une application React + Vite organisee en couches:

- `pages`: ecrans fonctionnels (Transactions, Objectifs, Frais fixes, Revenus recurrents, Budgets, Previsions, Categories).
- `components`: UI reutilisable (cards, formulaires, cockpit, navigation).
- `hooks`: orchestration metier cote client (chargement temps reel, actions CRUD, aggregation locale).
- `services`: acces Firestore + logique de calcul metier reutilisable.
- `context`: source d'etat partagee pour les transactions (`TransactionsContext`).
- `constants`: enums/options fonctionnelles (statuts, icones, categories par defaut).

Navigation: `App.jsx` utilise des constantes de pages (`PAGES`) et un ordre explicite (`PAGE_ORDER`).

### Firestore comme source de verite

Tous les domaines metiers utilisent Firestore comme reference:

- abonnement temps reel via `onSnapshot` dans les services
- creation/mise a jour/suppression via services CRUD
- hooks et pages ne stockent pas de logique de persistance hors services

Collections principales:

- `transactions`
- `accounts`
- `categories`
- `objectives`
- `fixedExpenses`
- `recurringIncome`
- `budgets`

### Logique metier centralisee

La logique transversale est centralisee dans:

- `src/services/financeCalculations.js`

Fonctions clefs:

- normalisation categorie
- matching transaction/budget
- matching transaction/attendu recurrent (`matchesExpectedTransaction`)
- filtrage par periode/date
- depense budget consommee
- calcul de solde global comptes
- calcul des soldes par compte

Consommateurs majeurs:

- `budgetsService.js`
- `forecastService.js`
- `useDashboard.js`

### Convention categories

Convention cible dans les modules alignes:

- `categoryId`: identifiant Firestore
- `categoryName`: libelle fonctionnel
- `category`: champ legacy de compatibilite historique

Regle de compatibilite:

- lecture et matching: priorite a `categoryId` si disponible
- fallback: `categoryName` puis `category` ou `categorie` legacy

Modules explicitement alignes:

- Budgets
- Frais fixes
- Revenus recurrents
- Transactions

### Seeds securises

Les seeds ont ete durcis pour eviter la recreation apres suppression volontaire:

- categories: seed seulement si aucune doc de categorie n'existe
- comptes: seed seulement si aucune doc de compte n'existe

Objectif atteint:

- distinguer "aucun actif" de "aucun document" pour respecter l'intention utilisateur

### Validation de stabilite a date

- Tests: `npm test` pass
- Build: `npm run build` pass
- Verdict V1: pret pour stabilisation