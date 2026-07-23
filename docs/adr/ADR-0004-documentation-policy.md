# ADR-0004 - Documentation Policy

## Statut

Accepte

## Contexte

Horizon devient un projet logiciel de long terme avec:

- plusieurs collections Firestore;
- plusieurs domaines metier;
- une UI modulaire;
- une Cloud Function;
- une roadmap produit distincte de la reference technique.

Sans discipline documentaire, l'architecture reelle et la documentation divergent rapidement, ce qui augmente le cout de maintenance et le risque de mauvaises decisions.

## Decision

Toute evolution structurelle importante doit maintenir trois niveaux documentaires:

- `docs/ARCHITECTURE.md` pour la reference technique;
- `docs/HORIZON_V1_TECHNICAL_STATUS.md` pour le suivi d'etat et la priorisation;
- l'ADR concerne quand une decision d'architecture evolue.

Sont explicitement consideres comme changements structurels:

- une nouvelle collection Firestore;
- un changement de referentiel;
- une nouvelle relation metier;
- une nouvelle Cloud Function;
- un changement de pipeline d'import;
- un changement majeur d'architecture UI.

## Consequences

- La documentation devient une partie du travail de livraison, pas un artefact optionnel.
- Les nouveaux developpeurs disposent d'une reference technique plus fiable.
- Les choix structurants restent tracables dans le temps.
- Une modification d'architecture non documentee doit etre consideree comme incomplete.

## Alternatives rejetees

### Documenter seulement en commentaires de code

Rejete car insuffisant pour decrire les choix transverses et les relations entre modules.

### Garder une seule documentation produit

Rejete car un tableau de bord de sprint ne remplace pas une reference d'architecture.

### Ne documenter qu'apres coup quand il y a le temps

Rejete car cela cree mecaniquement du retard documentaire et des oublis de conception.