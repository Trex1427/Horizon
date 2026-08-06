# Horizon Design System V3

Version : 1.0
Statut : Constitution officielle
Date : 2026-08-05
Derniere mise a jour : 2026-08-06

## Statut du document
Ce document definit la reference design officielle de Horizon pour les prochaines annees.

Il formalise les primitives visuelles et la composition des composants reutilisables.

## Champ d'application
Le Design System definit :
- l'identite graphique ;
- la palette, la typographie, les espacements et la grille ;
- les composants App* ;
- la composition visuelle des cartes, KPI, drawers, formulaires et etats.

Le Design System ne definit pas :
- la vision produit, definie dans HORIZON_PRODUCT_MANIFESTO ;
- les parcours et comportements d'usage, definis dans HORIZON_UX_GUIDELINES ;
- les priorites de livraison, definies dans HORIZON_PRODUCT_ROADMAP ;
- l'implementation technique, definie dans ARCHITECTURE.md.

## Relation avec la hierarchie documentaire
Ce document applique le Manifesto et les UX Guidelines. En cas de conflit avec un objectif de parcours, l'intention UX prevaut et la composition visuelle est adaptee via une decision tracee si necessaire.

## 1. Intention de design
Horizon V3 doit transmettre une sensation de :
- clarte immediate ;
- precision ;
- calme ;
- confiance ;
- vitesse.

Principe directeur :
Le design ne sert pas a decorer. Le design sert a reduire l'effort cognitif pour decider plus vite.

## 2. Identite graphique
### Direction visuelle
- Esthetique sobre et premium.
- Contrastes lisibles, jamais agressifs.
- Surfaces claires, profondeur legere.
- Hierarchie stricte de l'information.

### Mots cles
- propre
- lisible
- stable
- moderne
- rassurant

## 3. Palette officielle
### Couleurs de base
- Ink : #172A2F
- Muted : #61777B
- Surface : #F6F8F4
- Border : rgba(23, 42, 47, 0.12)
- Accent : #0F5F8F

### Couleurs d'etat
- Success : #147D64
- Warning : #D97706
- Danger : #C24135

### Regles palette
1. Une couleur d'accent principale par ecran.
2. Les couleurs d'etat sont reservees aux signaux metier.
3. Aucune palette hors charte sans exception documentee dans HORIZON_DECISION_RECORDS.md.

## 4. Typographie
### Echelle
- Display : contexte exceptionnel
- H1 : titre de page
- H2 : titre de section
- H3 : titre de bloc
- Body : contenu standard
- Caption : metadonnees

### Regles
1. Le chiffre clef doit dominer visuellement son contexte.
2. Une carte ne doit pas utiliser plus de trois niveaux de texte sans exception documentee.

## 5. Espacements
### Systeme
Base de spacing : 8.

Niveaux recommandes :
- micro : 4
- compact : 8
- normal : 16
- section : 24
- page : 32

## 6. Grille
### Desktop
- 12 colonnes
- marge laterale confortable

### Tablette
- 8 colonnes
- densite intermediaire

### Mobile
- 4 colonnes
- parcours vertical prioritaire

Regle :
Une adaptation responsive doit reorganiser l'information, pas juste la compresser.

## 7. Responsive et lisibilite
### Exigences
- aucun texte coupe sans acces au detail ;
- aucun composant cle illisible sur petit format ;
- focus visible ;
- contrastes suffisants ;
- navigation clavier sans blocage.

## 8. Architecture officielle par familles

Le Design System Horizon est organise en 4 couches. Cette architecture est obligatoire pour tous les composants UI.

### 8.1 Couches officielles

1. Foundations
- Tokens de couleur, typographie, spacing, elevation, radius, motion.
- Aucune logique metier.

2. Primitives
- Briques UI elementaires (boutons, champs, labels, conteneurs de base).
- Peu d'opinion metier, API stable, composables.

3. Families (patterns)
- Composants de composition qui resolvent un besoin d'interface recurrent.
- Chaque pattern appartient a une famille fonctionnelle explicite.

4. App aliases
- Wrappers App* pour assembler les patterns sans dupliquer les conventions.
- Ne remplacent pas les families: ils les orchestrent.

### 8.2 Families officielles

Chaque composant de pattern doit appartenir a une et une seule famille principale:

- Layout: structure de page, sections, grilles, densite.
- Navigation: deplacement dans l'application et changement de contexte.
- Toolbar: recherche, filtres, tri, actions secondaires, chips actifs.
- Cards et KPI: lecture synthetique, cartes d'information, blocs de metriques.
- Forms: saisie, validation visuelle, aides contextuelles.
- Dialogs et Drawers: edition, confirmation, details et decisions critiques.
- States: chargement, vide, erreur, no-match, indisponibilite.
- Feedback: alertes, notifications, statuts, severites.
- Data display: tableaux, listes denses, timelines, visualisations.
- Actions: boutons, actions primaires/secondaires, chips d'action.

### 8.3 Regle constitutionnelle de rattachement

Regle officielle:
Tout nouveau composant doit etre rattache a une famille avant sa creation dans le code.

Minimum documentaire obligatoire pour chaque nouveau composant:
1. Nom du composant.
2. Famille principale.
3. Couche cible (primitive, pattern, ou app alias).
4. Cas d'usage et limites.

Sans rattachement de famille, le composant ne peut pas etre considere conforme au Design System Horizon.

### 8.4 Regles de nommage

- Prefixe `App` reserve aux aliases et patterns applicatifs transverses.
- Les primitives gardent des noms generiques et stables.
- Les composants metier ne doivent pas etre publies dans le Design System.

## 9. Composants et composition
### AppPage
Rassemble la page avec un rythme vertical stable.

### AppHeader
Presente titre, contexte et statut global.

### AppToolbar
Contient recherche, filtres, tri et actions.

Regles de composition :
- zone de lecture immediate ;
- regroupement des actions secondaires ;
- possibilite de sticky sur les pages de liste longues.

Les regles de comportement de toolbar sont definies dans HORIZON_UX_GUIDELINES.

### AppSearch
Recherche visible et immediate.

### AppFilters
Filtres organises par niveau de densite : rapide, avance, expert.

### AppSection
Bloc thematique avec titre clair et sous-texte utile.

### AppCard
Unite de scan rapide.

Structure par defaut :
- nom ;
- valeur principale ;
- statut ;
- une information secondaire ;
- un indicateur visuel.

Toute exception de structure doit etre documentee dans HORIZON_DECISION_RECORDS.md.

### AppKpi et AppStats
Synthese de haut d'ecran.

Regles KPI :
- maximum 4 KPI prioritaires visibles par defaut ;
- labels courts ;
- aucune redondance inutile avec le contenu bas.

Toute exception doit etre documentee dans HORIZON_DECISION_RECORDS.md.

### AppDrawer
Unite de comprehension approfondie.

Structure par defaut :
1. Titre
2. Sous-titre
3. KPI
4. Informations
5. Transactions
6. Statistiques
7. Historique
8. Actions

Toute exception de structure doit etre documentee dans HORIZON_DECISION_RECORDS.md.
L'usage du drawer comme conteneur par defaut du detail est defini dans HORIZON_UX_GUIDELINES.

### AppTimeline
Explique le deroulement d'un fait dans le temps.

### AppStatusBadge
Encode statut et severite de facon constante.

### AppInfoList
Affiche des paires label/valeur en lecture rapide.

### AppForm et AppFormSection
Organisent la saisie en sections predictibles.

Structure par defaut :
1. Informations
2. Valeurs
3. Dates
4. Options avancees

Toute exception de structure doit etre documentee dans HORIZON_DECISION_RECORDS.md.

### AppDialog et AppConfirm
Gerent edition et confirmations critiques.

### AppEmptyState
Explique l'absence de donnees et propose la prochaine action.

## 10. Etats et feedback
### Dialogues
1. Titre oriente action.
2. Description courte.
3. CTA primaire explicite.
4. Destructif visuellement distinct.

### Badges
1. Utiliser un vocabulaire stable.
2. Limiter le nombre de badges visibles.
3. Prioriser statut metier puis type.

### Timeline
1. Ordre chronologique explicite.
2. Etape, date, effet.
3. Mettre en evidence les anomalies.

### Empty states
1. Expliquer le pourquoi de l'etat vide.
2. Donner une action immediate.
3. Eviter les messages neutres inutiles.

### Chargement et erreur
- Montrer une progression percue.
- Eviter les ecrans vides instables.
- Afficher un message humain, une cause probable si connue et une action de reprise.

## 11. Animations
1. Discretes et rapides.
2. Utiles pour guider l'attention.
3. Respect du mode reduced motion.

## 12. References constitutionnelles
Pour les regles connexes :
- Vision et arbitrages produit : HORIZON_PRODUCT_MANIFESTO.
- Navigation, usage du drawer, actions principales, options avancees et parcours : HORIZON_UX_GUIDELINES.
- Priorites de convergence et de migration : HORIZON_PRODUCT_ROADMAP.
- Revue officielle avant sprint et Pull Request : HORIZON_REVIEW_CHECKLIST.md.
- Regime d'exception : HORIZON_DECISION_RECORDS.md.

## 13. Gouvernance du Design System
1. Tout nouvel ecran doit reutiliser les primitives App* autant que possible.
2. Tout nouveau composant doit etre rattache a une famille officielle avant implementation.
3. Toute exception doit etre documentee dans HORIZON_DECISION_RECORDS.md.
4. Toute divergence visuelle doit etre tracee et corrigee.
5. La validation finale s'appuie sur HORIZON_REVIEW_CHECKLIST.md.

## 14. DS-02 Architecture definitive

Arborescence officielle:

```text
src/components/ui/
	foundations/
	layout/
	navigation/
	toolbar/
	cards/
	kpi/
	drawer/
	dialogs/
	forms/
	filters/
	feedback/
	states/
	tables/
	charts/
	animations/
	icons/
```

Chaque famille contient au minimum:
- `index.js`
- `README.md`

Migrations DS-02 effectuees sans changement fonctionnel:
- `AppToolbarSearchField` -> famille `toolbar`
- `AppSecondaryToolsButton` -> famille `toolbar`
- `CompactToolbarLayout` -> famille `toolbar`
- `AppAlert` -> famille `feedback`
- `AppChip` -> famille `feedback`
- `LoadingMessageCard` -> famille `states`
- `ResultsEmptyCard` -> famille `states`

## 15. DS-03 - Demantelement de AppShell

Objectif DS-03:
- Retirer la possession des composants UI de `AppShell` au profit des familles officielles.

Regle appliquee:
- `AppShell` devient une couche de compatibilite (re-exports uniquement).
- Les definitions vivent exclusivement dans les familles.

Resultat:
- Les composants `App*` sont desormais rattaches a leur famille officielle.
- Le barrel global `src/components/ui/index.js` expose les familles officielles sans redondance.

## 16. DS-04 - Transactions reference officielle

Objectif DS-04:
- Transactions devient la premiere page 100% conforme au Design System Horizon.

Regle appliquee:
- Toute primitive UI de `Transactions.jsx` provient des familles officielles DS.

Implementation:
- `foundations/MuiPrimitives` centralise les primitives MUI utilisees par Transactions.
- `icons/MuiIcons` centralise les icones MUI utilisees par Transactions.

Resultat:
- Aucun import direct MUI dans `Transactions.jsx`.
- Conformite DS renforcee sans changement metier ni visuel.