# ADR-0001 - Reference Model

## Statut

Accepte

## Contexte

Le code actuel d'Horizon manipule plusieurs dimensions de classement autour de la transaction:

- categories;
- subcategories;
- activities;
- projects;
- thirdParties.

Ces dimensions existent deja comme collections ou referentiels distincts dans Firestore et sont reliees aux transactions par identifiants explicites. Le code montre aussi que ces dimensions n'ont pas toutes le meme role:

- `categoryId` et `subcategoryId` servent au classement financier principal;
- `activityId` porte une lecture analytique transverse;
- `projectId` ajoute une dimension de suivi projet;
- `thirdPartyId` decrit l'entite en face du mouvement.

Le projet doit rester maintenable a long terme sans fusionner ces dimensions dans un seul champ ambigu.

## Decision

Horizon conserve un modele de referentiels separes:

- Categorie
- Sous-categorie
- Activite
- Projet
- Tiers

La transaction ne porte pas ces objets en structure imbriquee. Elle porte leurs identifiants et, selon les flux, des libelles de confort ou de compatibilite.

Les relations retenues dans le code actuel sont les suivantes:

- une sous-categorie reference une categorie;
- un projet peut referencer une activite;
- une transaction peut referencer independamment une categorie, une sous-categorie, une activite, un projet et un tiers.

Le tiers ne determine pas automatiquement la categorie.

## Consequences

- Le modele reste extensible sans casser la semantique des dimensions metier.
- Les filtres, l'analyse et les imports peuvent evoluer sans faire porter trop de sens a un seul champ.
- Les formulaires et imports doivent maintenir la coherence entre dimensions, en particulier entre categorie et sous-categorie.
- La documentation doit continuer a distinguer clairement ces dimensions.

## Alternatives rejetees

### Un seul champ de classification libre sur la transaction

Rejete car trop ambigu pour l'analyse, les filtres et la maintenance.

### Encapsuler tous les referentiels dans un seul objet imbrique sur la transaction

Rejete car cela augmenterait la duplication de donnees et rendrait les mises a jour de referentiels plus fragiles.

### Determiner automatiquement la categorie a partir du tiers

Rejete car contraire au code actuel et metierement trompeur: un meme tiers peut correspondre a des flux de nature differente.