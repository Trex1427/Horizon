# Horizon Design System Audit

Statut: DESIGN SYSTEM FREEZE V1.0 / SPRINT DS-01
Perimetre: audit documentaire et organisation Design System uniquement
Date: 2026-08-05

## Resume executif

Le Design System Horizon existe deja avec une surface importante (79 composants exportes dans src/components/ui), mais son adoption effective reste limitee au niveau page. Le niveau de mutualisation est present sur un noyau de composants app/barrel, tandis qu une majorite de composants sont dormants (non importes dans les pages).

Points saillants:
- Surface DS exportee: 79 composants
- Composants effectivement importes dans les pages via le barrel UI: 23 (29.1%)
- Composants non importes dans les pages: 56 (70.9%)
- Pages applicatives: 16 pages JSX
- Pages qui importent le DS barrel: 4 (25%)
- Definitions locales de composants UI dans les pages: 21 (concentrees sur 4 pages)

Conclusion freeze:
- Le DS est structure, mais encore sous-utilise.
- Le prochain cycle doit prioriser la reduction des composants locaux page et la migration vers des primitives DS stables.
- Aucun changement metier/calcul/hook/service n est necessaire pour demarrer DS-02.

## 1) Vue d ensemble (metriques)

### 1.1 Metriques globales

- UI exportee: 79 composants
- Utilisation stricte (imports depuis ../components/ui):
  - 15 composants en mutualisation (>= 2 pages)
  - 8 composants usage initial (1 page)
  - 56 composants dormants (0 page)
- Maturite stricte:
  - Mature (>= 4 pages): 0
  - En mutualisation (2-3 pages): 15
  - Initial (1 page): 8
  - Dormant (0 page): 56

### 1.2 Couverture pages

- Pages total: 16
- Pages avec import DS direct: 4
  - src/pages/Budgets.jsx
  - src/pages/FraisFixes.jsx
  - src/pages/Referentiels.jsx
  - src/pages/Transactions.jsx

### 1.3 Concentration du local UI

Composants UI definis localement dans les pages:
- src/pages/Analyse.jsx: 9
- src/pages/Referentiels.jsx: 8
- src/pages/Travail.jsx: 3
- src/pages/Vehicles.jsx: 1

Lecture:
- Le volume local est fortement concentre dans Analyse et Referentiels.
- Ces pages sont les meilleurs candidats DS-02 pour extractions de patterns UI.

## 2) Architecture actuelle par dossier

| Dossier DS | Role principal | Nb composants exportes | Qualite percue | Reuse actuel |
|---|---|---:|---|---|
| src/components/ui/app | Alias app et patterns de composition ecran | 35 | Bonne structure, couverture large, risque de surcouche | Noyau principal des usages actuels |
| src/components/ui/forms | Champs et controles formulaire | 8 | Base solide mais peu adoptee en pages | Faible |
| src/components/ui/buttons | Variantes boutons | 5 | Cohesion simple et claire | Bonne adoption partielle |
| src/components/ui/cards | Cartes/KPI/sections | 5 | Bonne base, adoption inegale | Faible a moyen |
| src/components/ui/dialogs | Dialog/Drawer/BottomSheet | 4 | Solide et critique | Moyen |
| src/components/ui/layout | Layout et grille | 5 | Correct mais peu exploite | Faible |
| src/components/ui/navigation | Navigation/ActionBar | 3 | Ciblee et utile | Faible |
| src/components/ui/states | Empty/Loading/Error/Skeleton | 4 | Pertinent mais sous-adopte | Tres faible |
| src/components/ui/charts | Primitives data viz | 5 | Potentiel eleve, non branche | Quasi nul |
| src/components/ui/feedback | Alert/Toast/Banner | 3 | Bon potentiel mais collisions de conventions | Faible |
| src/components/ui/tables | DataTable/MobileCard | 2 | Utilite evidente, non activee | Nul |

Constat architecture:
- L arborescence est saine et deja orientee par domaines UI.
- Le principal ecart n est pas la structure, mais l adoption effective et la convergence des pages vers le DS.

## 3) Classification par familles

Etat par famille cible (freeze DS-01):

- Layout: present (PageLayout, PageHeader, Section, Grid, Container), sous-utilise
- Navigation: present (Sidebar, BottomNavigation, ActionBar), sous-utilise
- Toolbar: present et actif via AppToolbar, AppToolbarSearchField
- Cards: present (Card, SummaryCard, SectionCard, InfoCard), adoption partielle
- KPI: present (KpiCard, AppKpiGrid, AppStatCard), adoption partielle
- Drawer: present (Drawer, AppDrawer), faible adoption
- Dialogs: present et actif (Dialog, AppFilterDialog, AppSortDialog)
- Forms: present mais largement dormant
- Filters: present surtout cote app aliases, adoption focalisee Budgets/Transactions
- Feedback: present (Alert/Toast/Banner/AppAlert), usage heterogene
- States: present (Empty/Loading/Error/Skeleton), faible adoption
- Tables: present mais dormant
- Charts: present mais dormant
- Animations: non explicite en famille dediee
- Icons: couvert indirectement (IconButton + MUI icons), sans couche DS iconographique claire
- Utilities: present (utils.js)

## 4) Matrice composants (nom, chemin, pages, maturite)

Regle de maturite utilisee (usage strict par imports DS):
- Mature: >= 4 pages
- En mutualisation: 2 a 3 pages
- Initial: 1 page
- Dormant: 0 page

| Composant | Chemin | Pages (imports UI) | Nb pages | Maturite |
|---|---|---|---:|---|
| ActionBar | src/components/ui/navigation/Navigation.jsx | Transactions | 1 | Initial |
| Alert | src/components/ui/feedback/Feedback.jsx | - | 0 | Dormant |
| AppActions | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| AppAlert | src/components/ui/app/AppShell.jsx | Budgets, Transactions | 2 | En mutualisation |
| AppCard | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| AppChip | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| AppDialogFooter | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| AppDrawer | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| AppEmptyState | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| AppFilterBar | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| AppFilterDialog | src/components/ui/app/AppShell.jsx | Budgets | 1 | Initial |
| AppFormSection | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| AppHeader | src/components/ui/app/AppShell.jsx | Budgets, Transactions | 2 | En mutualisation |
| AppInfoList | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| AppKpiGrid | src/components/ui/app/AppShell.jsx | Budgets, Transactions | 2 | En mutualisation |
| AppPage | src/components/ui/app/AppShell.jsx | FraisFixes | 1 | Initial |
| AppPrimaryAction | src/components/ui/app/AppShell.jsx | FraisFixes | 1 | Initial |
| AppSearch | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| AppSearchBar | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| AppSecondaryAction | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| AppSecondaryToolsButton | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| AppSection | src/components/ui/app/AppShell.jsx | Budgets, FraisFixes | 2 | En mutualisation |
| AppSortDialog | src/components/ui/app/AppShell.jsx | Budgets, Transactions | 2 | En mutualisation |
| AppStatCard | src/components/ui/app/AppShell.jsx | Budgets, FraisFixes | 2 | En mutualisation |
| AppStatusBadge | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| AppStickyPanel | src/components/ui/app/AppShell.jsx | Budgets, Transactions | 2 | En mutualisation |
| AppTimeline | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| AppToolbar | src/components/ui/app/AppShell.jsx | Budgets, FraisFixes, Referentiels | 3 | En mutualisation |
| AppToolbarSearchField | src/components/ui/app/AppShell.jsx | Budgets, Transactions | 2 | En mutualisation |
| Badge | src/components/ui/charts/Charts.jsx | - | 0 | Dormant |
| Banner | src/components/ui/feedback/Feedback.jsx | - | 0 | Dormant |
| BottomNavigation | src/components/ui/navigation/Navigation.jsx | - | 0 | Dormant |
| BottomSheet | src/components/ui/dialogs/Dialogs.jsx | - | 0 | Dormant |
| Card | src/components/ui/cards/Cards.jsx | Transactions | 1 | Initial |
| Checkbox | src/components/ui/forms/Forms.jsx | Transactions | 1 | Initial |
| CompactKpiGrid | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| CompactPageHeader | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| CompactToolbarLayout | src/components/ui/app/AppShell.jsx | Budgets, Transactions | 2 | En mutualisation |
| ConfirmDialog | src/components/ui/dialogs/Dialogs.jsx | - | 0 | Dormant |
| Container | src/components/ui/layout/Layout.jsx | - | 0 | Dormant |
| CurrencyInput | src/components/ui/forms/Forms.jsx | - | 0 | Dormant |
| DangerButton | src/components/ui/buttons/Buttons.jsx | Transactions | 1 | Initial |
| DataTable | src/components/ui/tables/Tables.jsx | - | 0 | Dormant |
| DatePicker | src/components/ui/forms/Forms.jsx | - | 0 | Dormant |
| Dialog | src/components/ui/dialogs/Dialogs.jsx | Budgets, Referentiels, Transactions | 3 | En mutualisation |
| DialogActionBar | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| DonutChart | src/components/ui/charts/Charts.jsx | - | 0 | Dormant |
| Drawer | src/components/ui/dialogs/Dialogs.jsx | - | 0 | Dormant |
| EmptyState | src/components/ui/states/States.jsx | - | 0 | Dormant |
| ErrorState | src/components/ui/states/States.jsx | - | 0 | Dormant |
| GhostButton | src/components/ui/buttons/Buttons.jsx | - | 0 | Dormant |
| Grid | src/components/ui/layout/Layout.jsx | - | 0 | Dormant |
| IconButton | src/components/ui/buttons/Buttons.jsx | Referentiels | 1 | Initial |
| InfoCard | src/components/ui/cards/Cards.jsx | - | 0 | Dormant |
| Input | src/components/ui/forms/Forms.jsx | - | 0 | Dormant |
| KpiCard | src/components/ui/cards/Cards.jsx | - | 0 | Dormant |
| LineChart | src/components/ui/charts/Charts.jsx | - | 0 | Dormant |
| LoadingMessageCard | src/components/ui/app/AppShell.jsx | Budgets, Transactions | 2 | En mutualisation |
| LoadingState | src/components/ui/states/States.jsx | - | 0 | Dormant |
| MobileCard | src/components/ui/tables/Tables.jsx | - | 0 | Dormant |
| PageHeader | src/components/ui/layout/Layout.jsx | - | 0 | Dormant |
| PageLayout | src/components/ui/layout/Layout.jsx | - | 0 | Dormant |
| PrimaryButton | src/components/ui/buttons/Buttons.jsx | Budgets, FraisFixes, Transactions | 3 | En mutualisation |
| ProgressBar | src/components/ui/charts/Charts.jsx | - | 0 | Dormant |
| ResultsEmptyCard | src/components/ui/app/AppShell.jsx | Budgets, Transactions | 2 | En mutualisation |
| SearchInput | src/components/ui/forms/Forms.jsx | - | 0 | Dormant |
| SecondaryButton | src/components/ui/buttons/Buttons.jsx | Budgets, FraisFixes, Transactions | 3 | En mutualisation |
| Section | src/components/ui/layout/Layout.jsx | - | 0 | Dormant |
| SectionCard | src/components/ui/cards/Cards.jsx | - | 0 | Dormant |
| Select | src/components/ui/forms/Forms.jsx | - | 0 | Dormant |
| Sidebar | src/components/ui/navigation/Navigation.jsx | - | 0 | Dormant |
| Skeleton | src/components/ui/states/States.jsx | - | 0 | Dormant |
| Sparkline | src/components/ui/charts/Charts.jsx | - | 0 | Dormant |
| StickySummaryPanel | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |
| SummaryCard | src/components/ui/cards/Cards.jsx | - | 0 | Dormant |
| Switch | src/components/ui/forms/Forms.jsx | - | 0 | Dormant |
| Textarea | src/components/ui/forms/Forms.jsx | - | 0 | Dormant |
| Toast | src/components/ui/feedback/Feedback.jsx | - | 0 | Dormant |
| ToolbarSearchShell | src/components/ui/app/AppShell.jsx | - | 0 | Dormant |

## 5) Duplications detectees et propositions de fusion

### 5.1 Duplications page-locales (candidats extraction)

- Analyse (9 composants locaux): SectionShell, SummaryMetricCard, MonthlySummary, RankingCards, AttentionPanel, FilterPanel, SectionHeader, AnalysisSegmentDetail, DetailOverviewCard
- Referentiels (8 composants locaux): StatusChip, ReferenceHeader, ReferenceSearch, ReferenceSummary, EmptyState, ReferenceActionsMenu, ReferenceCard, Controls
- Travail (3 composants locaux): WaitingPanel, QuoteDialog, ActivitiesSection
- Vehicles (1 composant local): VehicleDetail

### 5.2 Duplications de concept

- Empty state: EmptyState local Referentiels vs EmptyState DS vs AppEmptyState
- Alerting: usages heterogenes entre Alert DS et AppAlert
- Toolbar search/filter: patterns proches entre AppToolbarSearchField et composants locaux de recherche/filtre
- Cartes KPI/summary: chevauchement entre AppStatCard/KpiCard et cartes locales Analyse
- Dialog footer/actions: DialogActionBar/AppDialogFooter + implementations page

### 5.3 Propositions de fusion (sans code, cible organisation)

- Definir un owner unique par famille de pattern (States, Toolbar, Cards, Dialogs)
- Garder un seul point d entree par concept:
  - Alertes applicatives: AppAlert (et documenter quand utiliser Alert)
  - Empty state: EmptyState DS (AppEmptyState en alias eventuel)
  - Recherche toolbar: AppToolbarSearchField
- Ajouter une regle de deprecation documentaire pour les alias dormants ou redondants

## 6) Primitives manquantes

Manques prioritaires detectes:

- Toolbar composee standardisee (search + filters + sort + secondary actions + chips actifs)
- Filter chips standardises (actif/inactif/compteur) pour harmoniser les pages
- Stat blocks analytiques (kpi + variation + delta) pour Analyse
- Data table responsive de reference (desktop + mobile cards) avec etats integres
- Empty state canonique avec variantes (no data, no match, permission, erreur)
- Form field wrappers metier-agnostiques (label/hint/error/required) pour migrations futures
- Icon policy explicite (set iconographique, tailles, alignements)

## 7) Proposition d arborescence cible

Objectif: conserver l arborescence existante, clarifier les niveaux et supprimer les ambiguities d alias.

Proposition:

- src/components/ui/foundations
  - tokens (colors, spacing, radius, typography)
  - motion
  - iconography
- src/components/ui/primitives
  - buttons
  - forms
  - feedback
  - layout
  - states
- src/components/ui/patterns
  - toolbars
  - cards
  - dialogs
  - tables
  - navigation
  - charts
- src/components/ui/app
  - aliases app-level legitimes uniquement
  - wrappers de composition ecran
- src/components/ui/index.js
  - exports publics strictement curates

Regle organisationnelle:
- Un composant doit exister soit en primitive, soit en pattern, soit en alias app.
- Les doublons transverses doivent etre traces comme deprecated dans la documentation.

## 8) Roadmap DS-02 a DS-06+

### DS-02: Normalisation documentaire
- Publier conventions de nommage (Primitive/Pattern/App alias)
- Ajouter statut par composant: stable, experimental, deprecated
- Definir policy de migration page-local -> DS

### DS-03: Convergence States/Feedback
- Unifier EmptyState/AppEmptyState
- Unifier AppAlert/Alert et policy d usage
- Standardiser loaders/skeleton/error layouts

### DS-04: Convergence Toolbars/Filters
- Normaliser toolbar composee
- Extraire patterns de filtre tri recherche communs
- Rendre explicite la gestion des chips d etat

### DS-05: Convergence Cards/KPI et Tables
- Extraire patterns analytiques de Analyse
- Stabiliser DataTable + MobileCard
- Clarifier cartes informatives vs cartes metriques

### DS-06+: Adoption transversale
- Etendre import DS aux 12 pages restantes
- Reducer les composants locaux page au strict metier
- Introduire un score de couverture DS dans la matrice

## Principaux risques

- Risque de dette dormante: 56 composants non importes peuvent diverger et devenir obsoletes
- Risque de fragmentation: coexistence aliases App et primitives equivalentes sans convention stricte
- Risque de migration lente: seulement 4/16 pages utilisent le barrel DS
- Risque de faux sentiment de couverture: surface exportee elevee mais adoption reelle faible

## Priorites recommandees

1. Etablir la politique officielle de canon par famille (Alert, EmptyState, Toolbar, Cards).
2. Lancer DS-02 sur les deux pages les plus contributrices au local UI: Analyse et Referentiels.
3. Ajouter dans la matrice DS un indicateur strict base sur les imports barrel (et non sur simple presence de symbole).
4. Definir un processus de deprecation pour les composants dormants avant toute nouvelle creation.

## Notes methodologiques

- Les metriques de cette audit reposent sur un relevement strict des imports nommes depuis ../components/ui dans src/pages.
- Une vue lexicale complementaire (presence de symbole) existe pour detection de signaux, mais n est pas utilisee comme source primaire pour la maturite.
- Aucun code metier, calcul, hook, service ou regle Firestore n a ete modifie dans ce sprint DS-01.

## Addendum DS-02 - Architecture du Design System

Statut: applique
Date: 2026-08-06

Architecture officielle creee sous `src/components/ui/`:
- foundations
- layout
- navigation
- toolbar
- cards
- kpi
- drawer
- dialogs
- forms
- filters
- feedback
- states
- tables
- charts
- animations
- icons

Regle de gouvernance verifiee:
- Tout nouveau composant UI doit appartenir a une famille.

Migrations DS-02 executees (sans changement fonctionnel):
- AppToolbarSearchField -> toolbar
- AppSecondaryToolsButton -> toolbar
- CompactToolbarLayout -> toolbar
- AppAlert -> feedback
- AppChip -> feedback
- LoadingMessageCard -> states
- ResultsEmptyCard -> states

Perimetre non modifie:
- Aucun calcul metier
- Aucun service
- Aucun hook
- Aucune regle Firestore
- Aucun comportement fonctionnel

## Addendum DS-03 - Demantelement de AppShell

Statut: applique
Date: 2026-08-06

Constat DS-03:
- `src/components/ui/app/AppShell.jsx` etait encore le point de definition principal de nombreux `App*`.

Actions DS-03 executees:
- Extraction de chaque composant `App*` vers sa famille officielle (`layout`, `toolbar`, `cards`, `kpi`, `drawer`, `dialogs`, `forms`, `filters`, `feedback`, `states`, `buttons`).
- Conservation de l API publique via un `AppShell` de compatibilite en re-export.
- Suppression de l export global redondant de la couche `app` dans `src/components/ui/index.js` pour eviter les collisions d exports.

Validation de perimetre:
- Aucun changement metier
- Aucun changement service/hook
- Aucune regle Firestore modifiee
- Aucun changement UX/visuel intentionnel

## Addendum DS-04 - Transactions page de reference

Statut: applique
Date: 2026-08-06

Objectif:
- Faire de `Transactions.jsx` la premiere page 100% conforme au Design System Horizon.

Actions DS-04 executees:
- Suppression des imports directs `@mui/material` et `@mui/icons-material` dans `Transactions.jsx`.
- Routage des primitives UI via familles officielles:
  - `foundations/MuiPrimitives`
  - `icons/MuiIcons`

Garanties:
- Aucun changement metier.
- Aucun changement de calcul.
- Aucun changement hook/service/Firestore.
- Aucun changement fonctionnel intentionnel.
- Rendu visuel conserve (meme base MUI, point d entree DS unifie).
