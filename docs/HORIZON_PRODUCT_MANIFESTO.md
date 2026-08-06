# Horizon Product Manifesto

Version : 1.0
Statut : Constitution officielle
Date : 2026-08-05
Derniere mise a jour : 2026-08-05

## Statut du document
Ce document est la source de verite constitutionnelle de Horizon.

Il definit la vision, la mission, les valeurs et les principes produit qui priment sur tous les autres documents Horizon.

## Champ d'application
Le Manifesto definit :
- la vision produit ;
- la mission ;
- les valeurs fondamentales ;
- les principes de gouvernance produit ;
- les limites du produit.

Le Manifesto ne definit pas en detail :
- les parcours UX, definis dans HORIZON_UX_GUIDELINES ;
- les composants et primitives visuelles, definis dans HORIZON_DESIGN_SYSTEM_V3 ;
- les priorites et horizons d'execution, definis dans HORIZON_PRODUCT_ROADMAP ;
- l'implementation technique, definie dans ARCHITECTURE.md.

## Hierarchie documentaire
Ordre officiel de priorite documentaire :
1. HORIZON_PRODUCT_MANIFESTO
2. HORIZON_UX_GUIDELINES
3. HORIZON_DESIGN_SYSTEM_V3
4. HORIZON_PRODUCT_ROADMAP
5. HORIZON_ARCHITECTURE, porte dans ARCHITECTURE.md

Role de chaque document :
- HORIZON_PRODUCT_MANIFESTO : vision, principes et arbitrages produit.
- HORIZON_UX_GUIDELINES : parcours, comportements et regles d'interaction.
- HORIZON_DESIGN_SYSTEM_V3 : composants, primitives visuelles et composition d'ecran.
- HORIZON_PRODUCT_ROADMAP : priorisation et horizons d'evolution.
- ARCHITECTURE.md : implementation technique et contraintes d'execution.

Regle de precedence :
En cas de conflit, le document le plus haut dans la hierarchie prevaut.

## Pourquoi Horizon existe
Horizon existe pour transformer la gestion financiere quotidienne en pilotage clair, calme et concret.

Mission produit:
- Donner une vision fiable de la situation financiere reelle.
- Aider a prendre de meilleures decisions plus vite.
- Reduire la charge mentale liee a l'argent.

Probleme resolu:
- Les outils financiers sont soit trop complexes, soit trop superficiels.
- Les utilisateurs voient des chiffres mais ne savent pas toujours quoi faire.
- La navigation entre depenses, budgets, previsions et actions est souvent fragmentee.

Pourquoi choisir Horizon:
- Parce qu'il priorise la decision plutot que la decoration.
- Parce qu'il reste comprehensible meme avec beaucoup de donnees.
- Parce qu'il permet d'agir en quelques gestes sans devenir comptable.

## Vision
Vision a 5-10 ans:
- Devenir la reference du pilotage financier personnel et operationnel leger.
- Etre l'outil que l'on ouvre chaque jour pour savoir quoi faire maintenant.
- Offrir une experience de grande qualite, stable, explicable et durable.

Horizon ne veut pas tout couvrir.
Horizon veut exceller sur un objectif : aider a decider juste, vite et sereinement.

## Les emotions attendues
Les emotions sont un objectif produit, pas un effet marketing.

1. Calme
Justification : la finance est anxiogene ; l'interface doit apaiser.
Cas d'usage : un utilisateur consulte son dashboard avant une journee chargee.

2. Maitrise
Justification : l'utilisateur doit comprendre les causes, pas seulement les resultats.
Cas d'usage : depassement budgetaire detecte et explique.

3. Confiance
Justification : une donnee incoherente casse l'adoption.
Cas d'usage : comparaison budget vs transactions sans ecart de logique.

4. Anticipation
Justification : piloter, c'est voir avant de subir.
Cas d'usage : tension de tresorerie detectee avant la fin de mois.

5. Rapidite
Justification : une bonne decision ne doit pas exiger un parcours long.
Cas d'usage : ajout d'une transaction en situation mobile.

6. Premium utile
Justification : la qualite percue renforce la confiance dans le produit.
Cas d'usage : consultation frequente sans fatigue cognitive.

## Valeurs fondamentales
1. Clarte
Une information doit etre comprise en quelques secondes.

2. Coherence
Un meme pattern doit produire la meme attente partout.

3. Fiabilite
Une donnee affichee doit etre juste, stable et explicable.

4. Previsibilite
Le produit doit se comporter de facon constante.

5. Sobriete
Moins de bruit, plus de signal.

6. Rapidite
Le produit doit accelerer la decision.

7. Responsabilite
Chaque ecran et chaque action doivent avoir une utilite concrete.

## Ce que Horizon refuse d'etre
Horizon n'est pas :
- un logiciel de comptabilite generale ;
- un ERP ;
- un tableur graphique ;
- une application de reporting decoratif ;
- un produit qui multiplie les options au detriment de la clarte.

## Principes fondateurs
1. Une page = une question
Justification : eviter les ecrans fourre-tout.
Cas d'usage : revue rapide hebdomadaire.

2. Scan rapide puis comprehension detaillee
Justification : l'utilisateur doit comprendre vite, puis approfondir sans rupture.
Regle d'application : les parcours detailles sont definis dans HORIZON_UX_GUIDELINES ; la composition des composants de scan et de detail est definie dans HORIZON_DESIGN_SYSTEM_V3.

3. La simplicite est une fonctionnalite
Justification : elle diminue erreurs, temps et anxiete.
Regle d'application : les cibles de parcours et les exceptions d'interaction sont definies dans HORIZON_UX_GUIDELINES.

4. Les graphiques servent a decider
Justification : un graphique inutile est une dette produit.

5. Coherence avant nouveaute
Justification : la confiance vient de la constance.

## Les questions auxquelles chaque page repond
- Dashboard : Quelle est ma situation maintenant et quel signal prioritaire traiter ?
- Transactions : Qu'est-ce qui est entre, sorti, et comment l'expliquer clairement ?
- Budgets : Suis-je dans mon cadre de depense et ou ajuster ?
- Previsions : Que va-t-il se passer si la trajectoire actuelle continue ?
- Analyse : Quelles tendances expliquent mes resultats et quelles decisions en decoulent ?
- Frais fixes : Mes charges recurrentes sont-elles sous controle et bien reconcilees ?
- Revenus recurrents : Quels revenus sont fiables et quelle projection en attendre ?
- Referentiels : Mon langage financier est-il propre, coherent et exploitable ?
- Objectifs : Suis-je en avance, a l'equilibre ou en retard sur mes cibles ?
- Travail : Quelle est la sante economique de mes activites operationnelles ?
- Vehicules : Quel est le cout reel de mobilite et comment l'optimiser ?
- Devis : Quelles opportunites peuvent devenir du revenu, quand et avec quel risque ?
- Factures : Qu'est-ce qui doit etre encaisse, relance ou securise immediatement ?

## Regles produit non negociables
1. Ne jamais complexifier une tache simple.
2. Ne jamais afficher une information sans utilite decisionnelle.
3. Toujours rendre une decision comprehensible.
4. Toujours conserver des libelles stables et humains.
5. Toujours privilegier la coherence inter-pages.
6. Toujours reduire la friction sur les parcours frequents.
7. Toute exception a une regle officielle doit etre documentee dans HORIZON_DECISION_RECORDS.md.

## Gouvernance des references
Source de verite par categorie de regles :
- Vision, valeurs, principes, limites : ce document.
- Parcours, navigation, action principale, options avancees, gestion des erreurs et etats : HORIZON_UX_GUIDELINES.
- Cartes, KPI, drawers, toolbar, formulaires, composants et primitives visuelles : HORIZON_DESIGN_SYSTEM_V3.
- Priorisation, jalons, criteres d'entree et de sortie : HORIZON_PRODUCT_ROADMAP.
- Implementation, structure du code et contraintes techniques : ARCHITECTURE.md.

## Criteres de decision produit
Checklist obligatoire avant toute evolution :
1. Est-ce coherent avec ce Manifesto ?
2. Est-ce utile au pilotage financier reel ?
3. Est-ce plus simple que l'etat actuel ?
4. Est-ce comprehensible sans formation ?
5. Est-ce coherent avec HORIZON_UX_GUIDELINES ?
6. Est-ce coherent avec HORIZON_DESIGN_SYSTEM_V3 ?
7. Est-ce soutenable sur mobile, tablette et desktop ?
8. Le benefice utilisateur est-il superieur au cout cognitif ?
9. Une exception formelle est-elle necessaire ? Si oui, est-elle tracee dans HORIZON_DECISION_RECORDS.md ?

Regle de gouvernance :
Si une reponse est non, l'evolution est repensee avant priorisation.

## Engagement constitutionnel
Ce document est la base de gouvernance produit de Horizon.

A partir de ce jour :
- aucun nouvel ecran ne doit contredire ces principes ;
- aucune fonctionnalite ne doit contourner ces criteres ;
- toute exception doit etre explicite, motivee, datee et validee dans HORIZON_DECISION_RECORDS.md ;
- toute revue documentaire ou produit doit s'appuyer sur HORIZON_REVIEW_CHECKLIST.md.