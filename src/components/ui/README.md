# Horizon Design System 1.0

Bibliothèque UI générique et indépendante des données métier. L’import public se fait depuis `components/ui`.

```jsx
import { PageHeader, Grid, KpiCard, PrimaryButton } from '../ui';
```

Toutes les primitives acceptent `className`. Les contrôles natifs transmettent aussi leurs attributs HTML et leur `ref`.

## API

| Famille | Composant | Props spécifiques |
| --- | --- | --- |
| Layout | `PageLayout` | `sidebar`, `bottomNavigation`, `children` |
|  | `PageHeader` | `eyebrow`, `title`, `description`, `actions` |
|  | `CompactPageHeader` | `title`, `mobileCountLabel`, `mobilePrimaryActionLabel`, `onMobilePrimaryAction`, `className`, `sx` |
|  | `AppHeader` | Alias de `CompactPageHeader` |
|  | `StickySummaryPanel` | `ariaLabel`, `summary`, `toolbar`, `footer`, `className`, `stickySx`, `cardSx`, `contentSx` |
|  | `AppStickyPanel` | Alias de `StickySummaryPanel` |
|  | `CompactKpiGrid` | `items[{label,value,tone}]`, `wrapperSx`, `ariaHidden` |
|  | `AppKpiGrid` | Alias de `CompactKpiGrid` |
|  | `ToolbarSearchShell` | `children`, `utilityAction`, `className`, `sx` |
|  | `AppSearchBar` | Alias de `ToolbarSearchShell` |
|  | `CompactToolbarLayout` | `children`, `className`, `label`, `stackSx` |
|  | `LoadingMessageCard` | `title`, `description`, `titleSx`, `cardSx`, `contentSx` |
|  | `Section` | `title`, `description`, `actions`, `as`, `children` |
|  | `Grid` | `columns` ou `minItemWidth`, `as`, `children` |
|  | `Container` | `size: narrow\|default\|wide\|full`, `as`, `children` |
| Navigation | `Sidebar` | `brand`, `groups`, `activeId`, `onNavigate`, `footer` |
|  | `BottomNavigation` | `items`, `activeId`, `onNavigate`, `label` |
|  | `ActionBar` | `children` ou slots `search`, `period`, `filters`, `sort`, `secondaryActions`, `primaryAction`; `activeFiltersCount`, `loading`, `empty`, `label`, `as`, `unstyled` |
| Cartes | `Card` | `title`, `header`, `footer`, `actions`, `loading`, `empty`, `as`, `tone`, `variant: default\|outlined\|elevated`, `interactive`, `unstyled`, `children` |
|  | `KpiCard` | `title/label`, `value`, `subtitle/caption`, `variation`, `icon`, `color`, `tone`, `badge`, `loading`, `empty`, `visualization`, `unstyled` |
|  | `SummaryCard` | `eyebrow`, `title`, `value`, `summary`, `items[{label,value}]`, `actions`, `footer`, `children`, `loading`, `empty`, `as`, `unstyled` |
|  | `SectionCard` | `eyebrow`, `title`, `description`, `actions`, `footer`, `children`, `loading`, `empty`, `as`, `unstyled` |
|  | `InfoCard` | `icon`, `title`, `text/description`, `badge`, `action`, `footer`, `tone`, `children`, `loading`, `empty`, `as`, `unstyled` |
| Boutons | `PrimaryButton`, `SecondaryButton`, `GhostButton`, `DangerButton` | Attributs HTML d’un bouton |
|  | `IconButton` | `aria-label` requis, `size: sm\|md\|lg` |
| Formulaires | `Input`, `Textarea`, `Select`, `DatePicker` | `label`, `hint`, `error`, `disabled`, `loading`, `unstyled`, `fieldClassName` et attributs natifs |
|  | `SearchInput` | API de `Input`, type recherche, `loading`, `unstyled` |
|  | `CurrencyInput` | API de `Input`, `currency`, `loading`, `unstyled` |
|  | `Checkbox`, `Switch` | `label`, `description`, `disabled`, `loading`, `unstyled` et attributs natifs |
|  | `CurrencyInput` | API de `Input`, `currency` purement visuel |
|  | `Checkbox`, `Switch` | `label`, `description` et attributs natifs |
| Tables | `DataTable` | `columns`, `rows`, `getRowKey`, `caption`, `emptyContent` |
|  | `MobileCard` | `title`, `subtitle`, `badge`, `items`, `actions` |
| Visualisation | `LineChart` | `series`, `paths`, `gridLines`, `xLabels`, `marker`, `width`, `height`, `ariaLabel`, `showLegend`, `loading`, `empty`, `unstyled` |
|  | `DonutChart` | `segments`, `variant`, `gradient`, `size`, `thickness`, `centerLabel`, `ariaLabel`, `showLegend`, `loading`, `empty`, `unstyled` |
|  | `Sparkline` | `values`, `path`, `color`, `width`, `height`, `ariaLabel`, `ariaHidden`, `unstyled` |
|  | `ProgressBar` | `value`, `max`, `label`, `showValue`, `tone`, `loading`, `empty`, `ariaLabel`, `as`, `fillAs`, `unstyled` |
|  | `Badge` | `tone`, `icon`, `children` |
| Feedback | `Toast` | `open`, `title`, `message`, `tone`, `action`, `onClose` |
|  | `Alert` | `title`, `children`, `tone`, `icon`, `action` |
|  | `Banner` | `title`, `description`, `tone`, `icon`, `actions` |
| Dialogues | `Dialog` | `open`, `title`, `description`, `content/children`, `footer/actions`, `onClose`, `closeOnEscape`, `closeOnBackdrop`, `restoreFocus`, `size`, `as`, `overlayClassName`, `unstyled` |
|  | `ConfirmDialog` | API de `Dialog`, `message`, `confirmLabel`, `cancelLabel`, `onConfirm`, `loading`, `variant: danger|warning|info` |
|  | `Drawer` | `open`, `title`, `side`, `children`, `footer`, `onClose` |
|  | `BottomSheet` | `open`, `title`, `children`, `footer`, `onClose` |
|  | `DialogActionBar` | `children`, `sticky`, `sx` |
|  | `AppDialogFooter` | Alias de `DialogActionBar` |
|  | `AppFilterDialog` | `open`, `onClose`, `title`, `children`, `fullWidth`, `fullScreen`, `maxWidth`, `scroll`, `ariaLabelledby`, actions (`onCancel`,`onReset`,`onApply`) |
|  | `AppSortDialog` | `open`, `onClose`, `title`, `children`, `fullWidth`, `maxWidth`, actions (`onCloseAction`,`onReset`,`onApply`) |
| États | `EmptyState` | `illustration`, `icon`, `title`, `description`, `primaryAction`, `secondaryAction`, `action`, `loading`, `unstyled` |
|  | `LoadingState` | `loader`, `label`, `inline`, `unstyled` |
|  | `Skeleton` | `variant`, `width`, `height`, `circle`, `lines`, `responsive` |
|  | `ErrorState` | `icon`, `title`, `message`, `description`, `action`, `unstyled` |
|  | `ResultsEmptyCard` | `title`, `description`, `cardSx`, `contentSx` |

Les graphiques ne calculent aucun indicateur métier : ils rendent uniquement les séries reçues. `CurrencyInput` ne convertit ni ne formate la valeur. Les composants de navigation délèguent le routage à `onNavigate`.

## Accessibilité et mouvement

Les contrôles interactifs font au moins 44 px, les dialogues prennent en charge Échap, les graphiques exposent `ariaLabel`, et les animations sont neutralisées par `prefers-reduced-motion`.
