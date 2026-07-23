# ADR-0002 - Transfer Model

## Statut

Accepte

## Contexte

Horizon suit des transactions financieres et des soldes par compte. Le code actuel contient un module `transfers` distinct des transactions classiques.

Les calculs de soldes dans `financeCalculations` et les validations dans `transferValidation` montrent qu'un transfert:

- deplace un montant entre deux comptes Horizon;
- ne cree pas de revenu;
- ne cree pas de depense;
- ne doit pas modifier le patrimoine net global.

Le flux d'import bancaire sait egalement convertir certaines lignes en transferts, mais uniquement apres confirmation explicite.

## Decision

Un transfert interne n'est pas une transaction standard. Il est stocke dans la collection `transfers`, separement de la collection `transactions`.

Il porte son propre modele:

- `sourceAccountId`
- `destinationAccountId`
- `amount`
- `date`
- metadonnees de description, import et validation.

Les budgets, les analyses de depenses et les categories ne doivent pas traiter un transfert comme une depense.

## Consequences

- Les calculs de budgets et de consommation ne sont pas pollues par des virements internes.
- Les soldes par compte restent justes.
- L'import bancaire doit conserver une etape de confirmation pour les candidats transfert.
- Toute tentative de modeliser un virement interne comme transaction classique doit etre consideree comme une regression d'architecture.

## Alternatives rejetees

### Stocker un transfert comme deux transactions

Rejete car cela fausserait les statistiques de revenus et de depenses et complexifierait la detection des virements internes.

### Stocker un transfert comme une transaction unique de type special dans `transactions`

Rejete car cela melangerait deux semantiques incompatibles dans la meme collection et propagerait des cas particuliers dans les budgets, le dashboard et les imports.

### Auto-convertir tout libelle contenant "virement"

Rejete car le code actuel distingue explicitement des contextes de virements externes et exige une confirmation utilisateur.