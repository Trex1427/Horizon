# ADR-0003 - Import Pipeline

## Statut

Accepte

## Contexte

Le module `src/features/bankingImport/` montre un pipeline d'import bancaire en plusieurs etapes:

- detection du format;
- parsing;
- normalisation;
- previsualisation;
- validation;
- commit Firestore;
- historisation de l'import.

Le code confirme aussi que tous les formats detectes ne sont pas encore supportes jusqu'au commit. Le CSV est aujourd'hui le flux complet expose dans l'interface.

## Decision

L'import bancaire doit rester un pipeline explicite en plusieurs etapes, et non un enregistrement direct en base apres lecture brute du fichier.

Les etapes retenues sont:

1. Detection
2. Parser
3. Normalisation
4. Previsualisation
5. Validation
6. Commit
7. Historique d'import

Chaque etape a un role distinct:

- la detection choisit le bon traitement;
- le parser extrait une structure exploitable;
- la normalisation produit un contrat interne stable;
- la previsualisation montre ce qui sera importe;
- la validation laisse l'utilisateur corriger, ignorer ou confirmer;
- le commit ecrit en Firestore avec journalisation;
- l'historique permet la tracabilite.

## Consequences

- L'import reste auditable et corrigeable avant ecriture.
- Les doublons, lignes incompletes et candidats transfert peuvent etre traites proprement.
- Le support de nouveaux formats peut se brancher sur un pipeline deja stabilise.
- Le frontend ne doit pas contourner la previsualisation et la validation pour ecrire directement en Firestore.

## Alternatives rejetees

### Import direct sans previsualisation

Rejete car trop risqué pour les doublons, les mappings ambigus et les erreurs de format.

### Un parser par format qui ecrit lui-meme en base

Rejete car cela dupliquerait la logique de validation et de commit.

### Convertir automatiquement tous les candidats transfert pendant l'import

Rejete car contraire a la regle de confirmation explicite deja presente dans le code.