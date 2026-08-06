# Horizon Product Roadmap

Version : 1.0
Statut : Constitution officielle
Date : 2026-08-05
Derniere mise a jour : 2026-08-05

## Statut du document
Cette roadmap formalise les priorites produit de Horizon a partir de l'etat actuel du projet.

Objectif : organiser les evolutions pour maximiser l'impact utilisateur sans compromettre la simplicite, la fiabilite et la coherence.

## Champ d'application
La Roadmap definit :
- les horizons de priorisation ;
- les axes strategiques ;
- les criteres d'entree et de sortie des chantiers ;
- les KPIs de pilotage.

La Roadmap ne redefinit pas :
- la vision produit, definie dans HORIZON_PRODUCT_MANIFESTO ;
- les parcours et comportements UX, definis dans HORIZON_UX_GUIDELINES ;
- les composants et primitives visuelles, definis dans HORIZON_DESIGN_SYSTEM_V3 ;
- l'implementation technique, definie dans ARCHITECTURE.md.

## Relation avec la hierarchie documentaire
La Roadmap applique les documents de rang superieur. Elle ne cree pas de regle produit, UX ou design qui contredirait le Manifesto, les UX Guidelines ou le Design System.

## 1. Methode de priorisation
Chaque chantier est evalue selon:
- Impact utilisateur: faible, moyen, eleve, critique
- Complexite: faible, moyenne, elevee
- Priorite: P0, P1, P2, P3
- Risque: faible, moyen, eleve

Regle:
A impact egal, la priorite va au chantier qui reduit le plus la friction recurrente.

## 2. Horizons strategiques
## Tres court terme (0-3 mois)
### Axe 1: Stabilite UX transversale
- Objectif: rendre tous les parcours critiques constants et predictibles.
- Impact: eleve
- Complexite: moyenne
- Priorite: P0
- Risque: moyen
- Resultat attendu: baisse des irritants sur navigation, formulaires et lecture des cartes.

### Axe 2: Convergence design V2 vers Constitution V3
- Objectif: aligner les pages sur les memes regles Carte resume / Drawer comprehension.
- Impact: eleve
- Complexite: moyenne
- Priorite: P0
- Risque: moyen
- Resultat attendu: perception produit unifiee.

### Axe 3: Matrice de validation UX visuelle
- Objectif: instaurer une validation systematique desktop, tablette, mobile.
- Impact: eleve
- Complexite: moyenne
- Priorite: P0
- Risque: faible
- Resultat attendu: reduction des regressions UI.

## Court terme (3-6 mois)
### Axe 4: Qualite des parcours Referentiels
- Objectif: simplifier fortement creation, fusion, archivage et navigation referentielle.
- Impact: eleve
- Complexite: elevee
- Priorite: P1
- Risque: moyen
- Resultat attendu: baisse de la complexite percue sur la zone la plus dense.

### Axe 5: Excellence du flux Import bancaire
- Objectif: fiabiliser import, validation et reconciliation utilisateur.
- Impact: critique
- Complexite: elevee
- Priorite: P1
- Risque: eleve
- Resultat attendu: confiance accrue dans les donnees importees.

### Axe 6: Consolidation accessibilite
- Objectif: standardiser focus, contrastes, erreurs, navigation clavier.
- Impact: moyen
- Complexite: moyenne
- Priorite: P1
- Risque: faible
- Resultat attendu: usage plus inclusif et robuste.

## Moyen terme (6-12 mois)
### Axe 7: Decision support avancee
- Objectif: renforcer recommandations actionnables dans Analyse et Previsions.
- Impact: eleve
- Complexite: elevee
- Priorite: P2
- Risque: moyen
- Resultat attendu: passage de la consultation a l'action guidee.

### Axe 8: Pilotage Travail unifie
- Objectif: harmoniser Devis, Factures, Travail et suivi de revenus operationnels.
- Impact: eleve
- Complexite: elevee
- Priorite: P2
- Risque: moyen
- Resultat attendu: meilleure lisibilite business pour independants.

### Axe 9: Gouvernance de la dette UX et technique visible
- Objectif: mesurer et traiter les dettes qui degradent la perception utilisateur.
- Impact: moyen
- Complexite: moyenne
- Priorite: P2
- Risque: faible
- Resultat attendu: trajectoire de qualite durable.

## Long terme (12-24 mois)
### Axe 10: Horizon comme cockpit financier proactif
- Objectif: devenir un systeme de pilotage quotidien anticipatif et fiable.
- Impact: critique
- Complexite: elevee
- Priorite: P3
- Risque: eleve
- Resultat attendu: avantage produit durable.

### Axe 11: Personnalisation intelligente non intrusive
- Objectif: adapter les vues et recommandations sans complexifier l'interface.
- Impact: eleve
- Complexite: elevee
- Priorite: P3
- Risque: eleve
- Resultat attendu: experience plus pertinente selon le profil utilisateur.

## 3. Backlog strategique priorise
| Theme | Impact utilisateur | Complexite | Priorite | Risque | Pourquoi maintenant |
| --- | --- | --- | --- | --- | --- |
| Unification UX Carte et Drawer | Eleve | Moyenne | P0 | Moyen | Coherence immediate et reduction de friction |
| Validation visuelle multi-ecrans | Eleve | Moyenne | P0 | Faible | Protege la qualite percue sur tous les sprints |
| Simplification Referentiels | Eleve | Elevee | P1 | Moyen | Zone de complexite la plus forte aujourd'hui |
| Fiabilisation Import bancaire | Critique | Elevee | P1 | Eleve | Confiance donnees et adoption quotidienne |
| Consolidation accessibilite | Moyen | Moyenne | P1 | Faible | Qualite universelle et reduction des erreurs |
| Decision support Previsions et Analyse | Eleve | Elevee | P2 | Moyen | Passage du reporting a la decision guidee |
| Unification module Travail | Eleve | Elevee | P2 | Moyen | Valeur forte pour profils independants |
| Personnalisation intelligente | Eleve | Elevee | P3 | Eleve | Differenciation long terme |

## 4. Regles de gouvernance roadmap
1. Aucun chantier ne demarre sans alignement avec le Product Manifesto.
2. Toute epic doit definir une question utilisateur principale conformement au Manifesto.
3. Tout livrable doit preciser un impact mesurable sur un parcours reel.
4. Toute fonctionnalite qui augmente la charge cognitive est repensee ou fait l'objet d'une exception documentee.
5. Toute priorite peut etre reclassifiee si le risque utilisateur evolue.
6. Toute derogation produit, UX, design ou architecture necessaire a un chantier doit etre tracee dans HORIZON_DECISION_RECORDS.md.

## 5. KPIs de pilotage roadmap
KPIs produit:
- Temps moyen pour realiser une action principale.
- Taux de completion des parcours critiques.
- Taux d'abandon par etape de formulaire.
- Nombre de clics moyen sur les parcours standards.
- Taux de reouverture des tickets UX sur pages deja refondues.

KPIs perception:
- Sentiment de clarte.
- Sentiment de confiance.
- Sentiment de maitrise.

## 6. Criteres d'entree et de sortie de sprint
### Entree
1. Problem statement explicite.
2. Parcours cible documente.
3. Criteres UX mesurables definis.
4. Sources constitutionnelles de reference identifiees.

### Sortie
1. HORIZON_REVIEW_CHECKLIST.md est completee.
2. Les risques connus sont traces et un plan d'action est defini.
3. Les exceptions eventuelles sont renseignees dans HORIZON_DECISION_RECORDS.md.

## 7. Risques strategiques a surveiller
1. Accumulation de variantes visuelles non gouvernees.
2. Ajout de fonctions sans reduction de friction.
3. Incoherence entre navigation mobile et desktop.
4. Inflation d'options avancees visibles trop tot.
5. Dette de lisibilite sur pages denses.

## 8. Decision finale
Cette roadmap sert de cadre de priorisation.

Toute demande future est evaluee a travers:
- impact utilisateur
- simplicite preservee
- risque de complexification
- compatibilite avec la Constitution produit Horizon.

## 9. References constitutionnelles
- Vision et arbitrages produit : HORIZON_PRODUCT_MANIFESTO.
- Parcours et comportements : HORIZON_UX_GUIDELINES.
- Composants et composition visuelle : HORIZON_DESIGN_SYSTEM_V3.
- Implementation technique : ARCHITECTURE.md.
- Regime d'exception : HORIZON_DECISION_RECORDS.md.
- Revue officielle avant sprint et Pull Request : HORIZON_REVIEW_CHECKLIST.md.