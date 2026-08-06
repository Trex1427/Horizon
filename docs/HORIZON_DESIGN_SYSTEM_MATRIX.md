# Horizon Design System Matrix

Statut: reference officielle (Sprint V3)
Derniere mise a jour: 2026-08-06

## Regle de gouvernance

- Aucun composant UI ne doit etre cree directement dans une page si un equivalent existe deja dans le Design System.
- Toute nouvelle primitive UI doit etre definie dans le Design System avant adoption dans une page.
- Tout nouveau composant doit etre rattache a une famille officielle (Layout, Navigation, Toolbar, Cards et KPI, Forms, Dialogs et Drawers, States, Feedback, Data display, Actions) avant implementation.
- Les pages doivent rester des orchestrateurs (composition), sans logique metier dans les primitives UI.

## DS-02 Architecture officielle

Arborescence cible officialisee:

```text
src/components/ui/
	foundations/
	layout/
	navigation/
	toolbar/
	cards/
	kpi/
	drawer/
	dialogs/
	forms/
	filters/
	feedback/
	states/
	tables/
	charts/
	animations/
	icons/
```

Migration DS-02 (famille de reference):
- `AppToolbarSearchField`, `AppSecondaryToolsButton`, `CompactToolbarLayout`: `toolbar`
- `AppAlert`, `AppChip`: `feedback`
- `LoadingMessageCard`, `ResultsEmptyCard`: `states`

## DS-03 Demantelement de AppShell

Statut: applique (compatibilite preservee)

Migrations DS-03 (famille de reference):
- `AppPage`, `CompactPageHeader`, `AppHeader`, `StickySummaryPanel`, `AppStickyPanel`, `AppSection`: `layout`
- `ToolbarSearchShell`, `AppSearchBar`, `AppSearch`, `AppActions`, `AppToolbar`: `toolbar`
- `AppCard`, `AppTimeline`, `AppInfoList`: `cards`
- `CompactKpiGrid`, `AppKpiGrid`, `AppStatCard`: `kpi`
- `AppDrawer`: `drawer`
- `DialogActionBar`, `AppDialogFooter`, `AppFilterDialog`, `AppSortDialog`: `dialogs`
- `AppFormSection`: `forms`
- `AppFilterBar`: `filters`
- `AppStatusBadge`, `AppAlert`, `AppChip`: `feedback`
- `AppEmptyState`, `LoadingMessageCard`, `ResultsEmptyCard`: `states`
- `AppPrimaryAction`, `AppSecondaryAction`: `buttons`

Resultat DS-03:
- `src/components/ui/app/AppShell.jsx` devient une couche de compatibilite (barrel de re-export).
- Le barrel global `src/components/ui/index.js` exporte uniquement les familles officielles.

## DS-04 Transactions 100% conforme

Statut: applique

Decision DS-04:
- `Transactions.jsx` consomme exclusivement des primitives UI via familles officielles DS.

Application:
- Primitives MUI routées via `foundations/MuiPrimitives`.
- Icones MUI routées via `icons/MuiIcons`.
- Plus aucun import direct `@mui/material` ou `@mui/icons-material` dans `Transactions.jsx`.

Resultat:
- Transactions devient la page de reference Horizon pour la conformite DS.

## Matrice de mutualisation

| Composant | Transactions | Budgets | Frais fixes | Revenus | Objectifs | Travail | Vehicules |
|---|---|---|---|---|---|---|---|
| AppPage | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppHeader | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppStickyPanel | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppSection | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppToolbar | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppKpiGrid | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| CompactToolbarLayout | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppSearchBar | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppToolbarSearchField | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppSecondaryToolsButton | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppFilterBar | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppFilterDialog | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppSortDialog | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppStatCard | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppCard | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppEmptyState | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| LoadingMessageCard | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| ResultsEmptyCard | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppDrawer | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppInfoList | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppTimeline | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppDialog | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppDialogFooter | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppAlert | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppStatusBadge | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppChip | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppPrimaryAction | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| AppSecondaryAction | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## Notes d audit

- Cette matrice couvre les pages ciblees du sprint: Transactions et Budgets, puis la projection sur Frais fixes, Revenus, Objectifs, Travail, Vehicules.
- Les composants ci-dessus sont des patterns purement UI extraits ou aligns dans le Design System.
- Sprint V3 (Design System First): AppToolbarSearchField, AppSecondaryToolsButton et AppAlert ont ete extraits puis adoptes immediatement dans Transactions et Budgets.
- Les differences residuelles entre Transactions et Budgets concernent majoritairement des composants metier (cartes, formulaires, dialogs metier, actions de domaine).
