import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Download,
  FileClock,
  Info,
  LogOut,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import {
  DashboardV2MobileNavigation,
  DashboardV2Sidebar,
} from "../dashboard-v2/DashboardV2Navigation.jsx";
import {
  exportHorizonDataPlaceholder,
  importHorizonBackupPlaceholder,
  resetHorizonData,
} from "../../services/maintenanceService.js";
import "../dashboard-v2/DashboardV2.css";
import "./SettingsV2.css";
import { ActionBar, Card, Checkbox, Dialog, EmptyState, ErrorState, Input, SearchInput } from "../ui";

const PRESERVED_SETTINGS_COLLECTIONS = ["categories", "subcategories"];

const SETTINGS = [
  {
    id: "transfer",
    icon: Download,
    title: "Import / Export",
    description:
      "Accédez aux outils expérimentaux d’import et d’export déjà disponibles.",
    keywords: "import export sauvegarde données",
  },
  {
    id: "history",
    icon: FileClock,
    title: "Historique des imports",
    description:
      "Consultez les imports bancaires déjà enregistrés dans Horizon.",
    keywords: "historique imports banque",
  },
  {
    id: "security",
    icon: ShieldCheck,
    title: "Sécurité",
    description: "Gérez la session actuellement ouverte sur cet appareil.",
    keywords: "sécurité session déconnexion",
  },
  {
    id: "about",
    icon: Info,
    title: "À propos",
    description:
      "Retrouvez la version, le build et l’environnement de l’application.",
    keywords: "horizon version build environnement",
  },
  {
    id: "maintenance",
    icon: AlertTriangle,
    title: "Maintenance",
    description:
      "Supprimez toutes les donnees utilisateur avec une confirmation renforcee.",
    keywords: "maintenance reinitialiser supprimer donnees cloud",
  },
];

function SettingCard({ item, onNavigate, onLogout, onMessage, onOpenResetDialog }) {
  const Icon = item.icon;
  const [expanded, setExpanded] = useState(false);
  const action = () => {
    if (item.id === "history") onNavigate?.("import-history");
    else setExpanded((value) => !value);
  };
  const placeholder = async (kind) => {
    const result =
      kind === "export"
        ? await exportHorizonDataPlaceholder()
        : await importHorizonBackupPlaceholder();
    onMessage(result.message);
  };
  return (
    <Card className="v2-card settings-v2-card">
      <header>
        <span className="v2-icon">
          <Icon size={20} />
        </span>
        <button
          type="button"
          aria-label={`Ouvrir ${item.title}`}
          aria-expanded={item.id === "history" ? undefined : expanded}
          onClick={action}
        >
          <ArrowRight size={18} />
        </button>
      </header>
      <h2>{item.title}</h2>
      <p>{item.description}</p>
      {expanded && item.id === "transfer" && (
        <div className="settings-v2-detail">
          <p>
            Ces deux fonctions sont actuellement proposées comme aperçus
            expérimentaux.
          </p>
          <button type="button" onClick={() => placeholder("export")}>
            <Download size={17} />
            Exporter les données
          </button>
          <button type="button" onClick={() => placeholder("import")}>
            <Upload size={17} />
            Importer une sauvegarde
          </button>
        </div>
      )}
      {expanded && item.id === "security" && (
        <div className="settings-v2-detail">
          <button type="button" className="danger" onClick={onLogout}>
            <LogOut size={17} />
            Se déconnecter
          </button>
        </div>
      )}
      {expanded && item.id === "about" && (
        <dl className="settings-v2-about">
          <div>
            <dt>Produit</dt>
            <dd>Horizon</dd>
          </div>
          <div>
            <dt>Version</dt>
            <dd>3.0 Beta ({__APP_VERSION__})</dd>
          </div>
          <div>
            <dt>Build</dt>
            <dd>{__BUILD_DATE__}</dd>
          </div>
          <div>
            <dt>Environnement</dt>
            <dd>{__APP_ENV__}</dd>
          </div>
        </dl>
      )}
      {expanded && item.id === "maintenance" && (
        <div className="settings-v2-detail settings-v2-maintenance">
          <p>
            ⚠ Avant toute suppression, faites une sauvegarde Firestore. Cette action conserve le compte Google.
          </p>
          <button type="button" className="danger" onClick={onOpenResetDialog}>
            <Trash2 size={17} />
            Reinitialiser toutes les donnees
          </button>
        </div>
      )}
    </Card>
  );
}

function ResetDataDialog({ open, onClose, onDone }) {
  const [confirmBackup, setConfirmBackup] = useState(false);
  const [confirmIrreversible, setConfirmIrreversible] = useState(false);
  const [typed, setTyped] = useState("");
  const [preserveSettings, setPreserveSettings] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const canSubmit =
    confirmBackup &&
    confirmIrreversible &&
    typed.trim().toUpperCase() === "SUPPRIMER" &&
    !running;

  const handleClose = ({ force = false } = {}) => {
    if (running && !force) return;
    setConfirmBackup(false);
    setConfirmIrreversible(false);
    setTyped("");
    setPreserveSettings(false);
    setError("");
    onClose?.();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    setRunning(true);
    setError("");

    try {
      const summary = await resetHorizonData({
        mode: "full",
        excludedCollections: preserveSettings ? PRESERVED_SETTINGS_COLLECTIONS : [],
      });

      if (summary.isSuccess) {
        const kept = summary.preservedCollections.length
          ? ` Parametres conserves: ${summary.preservedCollections.join(", ")}.`
          : "";
        onDone?.(`Reinitialisation terminee. ${summary.totals.deletedCount} documents supprimes.${kept}`);
        handleClose({ force: true });
        return;
      }

      setError(`Reinitialisation partielle: ${summary.errors.length} erreur(s). Verifiez la connexion et reessayez.`);
      onDone?.(`Reinitialisation partielle. ${summary.totals.deletedCount} documents supprimes, ${summary.errors.length} erreur(s).`);
    } catch (cause) {
      setError(cause?.message || "La reinitialisation a echoue.");
    } finally {
      setRunning(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open title="Reinitialiser toutes les donnees" onClose={handleClose}>
      <form className="settings-v2-reset-form" onSubmit={handleSubmit}>
        <p>
          Cette suppression retire les donnees Firestore utilisateur (transactions, comptes, budgets, objectifs,
          revenus recurrents, frais fixes, vehicules, travail, devis, factures, dettes et creances, etc.) et
          conserve votre compte Google.
        </p>
        <p className="settings-v2-reset-warning">
          ⚠ Sauvegardez Firestore avant de continuer.
        </p>
        <Checkbox
          checked={confirmBackup}
          onChange={(event) => setConfirmBackup(event.target.checked)}
          label="Je confirme avoir realise une sauvegarde Firestore"
        />
        <Checkbox
          checked={confirmIrreversible}
          onChange={(event) => setConfirmIrreversible(event.target.checked)}
          label="Je confirme que cette action est irreversible"
        />
        <Checkbox
          checked={preserveSettings}
          onChange={(event) => setPreserveSettings(event.target.checked)}
          label="Conserver les parametres d'application (categories, sous-categories)"
        />
        <Input
          label="Saisissez SUPPRIMER pour confirmer"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder="SUPPRIMER"
          autoComplete="off"
        />
        {error ? <ErrorState unstyled as="div" className="settings-v2-reset-issue">{error}</ErrorState> : null}
        <div className="settings-v2-reset-actions">
          <button type="button" onClick={handleClose} disabled={running}>
            Annuler
          </button>
          <button type="submit" className="danger" disabled={!canSubmit}>
            {running ? "Reinitialisation..." : "Supprimer toutes les donnees"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

export function SettingsV2View({ search, setSearch, onNavigate, onLogout }) {
  const [message, setMessage] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const cards = useMemo(
    () =>
      SETTINGS.filter((item) =>
        `${item.title} ${item.description} ${item.keywords}`
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
      ),
    [search],
  );
  return (
    <div className="horizon-v2 settings-v2">
      <div className="v2-shell">
        <DashboardV2Sidebar active="settings" onNavigate={onNavigate} />
        <main className="v2-main settings-v2-main">
          <header className="v2-header">
            <div>
              <p className="v2-eyebrow">Configuration</p>
              <h1>Paramètres</h1>
              <p>Personnalisez Horizon et gérez votre application.</p>
            </div>
            <div className="v2-header-actions">
              <button
                type="button"
                className="v2-bell"
                aria-label="Ouvrir les notifications"
              >
                <Bell size={18} />
              </button>
            </div>
          </header>
          <ActionBar className="v2-card settings-v2-actions">
            <label>
              <Search size={18} />
              <SearchInput unstyled
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un paramètre…"
                aria-label="Rechercher un paramètre"
              />
            </label>
          </ActionBar>
          {message && (
            <p className="settings-v2-message" role="status">
              {message}
            </p>
          )}
          <section
            className="settings-v2-grid"
            aria-label={`${cards.length} catégories de paramètres affichées`}
          >
            {cards.map((item) => (
              <SettingCard
                key={item.id}
                item={item}
                onNavigate={onNavigate}
                onLogout={onLogout}
                onMessage={setMessage}
                onOpenResetDialog={() => setResetDialogOpen(true)}
              />
            ))}
          </section>
          {cards.length === 0 && (
            <EmptyState unstyled as="div" className="v2-card settings-v2-empty">
              <Search size={28} />
              <h2>Aucun paramètre trouvé.</h2>
              <p>
                Modifiez votre recherche pour afficher une catégorie existante.
              </p>
              <button type="button" onClick={() => setSearch("")}>
                Réinitialiser la recherche
              </button>
            </EmptyState>
          )}
        </main>
      </div>
      <DashboardV2MobileNavigation active="settings" onNavigate={onNavigate} />
      <ResetDataDialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        onDone={(nextMessage) => setMessage(nextMessage)}
      />
    </div>
  );
}

export default function SettingsV2({ onNavigate, onLogout }) {
  const [search, setSearch] = useState("");
  return (
    <SettingsV2View
      search={search}
      setSearch={setSearch}
      onNavigate={onNavigate}
      onLogout={onLogout}
    />
  );
}
