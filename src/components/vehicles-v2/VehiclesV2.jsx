import { useMemo, useState } from "react";
import {
  Bell,
  CalendarClock,
  CarFront,
  ChevronDown,
  Gauge,
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
import VehicleFormDialog from "../VehicleFormDialog.jsx";
import { useVehicles } from "../../hooks/useVehicles.js";
import "../dashboard-v2/DashboardV2.css";
import "../recurring-income-v2/RecurringIncomeV2.css";
import "./VehiclesV2.css";
import { ActionBar, Card, KpiCard, SearchInput, Select, InfoCard, EmptyState, LoadingState, ErrorState } from "../ui";

const number = (value) =>
  Number.isFinite(Number(value)) ? Number(value) : null;
const mileage = (value) =>
  number(value) === null
    ? "À venir"
    : `${new Intl.NumberFormat("fr-FR").format(number(value))} km`;
const money = (value) =>
  number(value) === null
    ? "À venir"
    : new Intl.NumberFormat("fr-FR", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: 0,
      }).format(number(value));
const STATUS = { active: "Actif", maintenance: "En entretien", sold: "Vendu" };

function PageEmpty({ filtered, onCreate, onReset }) {
  return (
    <EmptyState unstyled as="div" className="v2-card recurring-v2-empty vehicles-v2-empty">
      <span>
        <CarFront size={31} />
      </span>
      <h2>{filtered ? "Aucun résultat" : "Aucun véhicule."}</h2>
      <p>
        {filtered
          ? "Aucun véhicule ne correspond aux critères sélectionnés."
          : "Ajoutez votre premier véhicule."}
      </p>
      <button
        type="button"
        className="recurring-v2-primary vehicles-v2-primary"
        onClick={filtered ? onReset : onCreate}
      >
        {filtered ? "Réinitialiser les filtres" : "Créer un véhicule"}
      </button>
    </EmptyState>
  );
}

export function VehiclesV2View({
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
  const maintenanceRows = rows.filter(
    (vehicle) => vehicle.nextMaintenance || vehicle.nextServiceDate,
  );
  return (
    <div className="horizon-v2 recurring-v2 vehicles-v2">
      <div className="v2-shell">
        <DashboardV2Sidebar active="vehicles" onNavigate={onNavigate} />
        <main className="v2-main recurring-v2-main vehicles-v2-main">
          <header className="v2-header">
            <div>
              <p className="v2-eyebrow">Organisation</p>
              <h1>Véhicules</h1>
              <p>Centralisez les informations et le suivi de vos véhicules.</p>
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
          <section className="recurring-v2-kpis vehicles-v2-kpis">
            <KpiCard
              className="v2-card recurring-v2-kpi vehicles-v2-kpi"
              icon={CarFront}
              label="Nombre de véhicules"
              value={String(summary.count || 0)}
              caption="Véhicules disponibles"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi vehicles-v2-kpi"
              icon={Gauge}
              label="Kilométrage total"
              value={mileage(summary.totalMileage)}
              caption="Selon les données disponibles"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi vehicles-v2-kpi"
              icon={CalendarClock}
              label="Entretiens à prévoir"
              value={summary.maintenanceCount ?? "À venir"}
              caption="Entretiens planifiés"
            />
            <KpiCard
              className="v2-card recurring-v2-kpi vehicles-v2-kpi"
              icon={WalletCards}
              label="Coût annuel"
              value={money(summary.annualCost)}
              caption="Selon les données disponibles"
            />
          </section>
      <ActionBar className="v2-card recurring-v2-actions vehicles-v2-actions">
            <label>
              <Search size={18} />
              <SearchInput unstyled
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un véhicule…"
                aria-label="Rechercher un véhicule"
              />
            </label>
            <Select unstyled
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filtres"
            >
              <option value="all">Tous les statuts</option>
              <option value="active">Actifs</option>
              <option value="maintenance">En entretien</option>
              <option value="sold">Vendus</option>
            </Select>
            <Select unstyled
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Tri"
            >
              <option value="name">Tri : nom</option>
              <option value="mileage">Tri : kilométrage</option>
            </Select>
            <button type="button" className="recurring-v2-filter">
              <SlidersHorizontal size={18} />
              Filtres
              <ChevronDown size={16} />
            </button>
            <button
              type="button"
              className="recurring-v2-primary vehicles-v2-primary"
              onClick={onCreate}
            >
              <Plus size={18} />
              Ajouter un véhicule
            </button>
      </ActionBar>
          <section className="recurring-v2-summary-grid">
            <InfoCard unstyled as="article" className="v2-card recurring-v2-expected vehicles-v2-fleet">
              <div>
                <p className="v2-eyebrow">Synthèse</p>
                <h2>Parc automobile</h2>
              </div>
              <div>
                <span>
                  Nombre<strong>{summary.count || 0}</strong>
                </span>
                <span>
                  Kilométrage moyen
                  <strong>{mileage(summary.averageMileage)}</strong>
                </span>
                <span>
                  Coût annuel<strong>{money(summary.annualCost)}</strong>
                </span>
              </div>
            </InfoCard>
            <InfoCard unstyled as="article" className="v2-card recurring-v2-distribution vehicles-v2-maintenance">
              <p className="v2-eyebrow">Suivi</p>
              <h2>Entretiens</h2>
              {maintenanceRows.length ? (
                <ul>
                  {maintenanceRows.map((vehicle) => (
                    <li key={vehicle.id}>
                      <strong>{vehicle.name}</strong>
                      <span>
                        {vehicle.nextMaintenance || vehicle.nextServiceDate}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState unstyled as="div" className="recurring-v2-distribution-empty">
                  Aucun entretien programmé.
                </EmptyState>
              )}
            </InfoCard>
          </section>
          <section
            className="recurring-v2-grid"
            aria-label={`${rows.length} véhicules affichés`}
          >
            {rows.map((vehicle) => {
              const statusLabel = STATUS[vehicle.status];
              return (
                <Card
                  className="v2-card recurring-v2-card vehicles-v2-card"
                  key={vehicle.id}
                >
                  <header>
                    <div>
                      {statusLabel && (
                        <span
                          className={`recurring-v2-status vehicles-v2-status ${vehicle.status}`}
                        >
                          <i />
                          {statusLabel}
                        </span>
                      )}
                      <h2>{vehicle.name || "Véhicule sans nom"}</h2>
                    </div>
                    <div className="recurring-v2-menu-wrap">
                      <button
                        type="button"
                        className="recurring-v2-menu-button"
                        aria-label={`Actions pour ${vehicle.name || "ce véhicule"}`}
                        aria-expanded={menuId === vehicle.id}
                        onClick={() =>
                          setMenuId((current) =>
                            current === vehicle.id ? "" : vehicle.id,
                          )
                        }
                      >
                        <MoreVertical size={20} />
                      </button>
                      {menuId === vehicle.id && (
                        <div className="recurring-v2-menu">
                          <button
                            type="button"
                            onClick={() => {
                              setMenuId("");
                              onEdit(vehicle);
                            }}
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            className="danger"
                            onClick={() => {
                              setMenuId("");
                              onDelete(vehicle);
                            }}
                          >
                            Supprimer
                          </button>
                        </div>
                      )}
                    </div>
                  </header>
                  <div className="vehicles-v2-hero">
                    <CarFront size={28} />
                    <span>Véhicule</span>
                  </div>
                  <dl>
                    {vehicle.brand && (
                      <div>
                        <dt>Marque</dt>
                        <dd>{vehicle.brand}</dd>
                      </div>
                    )}
                    {vehicle.model && (
                      <div>
                        <dt>Modèle</dt>
                        <dd>{vehicle.model}</dd>
                      </div>
                    )}
                    {vehicle.registration && (
                      <div>
                        <dt>Immatriculation</dt>
                        <dd>{vehicle.registration}</dd>
                      </div>
                    )}
                    {number(vehicle.mileage) !== null && (
                      <div>
                        <dt>Kilométrage</dt>
                        <dd>{mileage(vehicle.mileage)}</dd>
                      </div>
                    )}
                    {vehicle.lastMaintenance && (
                      <div>
                        <dt>Dernier entretien</dt>
                        <dd>{vehicle.lastMaintenance}</dd>
                      </div>
                    )}
                    {(vehicle.nextMaintenance || vehicle.nextServiceDate) && (
                      <div>
                        <dt>Prochain entretien</dt>
                        <dd>
                          {vehicle.nextMaintenance || vehicle.nextServiceDate}
                        </dd>
                      </div>
                    )}
                  </dl>
                </Card>
              );
            })}
            {rows.length === 0 && (
              <PageEmpty
                filtered={summary.count > 0}
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
      <DashboardV2MobileNavigation active="vehicles" onNavigate={onNavigate} />
    </div>
  );
}

export default function VehiclesV2({ onNavigate }) {
  const {
    vehicles = [],
    loading,
    error,
    addVehicle,
    editVehicle,
    removeVehicle,
  } = useVehicles();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [form, setForm] = useState(null);
  const rows = useMemo(
    () =>
      vehicles
        .filter((vehicle) =>
          String(vehicle.name || "")
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        )
        .filter((vehicle) => status === "all" || vehicle.status === status)
        .toSorted((left, right) =>
          sort === "mileage"
            ? (number(right.mileage) || 0) - (number(left.mileage) || 0)
            : String(left.name || "").localeCompare(
                String(right.name || ""),
                "fr",
              ),
        ),
    [vehicles, search, status, sort],
  );
  const summary = useMemo(() => {
    const mileages = vehicles
      .map((vehicle) => number(vehicle.mileage))
      .filter((value) => value !== null);
    const annualCosts = vehicles
      .map((vehicle) => number(vehicle.annualCost))
      .filter((value) => value !== null);
    const maintenance = vehicles.filter(
      (vehicle) => vehicle.nextMaintenance || vehicle.nextServiceDate,
    );
    return {
      count: vehicles.length,
      totalMileage: mileages.length
        ? mileages.reduce((sum, value) => sum + value, 0)
        : null,
      averageMileage: mileages.length
        ? mileages.reduce((sum, value) => sum + value, 0) / mileages.length
        : null,
      annualCost: annualCosts.length
        ? annualCosts.reduce((sum, value) => sum + value, 0)
        : null,
      maintenanceCount: maintenance.length ? maintenance.length : null,
    };
  }, [vehicles]);
  const save = (name) =>
    form?.id ? editVehicle(form.id, { name }) : addVehicle({ name });
  const remove = async (vehicle) => {
    if (window.confirm(`Supprimer le véhicule « ${vehicle.name} » ?`))
      await removeVehicle(vehicle.id);
  };
  if (loading)
    return (
      <LoadingState unstyled as="div" className="recurring-v2-loading">Chargement des véhicules…</LoadingState>
    );
  return (
    <>
      {error && (
        <ErrorState unstyled as="p" className="recurring-v2-error">
          {error}
        </ErrorState>
      )}
      <VehiclesV2View
        rows={rows}
        summary={summary}
        search={search}
        setSearch={setSearch}
        status={status}
        setStatus={setStatus}
        sort={sort}
        setSort={setSort}
        onCreate={() => setForm({ id: "", name: "" })}
        onEdit={(vehicle) => setForm({ id: vehicle.id, name: vehicle.name })}
        onDelete={remove}
        onNavigate={onNavigate}
      />
      {form && (
        <VehicleFormDialog
          open
          title={form.id ? "Modifier le véhicule" : "Ajouter un véhicule"}
          initialName={form.name}
          onClose={() => setForm(null)}
          onSave={save}
        />
      )}
    </>
  );
}
