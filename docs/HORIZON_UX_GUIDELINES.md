# Horizon UX Guidelines

Version : 1.0
Statut : Constitution officielle
Date : 2026-08-05
Derniere mise a jour : 2026-08-05

## Statut du document
Ce document formalise les regles UX officielles de Horizon.

Objectif : transformer les parcours financiers en actions simples, fiables et rapides.

## Champ d'application
Les UX Guidelines definissent :
- les parcours ;
- les comportements d'interface ;
- la navigation ;
- les actions principales et secondaires ;
- l'usage du detail contextuel ;
- la gestion des erreurs, confirmations et etats vides.

Les UX Guidelines ne definissent pas :
- la vision produit, definie dans HORIZON_PRODUCT_MANIFESTO ;
- la composition visuelle des composants, definie dans HORIZON_DESIGN_SYSTEM_V3 ;
- la priorisation des chantiers, definie dans HORIZON_PRODUCT_ROADMAP ;
- l'implementation technique, definie dans ARCHITECTURE.md.

## Relation avec la hierarchie documentaire
Ce document applique le Manifesto et prevaut sur le Design System, la Roadmap et l'Architecture pour tout sujet de parcours ou de comportement utilisateur.

## 1. Principes UX directeurs
1. Simplicite prioritaire
Justification : les usages frequents doivent etre fluides.

2. Intention claire
Regle : chaque parcours doit servir la question principale definie par le Manifesto.

3. Progressivite
Justification : proteger l'utilisateur des details inutiles.

4. Coherence inter-pages
Justification : la memorisation des patterns accelere l'usage.

5. Decision d'abord
Justification : Horizon est un outil de pilotage.

6. Responsive reel
Justification : mobile, tablette et desktop sont des contextes complets, pas des reductions du meme ecran.

## 2. Regles de navigation
1. La navigation principale doit rester stable entre mobile, tablette et desktop.
2. Le retour, la fermeture et l'abandon d'un parcours doivent etre predictibles.
3. Les parcours critiques doivent minimiser les ruptures de contexte.
4. Toute exception structurelle de navigation doit etre documentee dans HORIZON_DECISION_RECORDS.md.

## 3. Detail contextuel et drawers
1. Le drawer est le conteneur par defaut du detail contextuel.
2. Une page dediee, un dialogue ou une autre structure sont autorises si le besoin de partage d'URL, d'accessibilite, de lecture longue ou de workflow complexe le justifie.
3. Toute exception au drawer par defaut doit etre documentee dans HORIZON_DECISION_RECORDS.md.
4. La structure visuelle et la composition du drawer sont definies dans HORIZON_DESIGN_SYSTEM_V3.

## 4. Gestion des actions principales
1. Une action principale unique par ecran est la regle par defaut.
2. Une exception est possible si le parcours comporte des phases sequentielles explicites ou des exigences de securite distinctes.
3. Toute exception doit etre documentee dans HORIZON_DECISION_RECORDS.md.
4. La position et le libelle doivent rester stables et explicites.

## 5. Gestion des options avancees
1. Les options avancees sont repliees par defaut.
2. Une exception est possible si l'usage frequent, une obligation metier ou une contrainte de conformite impose leur visibilite immediate.
3. Toute exception doit etre documentee dans HORIZON_DECISION_RECORDS.md.
4. Le libelle doit etre clair et stable.

## 6. Nombre maximal de clics
### Cibles globales
- Creation simple : 3 a 5 clics.
- Consultation detail : 1 a 2 clics.
- Action corrective : 2 a 4 clics.
- Recherche ciblee : 1 a 3 clics.

### Seuil d'alerte UX
Si un parcours standard depasse 6 clics, il doit etre repense ou faire l'objet d'une exception documentee.

## 7. Parcours ideaux
### Creation d'une transaction
- Objectif : enregistrer un flux financier rapidement.
- Clics cibles : 4.
- Frictions typiques : trop de champs visibles.
- Orientation : mode simple par defaut.

### Creation d'un budget
- Objectif : definir un cadre de depense clair.
- Clics cibles : 4.
- Frictions typiques : ambiguite categorie et periodicite.
- Orientation : sections previsibles et lecture progressive.

### Creation d'un frais fixe
- Objectif : enregistrer une charge recurrente fiable.
- Clics cibles : 5.
- Frictions typiques : confusion entre saisie et audit.
- Orientation : creation simple, detail contextuel separe.

### Creation d'un referentiel
- Objectif : maintenir un vocabulaire financier propre.
- Clics cibles : 4.
- Frictions typiques : densite fonctionnelle.
- Orientation : ajout contextuel guide par type.

### Modification d'une transaction
- Objectif : corriger vite et sans risque.
- Clics cibles : 3.
- Frictions typiques : entree d'edition peu evidente.

### Modification d'un budget
- Objectif : ajuster montant ou periode.
- Clics cibles : 3.
- Frictions typiques : details disperses.

### Consultation detaillee
- Objectif : comprendre statut, causes et actions possibles.
- Clics cibles : 2.
- Orientation : detail contextuel unifie, lecture rapide puis approfondissement.

## 8. Recherche et filtres
1. Le champ de recherche doit etre visible en permanence sur les pages de liste.
2. Le nombre de resultats doit etre explicite.
3. La reinitialisation des filtres doit etre rapide.

## 9. Import
1. Le workflow doit etre etape par etape.
2. La validation doit intervenir avant confirmation finale.
3. Les erreurs doivent etre explicites et corrigibles.

## 10. Confirmations
1. Toute action destructive exige une confirmation.
2. Le texte de consequence doit etre concret.
3. L'option d'annulation doit rester visible.
4. Le rendu visuel du destructif est defini dans HORIZON_DESIGN_SYSTEM_V3.

## 11. Erreurs
1. Le message doit etre humain.
2. La cause probable doit etre indiquee si elle est connue.
3. Une action de reprise immediate doit etre proposee.
4. Les donnees saisies ne doivent pas etre perdues sans avertissement.

## 12. Etats vides
1. L'etat vide doit expliquer pourquoi rien n'est affiche.
2. Il doit proposer l'action la plus utile.
3. Il doit eviter les formulations vagues.

## 13. Formulaires
1. La validation doit etre en contexte.
2. Les messages d'erreur doivent etre lisibles.
3. Les valeurs par defaut doivent etre pertinentes.
4. Les champs optionnels doivent etre identifies clairement.
5. La structure visuelle des formulaires est definie dans HORIZON_DESIGN_SYSTEM_V3.

## 14. References constitutionnelles
Pour les regles amont ou aval :
- Vision, question principale et arbitrages produit : HORIZON_PRODUCT_MANIFESTO.
- Composition des cartes, KPI, drawers, toolbar, formulaires et etats : HORIZON_DESIGN_SYSTEM_V3.
- Priorisation des chantiers UX : HORIZON_PRODUCT_ROADMAP.
- Revue officielle avant sprint et Pull Request : HORIZON_REVIEW_CHECKLIST.md.
- Regime d'exception : HORIZON_DECISION_RECORDS.md.

## 15. Gouvernance UX
1. Toute nouvelle fonctionnalite passe par HORIZON_REVIEW_CHECKLIST.md.
2. Toute derogation UX doit etre tracee dans HORIZON_DECISION_RECORDS.md.
3. Toute dette UX detectee est tracee avec impact utilisateur et priorite.