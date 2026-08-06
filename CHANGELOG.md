# Journal des modifications

Ce fichier documente les évolutions notables de Horizon. Sa structure est
inspirée de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le
projet suit [Semantic Versioning](https://semver.org/lang/fr/).

## [Non publié]
Toutes les évolutions destinées aux utilisateurs doivent être ajoutées ici jusqu'à la prochaine release.
### Ajouté

- Moteur d'échéances pour les frais fixes avec statuts `transaction`, `forecast` et `anomaly`.
- Bouton de recalcul complet des associations de frais fixes.
- Tableau de santé global, timeline d'audit, mode preuve et export CSV pour l'audit visuel des frais fixes.

### Modifié

- Les prévisions de frais fixes ne s'additionnent plus à une transaction réelle sur la même échéance.
- Chaque frais fixe affiche désormais une preuve de réconciliation: nombre d'échéances, transactions, prévisions et anomalies.
- La page Frais fixes expose maintenant la transaction retenue, l'écart cumulé, les indicateurs de synchronisation et l'absence de doublon comptable en lecture immédiate.

### Corrigé

### Supprimé

### Sécurité

## Historique des versions

## [1.0.0-beta.1] - date à compléter lors de la release

### Ajouté

- Authentification avec Firebase Authentication.
- Isolation des données utilisateur par `ownerUid`.
- Gestion des transactions et import bancaire.
- Gestion des comptes, catégories et référentiels.
- Suivi des budgets et des objectifs.
- Prévisions financières.
- Gestion des frais fixes et revenus récurrents.
- Outils d'analyse financière.
- Lecture OCR de tickets.
- Saisie vocale.
- Application web progressive (PWA).

### Sécurité

- Règles Firestore limitant l'accès aux données de leur propriétaire.
- Tests automatisés de l'application et des règles Firestore.
