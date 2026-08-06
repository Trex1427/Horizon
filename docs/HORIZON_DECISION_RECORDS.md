# Horizon Decision Records

Version : 1.0
Statut : Constitution officielle
Date : 2026-08-05
Derniere mise a jour : 2026-08-05

## Statut du document
Ce document est le registre officiel des exceptions et des decisions de gouvernance de la Constitution Horizon.

## Champ d'application
Ce document definit :
- quand une exception doit etre creee ;
- le format obligatoire d'une decision ;
- les responsabilites d'auteur et de validation ;
- la duree et le suivi d'une exception.

Ce document ne redefinit pas les regles produit, UX, design, roadmap ou architecture. Il trace uniquement les deviations, arbitrages et validations associes.

## Objectif
Permettre des exceptions strictement controlees sans casser la coherence de la Constitution Horizon.

## Quand creer une exception
Une decision doit etre creee si une evolution :
- contredit une regle du Manifesto ;
- deroge a une regle UX officielle ;
- deroge a une composition ou primitive du Design System ;
- modifie temporairement une priorite roadmap ;
- impose une contrainte technique exceptionnelle ;
- introduit un cas limite qui ne peut pas etre traite sans arbitrage formel.

## Regles de gouvernance
1. Aucune exception implicite n'est autorisee.
2. Une exception doit etre redigee avant implementation ou avant validation de sprint.
3. Une exception doit citer la regle officielle concernee.
4. Une exception doit avoir une duree explicite ou etre declaree permanente.
5. Une exception sans validation formelle est consideree comme non approuvee.

## Format obligatoire
Chaque decision doit contenir :
- identifiant ;
- titre ;
- statut ;
- document source impacte ;
- regle concernee ;
- auteur ;
- date ;
- justification ;
- impact ;
- duree ;
- validation ;
- plan de sortie ou de reevaluation.

## Statuts autorises
- Proposed
- Approved
- Rejected
- Expired
- Superseded

## Validation
Validation minimale attendue :
- auteur de la demande ;
- responsable produit ou design si la regle impactee est produit, UX ou design ;
- responsable technique si la regle impactee est architecture ou implementation ;
- date de validation.

## Modele reutilisable

```markdown
## HDR-XXX - Titre court
- Statut : Proposed | Approved | Rejected | Expired | Superseded
- Document source impacte : HORIZON_PRODUCT_MANIFESTO | HORIZON_UX_GUIDELINES | HORIZON_DESIGN_SYSTEM_V3 | HORIZON_PRODUCT_ROADMAP | ARCHITECTURE.md
- Regle concernee :
- Auteur :
- Date : YYYY-MM-DD
- Validation :
- Duree : temporaire | permanente

### Objectif

### Justification

### Impact
- Produit :
- UX :
- Design :
- Technique :
- Documentation :

### Decision

### Plan de sortie ou reevaluation

### Historique
- YYYY-MM-DD : creation
```

## Registre des decisions
Aucune decision enregistree pour le moment.
