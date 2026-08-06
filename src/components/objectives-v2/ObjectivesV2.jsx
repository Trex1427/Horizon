import { useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  CircleCheckBig,
  Flag,
  MoreVertical,
  PiggyBank,
  Plus,
  Search,
  SlidersHorizontal,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  DashboardV2MobileNavigation,
  DashboardV2Sidebar,
} from "../dashboard-v2/DashboardV2Navigation.jsx";
import { ObjectiveForm } from "../ObjectiveForm.jsx";
import { useObjectives } from "../../hooks/useObjectives.js";
import { formatTargetDate } from "../../utils/dateFormatter.js";
import "../dashboard-v2/DashboardV2.css";
import "./ObjectivesV2.css";
import { ActionBar, Card, KpiCard, ProgressBar, SearchInput, Select, InfoCard, EmptyState } from "../ui";
import { LoadingState } from "../ui";
import { ErrorState } from "../ui";

const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const money = (value) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(number(value));
const progressFor = (objective) =>
  number(objective?.targetAmount) > 0
    ? Math.min(
        100,
        (number(objective?.currentAmount) / number(objective?.targetAmount)) *
          100,
      )
    : 0;
const dateValue = (value) => {
  const date =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value
        ? new Date(value)
        : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};
const STATUS = {
  ahead: { label: "En avance", tone: "ahead" },
  in_progress: { label: "En cours", tone: "current" },
  not_started: { label: "En cours", tone: "current" },
  at_risk: { label: "À risque", tone: "risk" },
  completed: { label: "Atteint", tone: "done" },
};
const stateFor = (objective) =>
  STATUS[objective?.status] ||
  (progressFor(objective) >= 100 ? STATUS.completed : STATUS.in_progress);

function PageEmpty({ filtered = false, onCreate, onReset }) {
  return (
    <EmptyState unstyled as="div" className="v2-card objectives-v2-empty">
      <span>
        <Target size={30} />
      </span>
      <h2>{filtered ? "Aucun résultat" : "Aucun objectif."}</h2>
      <p>
        {filtered
          ? "Aucun objectif ne correspond aux critères sélectionnés."
          : "Commencez par créer votre premier objectif financier."}
      </p>
      <button
        type="button"
        className="objectives-v2-primary"
        onClick={filtered ? onReset : onCreate}
      >
        {filtered ? "Réinitialiser les filtres" : "Créer mon premier objectif"}
      </button>
    </EmptyState>
  );
}

export function ObjectivesV2View({
  rows = [],
  summary = {},
  search,
  setSearch,
  status,
  setStatus,
  sort,
  setSort,
  onCreate,
  onEdit,
  onDelete,
  onNavigate,
}) {
  const [menuId, setMenuId] = useState("");
  const next = summary.next;
  return (
    <div className="horizon-v2 objectives-v2">
      <div className="v2-shell">
        <DashboardV2Sidebar active="goals" onNavigate={onNavigate} />
        <main className="v2-main objectives-v2-main">
          <header className="v2-header">
            <div>
              <p className="v2-eyebrow">Gestion personnelle</p>
              <h1>Objectifs</h1>
              <p>Suivez la progression de tous vos objectifs financiers.</p>
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
          <section
            className="objectives-v2-kpis"
            aria-label="Indicateurs des objectifs"
          >
            <KpiCard
              className="v2-card objectives-v2-kpi"
              icon={Target}
              label="Objectifs actifs"
              value={String(summary.activeCount || 0)}
              caption="Objectifs en cours"
            />
            <KpiCard
              className="v2-card objectives-v2-kpi"
              icon={PiggyBank}
              label="Épargne visée"
              value={money(summary.targetAmount)}
              caption="Montants cibles"
            />
            <KpiCard
              className="v2-card objectives-v2-kpi"
              icon={TrendingUp}
              label="Progression moyenne"
              value={`${Math.round(number(summary.averageProgress))} %`}
              caption="Tous les objectifs"
            />
            <KpiCard
              className="v2-card objectives-v2-kpi done"
              icon={CircleCheckBig}
              label="Objectifs atteints"
              value={String(summary.completedCount || 0)}
              caption="Objectifs terminés"
            />
          </section>
      <ActionBar className="v2-card objectives-v2-actions">
            <label>
              <Search size={18} />
              <SearchInput unstyled
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un objectif…"
                aria-label="Rechercher un objectif"
              />
            </label>
            <button type="button">
              <CalendarDays size={18} />
              Toutes périodes
              <ChevronDown size={16} />
            </button>
            <Select unstyled
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filtres"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">En cours</option>
              <option value="completed">Atteints</option>
              <option value="ahead">En avance</option>
              <option value="at_risk">À risque</option>
            </Select>
            <Select unstyled
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Tri"
            >
              <option value="date">Tri : date cible</option>
              <option value="name">Tri : nom</option>
              <option value="progress">Tri : progression</option>
            </Select>
            <button type="button" className="objectives-v2-filter">
              <SlidersHorizontal size={18} />
              Filtres
            </button>
            <button
              type="button"
              className="objectives-v2-primary"
              onClick={onCreate}
            >
              <Plus size={18} />
              Nouvel objectif
            </button>
      </ActionBar>
          <section className="objectives-v2-summary-grid">
            <InfoCard unstyled as="article" className="v2-card objectives-v2-global">
              <div>
                <p className="v2-eyebrow">Vue d’ensemble</p>
                <h2>Progression globale</h2>
              </div>
              <strong>{Math.round(number(summary.averageProgress))} %</strong>
              <ProgressBar unstyled className="objectives-v2-global-bar" value={Math.min(100, number(summary.averageProgress))} showValue={false} ariaLabel="Progression globale des objectifs" />
              <p>
                Vous avez atteint {Math.round(number(summary.averageProgress))}{" "}
                % de vos objectifs.
              </p>
            </InfoCard>
            <InfoCard unstyled as="article" className="v2-card objectives-v2-next">
              <span className="v2-icon">
                <Flag size={19} />
              </span>
              <div>
                <p>Prochain objectif</p>
                {next ? (
                  <>
                    <h2>{next.objective.name || "Objectif"}</h2>
                    <strong>
                      {money(
                        Math.max(0, next.targetAmount - next.currentAmount),
                      )}{" "}
                      restants
                    </strong>
                    <small>
                      {formatTargetDate(next.objective.targetDate) ||
                        "Aucune date cible"}
                    </small>
                  </>
                ) : (
                  <>
                    <h2>Aucun objectif proche.</h2>
                    <small>Aucune échéance disponible.</small>
                  </>
                )}
              </div>
            </InfoCard>
          </section>
          <section
            className="objectives-v2-grid"
            aria-label={`${rows.length} objectifs affichés`}
          >
            {rows.map((row) => {
              const state = stateFor(row.objective);
              return (
                <Card
                  className="v2-card objectives-v2-card"
                  key={row.objective.id}
                >
                  <header>
                    <div>
                      <span className={`objectives-v2-status ${state.tone}`}>
                        <i />
                        {state.label}
                      </span>
                      <h2>{row.objective.name || "Objectif"}</h2>
                    </div>
                    <div className="objectives-v2-menu-wrap">
                      <button
                        type="button"
                        className="objectives-v2-menu-button"
                        aria-label={`Actions pour ${row.objective.name || "cet objectif"}`}
                        aria-expanded={menuId === row.objective.id}
                        onClick={() =>
                          setMenuId((current) =>
                            current === row.objective.id
                              ? ""
                              : row.objective.id,
                          )
                        }
                      >
                        <MoreVertical size={20} />
                      </button>
                      {menuId === row.objective.id && (
                        <div className="objectives-v2-menu">
                          <button
                            type="button"
                            onClick={() => {
                              setMenuId("");
                              onEdit(row.objective);
                            }}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => {
                              setMenuId("");
                              onDelete(row.objective.id);
                            }}
                          >
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                  </header>
                  <div className="objectives-v2-amounts">
                    <div>
                      <span>Montant actuel</span>
                      <strong>{money(row.currentAmount)}</strong>
                    </div>
                    <div>
                      <span>Montant cible</span>
                      <strong>{money(row.targetAmount)}</strong>
                    </div>
                  </div>
                  <div className="objectives-v2-progress-copy">
                    <span>Progression</span>
                    <b>{Math.round(row.progress)} %</b>
                  </div>
                  <ProgressBar unstyled className="objectives-v2-progress" value={row.progress} showValue={false} ariaLabel={`Progression de ${row.objective.name || "l’objectif"}`} />
                  <footer>
                    <span>Date cible</span>
                    <strong>
                      {formatTargetDate(row.objective.targetDate) ||
                        "Aucune date limite"}
                    </strong>
                  </footer>
                </Card>
              );
            })}
            {rows.length === 0 && (
              <PageEmpty
                filtered={summary.totalCount > 0}
                onCreate={onCreate}
                onReset={() => {
                  setSearch("");
                  setStatus("all");
                  setSort("date");
                }}
              />
            )}
          </section>
        </main>
      </div>
      <DashboardV2MobileNavigation active="goals" onNavigate={onNavigate} />
    </div>
  );
}

export default function ObjectivesV2({ onNavigate }) {
  const {
    objectives = [],
    loading,
    error,
    addObjective,
    updateObjective,
    deleteObjective,
  } = useObjectives();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("date");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const allRows = useMemo(
    () =>
      (objectives || []).map((objective) => ({
        objective,
        targetAmount: number(objective.targetAmount),
        currentAmount: number(objective.currentAmount),
        progress: progressFor(objective),
      })),
    [objectives],
  );
  const rows = useMemo(
    () =>
      allRows
        .filter((row) =>
          String(row.objective.name || "")
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        )
        .filter(
          (row) =>
            status === "all" ||
            (status === "active"
              ? row.objective.status !== "completed" &&
                row.objective.status !== "archive"
              : row.objective.status === status),
        )
        .toSorted((left, right) =>
          sort === "name"
            ? String(left.objective.name || "").localeCompare(
                String(right.objective.name || ""),
                "fr",
              )
            : sort === "progress"
              ? right.progress - left.progress
              : (dateValue(left.objective.targetDate)?.getTime() ??
                  Number.MAX_SAFE_INTEGER) -
                (dateValue(right.objective.targetDate)?.getTime() ??
                  Number.MAX_SAFE_INTEGER),
        ),
    [allRows, search, status, sort],
  );
  const summary = useMemo(() => {
    const active = allRows.filter(
      (row) =>
        row.objective.status !== "completed" &&
        row.objective.status !== "archive",
    );
    const dated = active
      .filter((row) => dateValue(row.objective.targetDate))
      .toSorted(
        (left, right) =>
          dateValue(left.objective.targetDate) -
          dateValue(right.objective.targetDate),
      );
    return {
      totalCount: allRows.length,
      activeCount: active.length,
      completedCount: allRows.filter(
        (row) => row.objective.status === "completed",
      ).length,
      targetAmount: allRows.reduce((sum, row) => sum + row.targetAmount, 0),
      averageProgress: allRows.length
        ? allRows.reduce((sum, row) => sum + row.progress, 0) / allRows.length
        : 0,
      next: dated[0] || null,
    };
  }, [allRows]);
  const close = () => {
    setFormOpen(false);
    setEditing(null);
  };
  const submit = async (payload) =>
    editing ? updateObjective(editing.id, payload) : addObjective(payload);
  const remove = async (id) => {
    if (window.confirm("Supprimer cet objectif ?")) await deleteObjective(id);
  };
  if (loading)
    return (
      <LoadingState unstyled as="div" className="objectives-v2-loading">Chargement des objectifs…</LoadingState>
    );
  return (
    <>
      {error && (
        <ErrorState unstyled as="p" className="objectives-v2-error">
          {error}
        </ErrorState>
      )}
      <ObjectivesV2View
        rows={rows}
        summary={summary}
        search={search}
        setSearch={setSearch}
        status={status}
        setStatus={setStatus}
        sort={sort}
        setSort={setSort}
        onCreate={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        onEdit={(objective) => {
          setEditing(objective);
          setFormOpen(true);
        }}
        onDelete={remove}
        onNavigate={onNavigate}
      />
      <ObjectiveForm
        open={formOpen}
        onClose={close}
        onSubmit={submit}
        isLoading={false}
        initialObjective={editing}
      />
    </>
  );
}

