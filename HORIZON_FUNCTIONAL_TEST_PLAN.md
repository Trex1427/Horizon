# HORIZON 1.0 - Functional Test Plan

Date: 2026-08-02

## Objectif

Préparer une campagne complète de validation fonctionnelle avant Horizon Polish.

Ce document sert uniquement de plan de test et de registre de résultats.

Contraintes de campagne:

- aucun changement métier
- aucune modification de Firestore, des hooks, des services, des calculs métier ou de l'authentification
- aucune modification de l'interface
- aucun polish

## Critères de réussite globaux

La validation est considérée comme réussie si:

- chaque écran listé ci-dessous a été vérifié sur les points de base de son cycle de vie
- les erreurs bloquantes sont absentes ou documentées avec un plan de correction
- les états vides, de chargement et d'erreur sont cohérents et compréhensibles
- les actions de création, modification, suppression et consultation se comportent comme attendu lorsqu'elles sont disponibles
- les comportements multi-utilisateur, PWA et responsive sont validés ou explicitement notés comme non pris en charge

## Mode d'enregistrement des résultats

Pour chaque test, noter:

- statut: Pass, Fail, N/A
- environnement: navigateur, appareil, taille d'écran, compte utilisé
- observation courte
- référence éventuelle à une capture, un log ou un ticket

### Modèle de saisie

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| ... | Pass / Fail / N/A | ... | ... |

---

## Checklist par écran

### Dashboard

- affichage
- création si une action de création est exposée depuis le tableau de bord
- modification si applicable
- suppression si applicable
- recherche si présente
- filtres si présents
- tri si présent
- responsive
- dialogues
- messages d'erreur
- états vides
- chargement

Résultats:

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Dashboard - affichage |  |  |  |
| Dashboard - création |  |  |  |
| Dashboard - modification |  |  |  |
| Dashboard - suppression |  |  |  |
| Dashboard - recherche |  |  |  |
| Dashboard - filtres |  |  |  |
| Dashboard - tri |  |  |  |
| Dashboard - responsive |  |  |  |
| Dashboard - dialogues |  |  |  |
| Dashboard - messages d'erreur |  |  |  |
| Dashboard - états vides |  |  |  |
| Dashboard - chargement |  |  |  |

### Transactions

- affichage
- création
- modification
- suppression si disponible
- recherche
- filtres
- tri
- responsive
- dialogues
- messages d'erreur
- états vides
- chargement

Résultats:

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Transactions - affichage |  |  |  |
| Transactions - création |  |  |  |
| Transactions - modification |  |  |  |
| Transactions - suppression |  |  |  |
| Transactions - recherche |  |  |  |
| Transactions - filtres |  |  |  |
| Transactions - tri |  |  |  |
| Transactions - responsive |  |  |  |
| Transactions - dialogues |  |  |  |
| Transactions - messages d'erreur |  |  |  |
| Transactions - états vides |  |  |  |
| Transactions - chargement |  |  |  |

### Comptes

- affichage
- création
- modification
- suppression si disponible
- recherche
- filtres
- tri
- responsive
- dialogues
- messages d'erreur
- états vides
- chargement

Résultats:

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Comptes - affichage |  |  |  |
| Comptes - création |  |  |  |
| Comptes - modification |  |  |  |
| Comptes - suppression |  |  |  |
| Comptes - recherche |  |  |  |
| Comptes - filtres |  |  |  |
| Comptes - tri |  |  |  |
| Comptes - responsive |  |  |  |
| Comptes - dialogues |  |  |  |
| Comptes - messages d'erreur |  |  |  |
| Comptes - états vides |  |  |  |
| Comptes - chargement |  |  |  |

### Budgets

- affichage
- création
- modification
- suppression si disponible
- recherche
- filtres
- tri
- responsive
- dialogues
- messages d'erreur
- états vides
- chargement

Résultats:

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Budgets - affichage |  |  |  |
| Budgets - création |  |  |  |
| Budgets - modification |  |  |  |
| Budgets - suppression |  |  |  |
| Budgets - recherche |  |  |  |
| Budgets - filtres |  |  |  |
| Budgets - tri |  |  |  |
| Budgets - responsive |  |  |  |
| Budgets - dialogues |  |  |  |
| Budgets - messages d'erreur |  |  |  |
| Budgets - états vides |  |  |  |
| Budgets - chargement |  |  |  |

### Prévisions

- affichage
- création si disponible
- modification si disponible
- suppression si disponible
- recherche si présente
- filtres
- tri si présent
- responsive
- dialogues
- messages d'erreur
- états vides
- chargement

Résultats:

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Prévisions - affichage |  |  |  |
| Prévisions - création |  |  |  |
| Prévisions - modification |  |  |  |
| Prévisions - suppression |  |  |  |
| Prévisions - recherche |  |  |  |
| Prévisions - filtres |  |  |  |
| Prévisions - tri |  |  |  |
| Prévisions - responsive |  |  |  |
| Prévisions - dialogues |  |  |  |
| Prévisions - messages d'erreur |  |  |  |
| Prévisions - états vides |  |  |  |
| Prévisions - chargement |  |  |  |

### Analyse

- affichage
- création si disponible
- modification si disponible
- suppression si disponible
- recherche
- filtres
- tri
- responsive
- dialogues
- messages d'erreur
- états vides
- chargement

Résultats:

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Analyse - affichage |  |  |  |
| Analyse - création |  |  |  |
| Analyse - modification |  |  |  |
| Analyse - suppression |  |  |  |
| Analyse - recherche |  |  |  |
| Analyse - filtres |  |  |  |
| Analyse - tri |  |  |  |
| Analyse - responsive |  |  |  |
| Analyse - dialogues |  |  |  |
| Analyse - messages d'erreur |  |  |  |
| Analyse - états vides |  |  |  |
| Analyse - chargement |  |  |  |

### Rapports

- affichage
- création si disponible
- modification si disponible
- suppression si disponible
- recherche
- filtres
- tri
- responsive
- dialogues
- messages d'erreur
- états vides
- chargement

Résultats:

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Rapports - affichage |  |  |  |
| Rapports - création |  |  |  |
| Rapports - modification |  |  |  |
| Rapports - suppression |  |  |  |
| Rapports - recherche |  |  |  |
| Rapports - filtres |  |  |  |
| Rapports - tri |  |  |  |
| Rapports - responsive |  |  |  |
| Rapports - dialogues |  |  |  |
| Rapports - messages d'erreur |  |  |  |
| Rapports - états vides |  |  |  |
| Rapports - chargement |  |  |  |

### Objectifs

- affichage
- création
- modification
- suppression si disponible
- recherche
- filtres
- tri
- responsive
- dialogues
- messages d'erreur
- états vides
- chargement

Résultats:

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Objectifs - affichage |  |  |  |
| Objectifs - création |  |  |  |
| Objectifs - modification |  |  |  |
| Objectifs - suppression |  |  |  |
| Objectifs - recherche |  |  |  |
| Objectifs - filtres |  |  |  |
| Objectifs - tri |  |  |  |
| Objectifs - responsive |  |  |  |
| Objectifs - dialogues |  |  |  |
| Objectifs - messages d'erreur |  |  |  |
| Objectifs - états vides |  |  |  |
| Objectifs - chargement |  |  |  |

### Revenus récurrents

- affichage
- création
- modification
- suppression si disponible
- recherche
- filtres
- tri
- responsive
- dialogues
- messages d'erreur
- états vides
- chargement

Résultats:

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Revenus récurrents - affichage |  |  |  |
| Revenus récurrents - création |  |  |  |
| Revenus récurrents - modification |  |  |  |
| Revenus récurrents - suppression |  |  |  |
| Revenus récurrents - recherche |  |  |  |
| Revenus récurrents - filtres |  |  |  |
| Revenus récurrents - tri |  |  |  |
| Revenus récurrents - responsive |  |  |  |
| Revenus récurrents - dialogues |  |  |  |
| Revenus récurrents - messages d'erreur |  |  |  |
| Revenus récurrents - états vides |  |  |  |
| Revenus récurrents - chargement |  |  |  |

### Frais fixes

- affichage
- création
- modification
- suppression si disponible
- recherche
- filtres
- tri
- responsive
- dialogues
- messages d'erreur
- états vides
- chargement

Résultats:

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Frais fixes - affichage |  |  |  |
| Frais fixes - création |  |  |  |
| Frais fixes - modification |  |  |  |
| Frais fixes - suppression |  |  |  |
| Frais fixes - recherche |  |  |  |
| Frais fixes - filtres |  |  |  |
| Frais fixes - tri |  |  |  |
| Frais fixes - responsive |  |  |  |
| Frais fixes - dialogues |  |  |  |
| Frais fixes - messages d'erreur |  |  |  |
| Frais fixes - états vides |  |  |  |
| Frais fixes - chargement |  |  |  |

### Dettes & créances

- affichage
- création
- modification
- suppression si disponible
- recherche
- filtres
- tri
- responsive
- dialogues
- messages d'erreur
- états vides
- chargement

Résultats:

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Dettes & créances - affichage |  |  |  |
| Dettes & créances - création |  |  |  |
| Dettes & créances - modification |  |  |  |
| Dettes & créances - suppression |  |  |  |
| Dettes & créances - recherche |  |  |  |
| Dettes & créances - filtres |  |  |  |
| Dettes & créances - tri |  |  |  |
| Dettes & créances - responsive |  |  |  |
| Dettes & créances - dialogues |  |  |  |
| Dettes & créances - messages d'erreur |  |  |  |
| Dettes & créances - états vides |  |  |  |
| Dettes & créances - chargement |  |  |  |

### Véhicules

- affichage
- création
- modification
- suppression si disponible
- recherche
- filtres
- tri
- responsive
- dialogues
- messages d'erreur
- états vides
- chargement

Résultats:

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Véhicules - affichage |  |  |  |
| Véhicules - création |  |  |  |
| Véhicules - modification |  |  |  |
| Véhicules - suppression |  |  |  |
| Véhicules - recherche |  |  |  |
| Véhicules - filtres |  |  |  |
| Véhicules - tri |  |  |  |
| Véhicules - responsive |  |  |  |
| Véhicules - dialogues |  |  |  |
| Véhicules - messages d'erreur |  |  |  |
| Véhicules - états vides |  |  |  |
| Véhicules - chargement |  |  |  |

### Travail

- affichage
- création
- modification
- suppression si disponible
- recherche
- filtres
- tri
- responsive
- dialogues
- messages d'erreur
- états vides
- chargement

Résultats:

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Travail - affichage |  |  |  |
| Travail - création |  |  |  |
| Travail - modification |  |  |  |
| Travail - suppression |  |  |  |
| Travail - recherche |  |  |  |
| Travail - filtres |  |  |  |
| Travail - tri |  |  |  |
| Travail - responsive |  |  |  |
| Travail - dialogues |  |  |  |
| Travail - messages d'erreur |  |  |  |
| Travail - états vides |  |  |  |
| Travail - chargement |  |  |  |

### Devis

- affichage
- création
- modification
- suppression si disponible
- recherche
- filtres
- tri
- responsive
- dialogues
- messages d'erreur
- états vides
- chargement

Résultats:

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Devis - affichage |  |  |  |
| Devis - création |  |  |  |
| Devis - modification |  |  |  |
| Devis - suppression |  |  |  |
| Devis - recherche |  |  |  |
| Devis - filtres |  |  |  |
| Devis - tri |  |  |  |
| Devis - responsive |  |  |  |
| Devis - dialogues |  |  |  |
| Devis - messages d'erreur |  |  |  |
| Devis - états vides |  |  |  |
| Devis - chargement |  |  |  |

### Factures

- affichage
- création
- modification
- suppression si disponible
- recherche
- filtres
- tri
- responsive
- dialogues
- messages d'erreur
- états vides
- chargement

Résultats:

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Factures - affichage |  |  |  |
| Factures - création |  |  |  |
| Factures - modification |  |  |  |
| Factures - suppression |  |  |  |
| Factures - recherche |  |  |  |
| Factures - filtres |  |  |  |
| Factures - tri |  |  |  |
| Factures - responsive |  |  |  |
| Factures - dialogues |  |  |  |
| Factures - messages d'erreur |  |  |  |
| Factures - états vides |  |  |  |
| Factures - chargement |  |  |  |

### Paramètres

- affichage
- création si des éléments paramétrables le permettent
- modification
- suppression si disponible
- recherche si présente
- filtres si présents
- tri si présent
- responsive
- dialogues
- messages d'erreur
- états vides
- chargement

Résultats:

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Paramètres - affichage |  |  |  |
| Paramètres - création |  |  |  |
| Paramètres - modification |  |  |  |
| Paramètres - suppression |  |  |  |
| Paramètres - recherche |  |  |  |
| Paramètres - filtres |  |  |  |
| Paramètres - tri |  |  |  |
| Paramètres - responsive |  |  |  |
| Paramètres - dialogues |  |  |  |
| Paramètres - messages d'erreur |  |  |  |
| Paramètres - états vides |  |  |  |
| Paramètres - chargement |  |  |  |

---

## Checklist Multi-utilisateur

### Scénario

- connexion avec deux comptes Google distincts
- isolation des données entre les deux comptes
- synchronisation des données après modification depuis un autre appareil ou une autre session
- rafraîchissement de la page après changement de données
- déconnexion puis reconnexion avec le même compte
- déconnexion d'un compte puis connexion du second compte
- changements simultanés si le module supporte plusieurs écritures concurrentes

### Résultats

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Multi-utilisateur - connexion compte 1 |  |  |  |
| Multi-utilisateur - connexion compte 2 |  |  |  |
| Multi-utilisateur - isolation des données |  |  |  |
| Multi-utilisateur - synchronisation |  |  |  |
| Multi-utilisateur - rafraîchissement |  |  |  |
| Multi-utilisateur - déconnexion / reconnexion |  |  |  |
| Multi-utilisateur - changement simultané |  |  |  |

---

## Checklist PWA

### Scénario

- installation de l'application
- lancement depuis l'écran d'accueil ou le menu système
- rafraîchissement après installation
- mode hors ligne si pris en charge
- mise à jour après nouvelle version
- icône affichée correctement
- splash screen affiché correctement

### Résultats

| Test | Statut | Observation | Référence |
| --- | --- | --- | --- |
| PWA - installation |  |  |  |
| PWA - lancement |  |  |  |
| PWA - rafraîchissement |  |  |  |
| PWA - mode hors ligne |  |  |  |
| PWA - mise à jour |  |  |  |
| PWA - icône |  |  |  |
| PWA - splash screen |  |  |  |

---

## Checklist Responsive

### Résolutions à valider

- 390 px
- 768 px
- 1024 px
- 1440 px

### Points de contrôle

- lisibilité des textes
- accessibilité des actions principales
- absence de débordement horizontal
- cohérence des dialogues et overlays
- navigation correcte
- tableaux, cartes et listes exploitables
- zones tactiles suffisantes sur mobile

### Résultats

| Vue | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Responsive - 390 px |  |  |  |
| Responsive - 768 px |  |  |  |
| Responsive - 1024 px |  |  |  |
| Responsive - 1440 px |  |  |  |

---

## Synthèse de campagne

| Domaine | Statut | Observation | Référence |
| --- | --- | --- | --- |
| Dashboard |  |  |  |
| Transactions |  |  |  |
| Comptes |  |  |  |
| Budgets |  |  |  |
| Prévisions |  |  |  |
| Analyse |  |  |  |
| Rapports |  |  |  |
| Objectifs |  |  |  |
| Revenus récurrents |  |  |  |
| Frais fixes |  |  |  |
| Dettes & créances |  |  |  |
| Véhicules |  |  |  |
| Travail |  |  |  |
| Devis |  |  |  |
| Factures |  |  |  |
| Paramètres |  |  |  |
| Multi-utilisateur |  |  |  |
| PWA |  |  |  |
| Responsive |  |  |  |

## Notes complémentaires

- Si un écran ne propose pas l'une des actions listées, marquer le test en N/A et expliquer brièvement pourquoi.
- Si une fonctionnalité est accessible uniquement dans un sous-flux, tester le point depuis le flux principal et depuis le sous-flux si applicable.
- Toute régression bloquante doit être documentée avec le contexte exact de reproduction.