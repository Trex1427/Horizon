# Horizon Review Checklist

Version : 1.0
Statut : Constitution officielle
Date : 2026-08-05
Derniere mise a jour : 2026-08-05

## Statut du document
Cette checklist est la grille officielle de revue avant toute Pull Request et avant toute cloture de sprint.

## Champ d'application
Cette checklist verifie la conformite d'une evolution avec la Constitution Horizon.

## Mode d'emploi
Chaque point doit etre evalue explicitement.
Si un point est non conforme, il doit etre corrige ou faire l'objet d'une entree dans HORIZON_DECISION_RECORDS.md.

## Checklist officielle
- [ ] Conforme au Manifesto
Explication : la modification respecte la vision, les valeurs, la question principale et les principes de gouvernance produit.

- [ ] Conforme UX
Explication : les parcours, la navigation, le detail contextuel, les actions principales et les erreurs suivent HORIZON_UX_GUIDELINES.

- [ ] Conforme Design System
Explication : les composants, cartes, KPI, drawers, toolbar, formulaires et etats respectent HORIZON_DESIGN_SYSTEM_V3.

- [ ] Conforme Architecture
Explication : l'implementation respecte l'organisation technique, les responsabilites de couches et les contraintes de ARCHITECTURE.md.

- [ ] Conforme Roadmap
Explication : l'evolution est alignee avec la priorisation officielle ou fait l'objet d'un arbitrage documente.

- [ ] Responsive
Explication : le comportement est valide sur mobile, tablette et desktop sans compression abusive de l'information.

- [ ] Accessibilite
Explication : contrastes, focus, labels et navigation clavier restent exploitables.

- [ ] Performance
Explication : la modification n'ajoute pas de cout inutile de chargement, de rendu ou d'interaction sur les parcours frequents.

- [ ] Drawer coherent
Explication : le detail contextuel utilise le drawer par defaut ou une exception documentee, et sa structure reste comprehensible.

- [ ] Une seule action principale
Explication : l'ecran expose une action principale unique par defaut, sauf exception documentee.

- [ ] Pas de duplication
Explication : aucune regle officielle n'est recopiee dans plusieurs documents ou plusieurs composants sans source de verite identifiee.

- [ ] Tests
Explication : les tests necessaires ont ete executes ou l'absence de test est justifiee explicitement.

- [ ] Documentation mise a jour
Explication : toute evolution qui change une regle, un parcours, un composant ou une priorite met a jour la documentation officielle correspondante.

- [ ] Dette technique creee ?
Explication : si une limite connue reste ouverte, elle est tracee avec impact, priorite et plan de suivi.

## Resultat de revue
- Decision finale : Approved | Changes requested | Blocked
- Relecteur :
- Date : YYYY-MM-DD
- Commentaires :
