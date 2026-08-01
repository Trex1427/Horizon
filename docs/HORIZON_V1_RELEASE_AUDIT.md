# Audit de préparation Horizon 1.0

Date : 2026-08-01

## Décisions du mini-sprint

Ce mini-sprint ne crée aucune fonctionnalité. Il retire uniquement le code orphelin confirmé, nettoie les erreurs ESLint triviales et documente les décisions restantes. Aucune collection, règle, requête ou donnée Firestore n'a été supprimée ou migrée.

## Opportunités

La navigation utilisateur vers Opportunités est absente de la navigation principale et secondaire. `PAGES.OPPORTUNITES` et le slug `opportunites` sont conservés afin qu'une ancienne URL reste résoluble. La page est chargée paresseusement : son listener Firestore ne démarre que si cette route historique est effectivement ouverte.

Sont conservés pour compatibilité historique :

- `src/pages/Opportunites.jsx` ;
- `src/components/OpportunityCard.jsx` et `src/components/OpportunityForm.jsx` ;
- `src/hooks/useOpportunities.js` et `src/services/opportunitiesService.js` ;
- les services de liaison opportunité/transaction et les champs historiques associés ;
- les calculs et tests historiques qui savent encore lire une opportunité ;
- `PAGES.OPPORTUNITES`, le slug `opportunites`, les règles et la collection Firestore.

Aucun import ni listener Opportunités inutile n'a été trouvé dans les pages courantes. Le cockpit et les prévisions ne s'abonnent plus aux opportunités. Aucun code de navigation Opportunités supplémentaire n'était présent à supprimer.

## Fichiers orphelins supprimés

Le graphe d'imports de production ne contient aucune référence vers les fichiers suivants. Les composants `FinancialDashboard`, `CategorySummary` et `SummaryCard` formaient uniquement un sous-graphe isolé. Les autres assets n'étaient référencés ni par le code, ni par `index.html`, ni par la configuration PWA.

- `src/pages/Dashboard.jsx`
- `src/pages/ProfessionalDashboard.jsx`
- `src/components/Header.jsx`
- `src/components/BottomNavigation.jsx`
- `src/components/CardBudget.jsx`
- `src/components/FinancialDashboard.jsx`
- `src/components/CategorySummary.jsx`
- `src/components/SummaryCard.jsx`
- `src/assets/firebase.js`
- `src/assets/react.svg`
- `src/assets/vite.svg`
- `public/pwa/scanner-test.png`

Les icônes PWA réellement déclarées (`public/pwa/icon-192.svg` et `public/pwa/icon-512.svg`), le favicon et le manifeste sont conservés.

## Logs

Aucun `console.log` n'était présent dans `src`; la liste exacte des `console.log` supprimés est donc vide. Les `console.error` de Firebase, dates, projets et traitements de transactions sont conservés car ils signalent des échecs importants. Les `console.warn` de stockage local sont conservés. Les diagnostics structurés `console.info` de Firebase, OCR/reçu et import bancaire sont conservés car ils décrivent le mode de connexion ou des étapes techniques utiles au diagnostic, sans exposer de contenu financier complet.

## ESLint

Seules des corrections mécaniques ont été réalisées : imports et paramètres inutilisés, variables inutilisées, directives globales redondantes, et déclaration des constantes injectées par Vite. Les erreurs React Hooks, React Refresh et les dépendances de hooks non évidentes sont volontairement laissées pour un sprint dédié, sans refactoring massif.

## Firestore Offline

La persistance Firestore durable n'est pas activée : l'application utilise `getFirestore(app)` sans `persistentLocalCache`, `persistentMultipleTabManager` ni ancien appel `enableIndexedDbPersistence`. Aucun code Firebase n'a été modifié.

Recommandation : ne pas activer la persistance pour Horizon 1.0 sans conception et tests dédiés.

Avantages potentiels : lecture des dernières données mises en cache hors connexion, écritures mises en attente puis synchronisées, et expérience PWA plus cohérente quand le réseau est instable.

Risques : données financières durables sur un appareil partagé, cache restant après déconnexion si sa purge n'est pas explicitement conçue, résolution des écritures concurrentes selon le modèle Firestore, interface montrant temporairement des données obsolètes, et complexité de support accrue.

Impact multi-utilisateur : la synchronisation hors ligne peut rejouer plus tard les écritures de plusieurs appareils. Les règles de sécurité continuent de s'appliquer côté serveur, mais elles ne remplacent pas une stratégie de conflits, d'indication des écritures en attente et de séparation/purge du cache lors d'un changement de compte.

Impact PWA : le service worker met déjà en cache le shell applicatif, pas les données Firestore. Activer le cache Firestore rendrait la PWA réellement consultable avec les dernières données locales hors ligne, mais exigerait des indicateurs hors ligne/synchronisation, des tests multi-onglets et multi-comptes, ainsi qu'une politique explicite de déconnexion et d'appareil partagé.

## Validation

Les résultats exacts de `npm test`, `npm run build`, `git diff --check` et du lint ciblé sont consignés dans le compte rendu final du mini-sprint.