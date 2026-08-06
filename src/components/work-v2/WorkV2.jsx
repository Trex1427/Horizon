import { useMemo, useState } from "react";
import {
  Bell,
  BriefcaseBusiness,
  CalendarClock,
  ChevronDown,
  Clock3,
  MoreVertical,
  Plus,
  Search,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";
import {
  DashboardV2MobileNavigation,
  DashboardV2Sidebar,
} from "../dashboard-v2/DashboardV2Navigation.jsx";
import { useProfessionalActivities } from "../../hooks/useProfessionalActivities.js";
import { useWorkProjects } from "../../hooks/useWorkProjects.js";
import { useThirdParties } from "../../hooks/useThirdParties.js";
import { useWorkProjectTransactions } from "../../hooks/useWorkProjectTransactions.js";
import {
  calculateWorkProjectMetrics,
  WORK_PROJECT_STATUS_LABELS,
} from "../../features/work/workProjectModel.js";
import { formatTargetDate } from "../../utils/dateFormatter.js";
import "../dashboard-v2/DashboardV2.css";
import "../recurring-income-v2/RecurringIncomeV2.css";
import "./WorkV2.css";
import { ActionBar, Card, Dialog, Input, KpiCard, SearchInput, Select, InfoCard, EmptyState, LoadingState, ErrorState } from "../ui";

const money = (value) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
const BADGES = {
  planned: "Planifié",
  in_progress: "En cours",
  completed: "Terminé",
};
const EMPTY = {
  name: "",
  color: "#2e7d6f",
  icon: "work",
  urssafRate: "0",
  isActive: true,
};
function PageEmpty({ filtered, onCreate, onReset }) {
  return (
    <EmptyState unstyled as="div" className="v2-card recurring-v2-empty work-v2-empty">
      <span>
        <BriefcaseBusiness size={30} />
      </span>
      <h2>{filtered ? "Aucun résultat" : "Aucune activité."}</h2>
      <p>
        {filtered
          ? "Aucune activité ne correspond aux critères sélectionnés."
          : "Ajoutez votre première activité."}
      </p>
      <button
        type="button"
        className="recurring-v2-primary work-v2-primary"
        onClick={filtered ? onReset : onCreate}
      >
        {filtered ? "Réinitialiser les filtres" : "Créer une activité"}
      </button>
    </EmptyState>
  );
}
function ActivityDialog({ activity, onClose, onSave }) {
  const [form, setForm] = useState(activity || EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || saving) return;
    setSaving(true);
    const result = await onSave(form);
    setSaving(false);
    if (result.success) onClose();
    else setError(result.error || "Enregistrement impossible.");
  };
  return (
    <Dialog open unstyled overlayClassName="work-v2-dialog-backdrop" className="work-v2-dialog" ariaLabelledby="work-v2-dialog-title" onClose={onClose} closeOnEscape={false} closeOnBackdrop={false}>
        <h2 id="work-v2-dialog-title">
          {activity?.id ? "Modifier l’activité" : "Ajouter une activité"}
        </h2>
        <form onSubmit={submit}>
          {error && <ErrorState unstyled as="p">{error}</ErrorState>}
          <label>
            Nom
            <Input unstyled
              autoFocus
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
              required
            />
          </label>
          <label>
            Taux URSSAF (%)
            <Input unstyled
              type="number"
              min="0"
              step="0.01"
              value={form.urssafRate}
              onChange={(event) =>
                setForm({ ...form, urssafRate: event.target.value })
              }
            />
          </label>
          <label>
            Couleur
            <Input unstyled
              type="color"
              value={form.color}
              onChange={(event) =>
                setForm({ ...form, color: event.target.value })
              }
            />
          </label>
          <div>
            <button type="button" onClick={onClose}>
              Annuler
            </button>
            <button
              type="submit"
              className="work-v2-primary"
              disabled={saving || !form.name.trim()}
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </form>
    </Dialog>
  );
}

export function WorkV2View({
  rows = [],
  summary = {},
  planning = [],
  search,
  setSearch,
  status,
  setStatus,
  sort,
  setSort,
  onCreate,
  onEdit,
  onNavigate,
}) {
  const [menuId, setMenuId] = useState("");
  return (
    <div className="horizon-v2 recurring-v2 work-v2">
      <div className="v2-shell">
        <DashboardV2Sidebar active="work" onNavigate={onNavigate} />
        <main className="v2-main recurring-v2-main work-v2-main">
          <header className="v2-header">
            <div>
              <p className="v2-eyebrow">Organisation</p>
              <h1>Travail</h1>
              <p>Centralisez vos activités professionnelles.</p>
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
          <section className="recurring-v2-kpis work-v2-kpis">
            <KpiCard
              className="v2-card recurring-v2-kpi work-v2-kpi"
              icon={BriefcaseBusiness}
              label="Chantiers actifs"
              value={String(summary.activeProjects || 0)}
              caption="Dossiers en activité"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi work-v2-kpi"
              icon={WalletCards}
              label="Chiffre d'affaires"
              value={summary.hasRevenue ? money(summary.revenue) : "À venir"}
              caption="Prévisionnel disponible"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi work-v2-kpi"
              icon={Clock3}
              label="Temps planifié"
              value="À venir"
              caption="Donnée non disponible"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi work-v2-kpi"
              icon={CalendarClock}
              label="Tâches"
              value="À venir"
              caption="Aucune donnée de tâche"
            />
          </section>
      <ActionBar className="v2-card recurring-v2-actions work-v2-actions">
            <label>
              <Search size={18} />
              <SearchInput unstyled
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une activité…"
                aria-label="Rechercher une activité"
              />
            </label>
            <Select unstyled
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Filtres"
            >
              <option value="all">Toutes les activités</option>
              <option value="active">Actives</option>
              <option value="inactive">Inactives</option>
            </Select>
            <Select unstyled
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              aria-label="Tri"
            >
              <option value="name">Tri : nom</option>
              <option value="projects">Tri : projets</option>
            </Select>
            <button type="button" className="recurring-v2-filter">
              <SlidersHorizontal size={18} />
              Filtres
              <ChevronDown size={16} />
            </button>
            <button
              type="button"
              className="recurring-v2-primary work-v2-primary"
              onClick={onCreate}
            >
              <Plus size={18} />
              Ajouter une activité
            </button>
      </ActionBar>
          <section className="recurring-v2-summary-grid">
            <InfoCard unstyled as="article" className="v2-card recurring-v2-expected">
              <div>
                <p className="v2-eyebrow">Synthèse</p>
                <h2>Activité professionnelle</h2>
              </div>
              <div>
                <span>
                  Nombre d'activités
                  <strong>{summary.activityCount || 0}</strong>
                </span>
                <span>
                  Projets actifs<strong>{summary.activeProjects || 0}</strong>
                </span>
                <span>
                  Tâches<strong>À venir</strong>
                </span>
              </div>
            </InfoCard>
            <InfoCard unstyled as="article" className="v2-card recurring-v2-distribution work-v2-planning">
              <p className="v2-eyebrow">Calendrier</p>
              <h2>Planning</h2>
              {planning.length ? (
                <ul>
                  {planning.map((project) => (
                    <li key={project.id}>
                      <strong>{project.name}</strong>
                      <span>{formatTargetDate(project.endDate)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState unstyled as="div" className="recurring-v2-distribution-empty">
                  Aucune échéance.
                </EmptyState>
              )}
            </InfoCard>
          </section>
          <section
            className="recurring-v2-grid"
            aria-label={`${rows.length} activités affichées`}
          >
            {rows.map(({ activity, projects, featured, client }) => (
              <Card
                className="v2-card recurring-v2-card work-v2-card"
                key={activity.id}
              >
                <header>
                  <div>
                    {featured && BADGES[featured.status] && (
                      <span
                        className={`recurring-v2-status work-v2-status ${featured.status}`}
                      >
                        <i />
                        {BADGES[featured.status]}
                      </span>
                    )}
                    <h2>{activity.name}</h2>
                  </div>
                  <div className="recurring-v2-menu-wrap">
                    <button
                      type="button"
                      className="recurring-v2-menu-button"
                      aria-label={`Actions pour ${activity.name}`}
                      aria-expanded={menuId === activity.id}
                      onClick={() =>
                        setMenuId(menuId === activity.id ? "" : activity.id)
                      }
                    >
                      <MoreVertical size={20} />
                    </button>
                    {menuId === activity.id && (
                      <div className="recurring-v2-menu">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuId("");
                            onEdit(activity);
                          }}
                        >
                          Modifier
                        </button>
                      </div>
                    )}
                  </div>
                </header>
                <div className="work-v2-hero">
                  <BriefcaseBusiness size={25} />
                  <span>
                    {projects.length} projet{projects.length > 1 ? "s" : ""}
                  </span>
                </div>
                <dl>
                  {featured && (
                    <div>
                      <dt>Projet</dt>
                      <dd>{featured.name}</dd>
                    </div>
                  )}
                  {client && (
                    <div>
                      <dt>Client</dt>
                      <dd>{client}</dd>
                    </div>
                  )}
                  {featured?.endDate && (
                    <div>
                      <dt>Date</dt>
                      <dd>{formatTargetDate(featured.endDate)}</dd>
                    </div>
                  )}
                  {featured?.status && (
                    <div>
                      <dt>Statut</dt>
                      <dd>
                        {WORK_PROJECT_STATUS_LABELS[featured.status] ||
                          featured.status}
                      </dd>
                    </div>
                  )}
                </dl>
              </Card>
            ))}
            {rows.length === 0 && (
              <PageEmpty
                filtered={summary.activityCount > 0}
                onCreate={onCreate}
                onReset={() => {
                  setSearch("");
                  setStatus("all");
                  setSort("name");
                }}
              />
            )}
          </section>
        </main>
      </div>
      <DashboardV2MobileNavigation active="work" onNavigate={onNavigate} />
    </div>
  );
}

export default function WorkV2({ onNavigate }) {
  const activitiesApi = useProfessionalActivities();
  const projectsApi = useWorkProjects();
  const transactionsApi = useWorkProjectTransactions();
  const { thirdParties = [] } = useThirdParties({ includeInactive: true });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [editing, setEditing] = useState(null);
  const thirdPartyMap = useMemo(
    () => new Map(thirdParties.map((item) => [item.id, item.name])),
    [thirdParties],
  );
  const metrics = useMemo(
    () =>
      calculateWorkProjectMetrics(
        projectsApi.projects,
        transactionsApi.transactions || [],
      ),
    [projectsApi.projects, transactionsApi.transactions],
  );
  const rows = useMemo(
    () =>
      activitiesApi.professionalActivities
        .map((activity) => {
          const projects = projectsApi.projects.filter(
            (project) =>
              project.professionalActivityId === activity.id &&
              !project.deletedAt,
          );
          const featured =
            projects.find(
              (project) => !["completed", "cancelled"].includes(project.status),
            ) || projects[0];
          return {
            activity,
            projects,
            featured,
            client: featured ? thirdPartyMap.get(featured.thirdPartyId) : "",
          };
        })
        .filter((row) =>
          row.activity.name.toLowerCase().includes(search.trim().toLowerCase()),
        )
        .filter(
          (row) =>
            status === "all" ||
            (status === "active"
              ? row.activity.isActive !== false
              : row.activity.isActive === false),
        )
        .toSorted((a, b) =>
          sort === "projects"
            ? b.projects.length - a.projects.length
            : a.activity.name.localeCompare(b.activity.name, "fr"),
        ),
    [
      activitiesApi.professionalActivities,
      projectsApi.projects,
      thirdPartyMap,
      search,
      status,
      sort,
    ],
  );
  const planning = useMemo(
    () =>
      projectsApi.projects
        .filter(
          (project) =>
            project.endDate &&
            !project.deletedAt &&
            !["completed", "cancelled"].includes(project.status),
        )
        .toSorted((a, b) => a.endDate.localeCompare(b.endDate))
        .slice(0, 4),
    [projectsApi.projects],
  );
  const summary = {
    activityCount: activitiesApi.professionalActivities.length,
    activeProjects: metrics.active,
    revenue: metrics.plannedRevenue,
    hasRevenue: projectsApi.projects.some(
      (project) =>
        project.status !== "cancelled" &&
        Number.isFinite(Number(project.plannedRevenue)),
    ),
  };
  const save = (payload) =>
    editing?.id
      ? activitiesApi.editProfessionalActivity(editing.id, payload)
      : activitiesApi.addProfessionalActivity(payload);
  if (activitiesApi.loading || projectsApi.loading)
    return (
      <LoadingState unstyled as="div" className="recurring-v2-loading">Chargement des activités…</LoadingState>
    );
  return (
    <>
      {(activitiesApi.error || projectsApi.error) && (
        <ErrorState unstyled as="p" className="recurring-v2-error">
          {activitiesApi.error || projectsApi.error}
        </ErrorState>
      )}
      <WorkV2View
        rows={rows}
        summary={summary}
        planning={planning}
        search={search}
        setSearch={setSearch}
        status={status}
        setStatus={setStatus}
        sort={sort}
        setSort={setSort}
        onCreate={() => setEditing({ ...EMPTY })}
        onEdit={setEditing}
        onNavigate={onNavigate}
      />
      {editing && (
        <ActivityDialog
          activity={editing}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      )}
    </>
  );
}
