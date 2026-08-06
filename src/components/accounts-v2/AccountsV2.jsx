import { useMemo, useState } from "react";
import {
  ArrowDownAZ,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  Landmark,
  MoreVertical,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";
import {
  DashboardV2MobileNavigation,
  DashboardV2Sidebar,
} from "../dashboard-v2/DashboardV2Navigation.jsx";
import "../dashboard-v2/DashboardV2.css";
import "./AccountsV2.css";
import { ActionBar, Card, CurrencyInput, Dialog, EmptyState, Input, KpiCard, SearchInput, Select } from "../ui";
import { ErrorState } from "../ui";

const EMPTY_FORM = { id: "", name: "", type: "standard", initialBalance: "0" };
const TYPE_LABELS = {
  standard: "Compte courant",
  savings: "Épargne",
  business: "Professionnel",
  cash: "Espèces",
  digital: "Numérique",
};

function amount(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function accountBalance(account) {
  const candidates = [
    account?.balance,
    account?.currentBalance,
    account?.initialBalance,
  ];
  return Number(
    candidates.find((value) => Number.isFinite(Number(value))) ?? 0,
  );
}

function dateLabel(value) {
  const raw =
    typeof value?.toDate === "function"
      ? value.toDate()
      : value
        ? new Date(value)
        : null;
  return raw && !Number.isNaN(raw.getTime())
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(raw)
    : "Non renseignée";
}

export default function AccountsV2({
  accounts = [],
  defaultAccount = null,
  addAccount,
  updateAccount,
  deleteAccount,
  onNavigate,
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("name");
  const [form, setForm] = useState(EMPTY_FORM);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState("");

  const visibleAccounts = useMemo(
    () =>
      accounts
        .filter(
          (account) =>
            status === "all" ||
            (status === "active"
              ? account?.isActive !== false
              : account?.isActive === false),
        )
        .filter((account) =>
          `${account?.name || ""} ${account?.bank || account?.bankName || ""} ${account?.type || ""}`
            .toLowerCase()
            .includes(search.trim().toLowerCase()),
        )
        .toSorted((left, right) =>
          sort === "balance"
            ? accountBalance(right) - accountBalance(left)
            : String(left?.name || "").localeCompare(
                String(right?.name || ""),
                "fr",
              ),
        ),
    [accounts, search, sort, status],
  );
  const totalBalance = accounts.reduce(
    (total, account) => total + accountBalance(account),
    0,
  );
  const principal =
    defaultAccount ||
    accounts.find((account) => account?.isDefault) ||
    accounts[0] ||
    null;

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setMessage("");
    setFormOpen(true);
  };
  const openEdit = (account) => {
    setForm({
      id: account.id,
      name: account.name || "",
      type: account.type || "standard",
      initialBalance: String(account.initialBalance ?? accountBalance(account)),
    });
    setMessage("");
    setFormOpen(true);
  };
  const save = async (event) => {
    event.preventDefault();
    const name = form.name.trim();
    const initialBalance = Number(form.initialBalance);
    if (!name || !Number.isFinite(initialBalance)) {
      setMessage("Renseignez un nom et un solde numérique.");
      return;
    }
    setSaving(true);
    const payload = { name, type: form.type, initialBalance, isActive: true };
    const result = form.id
      ? await updateAccount?.(form.id, payload)
      : await addAccount?.(payload);
    setSaving(false);
    if (!result?.success) {
      setMessage(result?.error || "Impossible d’enregistrer le compte.");
      return;
    }
    setFormOpen(false);
    setForm(EMPTY_FORM);
    setMessage("Compte enregistré.");
  };
  const remove = async (account) => {
    if (
      !window.confirm(`Supprimer le compte « ${account.name || "Compte"} » ?`)
    )
      return;
    const result = await deleteAccount?.(account.id);
    setMessage(
      result?.success === false
        ? result.error || "Suppression impossible."
        : "Compte supprimé.",
    );
  };

  return (
    <div className="horizon-v2 accounts-v2">
      <div className="v2-shell">
        <DashboardV2Sidebar active="accounts" onNavigate={onNavigate} />
        <main className="v2-main accounts-v2-main">
          <header className="v2-header">
            <div>
              <p className="v2-eyebrow">Gestion financière</p>
              <h1>Comptes</h1>
              <p>Visualisez tous vos comptes et leur évolution.</p>
            </div>
            <div className="v2-header-actions">
              <button type="button" className="v2-period">
                <CalendarDays size={18} />
                Ce mois
                <ChevronDown size={16} />
              </button>
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
            className="accounts-v2-kpis"
            aria-label="Indicateurs des comptes"
          >
            <KpiCard
              className="v2-card accounts-v2-kpi"
              icon={WalletCards}
              iconStrokeWidth={1.8}
              label="Nombre de comptes"
              value={String(accounts.length)}
              caption="Tous statuts"
            />
            <KpiCard
              className="v2-card accounts-v2-kpi"
              icon={Landmark}
              iconStrokeWidth={1.8}
              label="Solde total"
              value={amount(totalBalance)}
              caption="Données existantes"
            />
            <KpiCard
              className="v2-card accounts-v2-kpi"
              icon={Building2}
              iconStrokeWidth={1.8}
              label="Compte principal"
              value={principal?.name || "—"}
              caption={
                principal
                  ? `${amount(accountBalance(principal))} · ${TYPE_LABELS[principal.type] || principal.type || "Compte"}`
                  : "Non renseigné"
              }
            />
            <KpiCard
              className="v2-card accounts-v2-kpi"
              icon={ArrowDownAZ}
              iconStrokeWidth={1.8}
              label="Variation du mois"
              value="À venir"
              caption="Non calculée"
            />
          </section>
      <ActionBar className="v2-card accounts-v2-actions">
            <label>
              <Search size={18} />
              <SearchInput unstyled
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un compte…"
                aria-label="Rechercher un compte"
              />
            </label>
            <Select unstyled
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              aria-label="Filtrer les comptes"
            >
              <option value="all">Tous les comptes</option>
              <option value="active">Actifs</option>
              <option value="inactive">Inactifs</option>
            </Select>
            <Select unstyled
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Trier les comptes"
            >
              <option value="name">Tri : nom</option>
              <option value="balance">Tri : solde</option>
            </Select>
            <button type="button" className="accounts-v2-filter">
              <SlidersHorizontal size={18} />
              Filtres
            </button>
            <button
              type="button"
              className="accounts-v2-primary"
              onClick={openCreate}
            >
              <Plus size={18} />
              Ajouter un compte
            </button>
      </ActionBar>
          {message && (
            <p className="accounts-v2-message" role="status">
              {message}
            </p>
          )}
          <section
            className="accounts-v2-list"
            aria-label={`${visibleAccounts.length} comptes affichés`}
          >
            {visibleAccounts.map((account) => (
              <Card
                className={`v2-card accounts-v2-account${account.isActive === false ? " inactive" : ""}`}
                key={account.id || account.name}
              >
                <header>
                  <div className="accounts-v2-identity">
                    <span className="accounts-v2-account-icon">
                      <Landmark size={21} />
                    </span>
                    <div>
                      <strong>{account.name || "Compte"}</strong>
                      <small>
                        {TYPE_LABELS[account.type] || account.type || "Compte"}
                      </small>
                    </div>
                  </div>
                  <div className="accounts-v2-menu-wrap">
                    <button
                      type="button"
                      className="accounts-v2-menu-button"
                      aria-label={`Actions pour ${account.name || "ce compte"}`}
                      aria-expanded={openMenuId === account.id}
                      onClick={() =>
                        setOpenMenuId((current) =>
                          current === account.id ? "" : account.id,
                        )
                      }
                    >
                      <MoreVertical size={20} />
                    </button>
                    {openMenuId === account.id && (
                      <div className="accounts-v2-menu">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId("");
                            openEdit(account);
                          }}
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          className="danger"
                          onClick={() => {
                            setOpenMenuId("");
                            remove(account);
                          }}
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                </header>
                <div className="accounts-v2-balance">
                  <span>Solde disponible</span>
                  <strong>{amount(accountBalance(account))}</strong>
                </div>
                <div className="accounts-v2-meta">
                  <span>
                    <Building2 size={14} />
                    {account.bank ||
                      account.bankName ||
                      "Banque non renseignée"}
                  </span>
                  <span
                    className={
                      account.isActive === false ? "status inactive" : "status"
                    }
                  >
                    <ShieldCheck size={14} />
                    {account.isActive === false ? "Inactif" : "Actif"}
                  </span>
                </div>
                <footer>
                  <span>Dernière mise à jour</span>
                  <strong>{dateLabel(account.updatedAt)}</strong>
                </footer>
              </Card>
            ))}
            {visibleAccounts.length === 0 &&
              (accounts.length === 0 ? (
                <EmptyState unstyled as="div" className="v2-card accounts-v2-empty">
                  <span className="accounts-v2-empty-icon">
                    <WalletCards size={30} />
                  </span>
                  <h2>Votre espace financier commence ici</h2>
                  <p>
                    Ajoutez votre premier compte pour centraliser vos soldes et
                    suivre votre situation en un coup d’œil.
                  </p>
                  <button
                    type="button"
                    className="accounts-v2-primary"
                    onClick={openCreate}
                  >
                    <Plus size={18} />
                    Créer mon premier compte
                  </button>
                </EmptyState>
              ) : (
                <EmptyState unstyled as="div" className="v2-card accounts-v2-empty">
                  <span className="accounts-v2-empty-icon">
                    <Search size={28} />
                  </span>
                  <h2>Aucun résultat</h2>
                  <p>
                    Aucun compte ne correspond à votre recherche ou aux filtres
                    sélectionnés.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setStatus("all");
                    }}
                  >
                    Réinitialiser les filtres
                  </button>
                </EmptyState>
              ))}
          </section>
          {formOpen && (
            <Dialog open unstyled as="form"
                overlayClassName="accounts-v2-dialog-backdrop"
                className="v2-card accounts-v2-dialog"
                onSubmit={save}
                ariaLabelledby="account-v2-form-title"
                onClose={() => setFormOpen(false)}
                closeOnEscape={false}
                closeOnBackdrop={false}
              >
                <div>
                  <p>Compte</p>
                  <h2 id="account-v2-form-title">
                    {form.id ? "Modifier le compte" : "Ajouter un compte"}
                  </h2>
                </div>
                <label>
                  Nom
                  <Input unstyled
                    autoFocus
                    value={form.name}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  Type
                  <Select unstyled
                    value={form.type}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        type: event.target.value,
                      }))
                    }
                  >
                    {Object.entries(TYPE_LABELS).map(([value, label]) => (
                      <option value={value} key={value}>
                        {label}
                      </option>
                    ))}
                  </Select>
                </label>
                <label>
                  Solde initial
                  <CurrencyInput unstyled
                    type="number"
                    step="0.01"
                    value={form.initialBalance}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        initialBalance: event.target.value,
                      }))
                    }
                  />
                </label>
                {message && <ErrorState unstyled as="p">{message}</ErrorState>}
                <div className="accounts-v2-dialog-actions">
                  <button type="button" onClick={() => setFormOpen(false)}>
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="accounts-v2-primary"
                    disabled={saving}
                  >
                    {saving ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </div>
              </Dialog>
          )}
        </main>
      </div>
      <DashboardV2MobileNavigation active="accounts" onNavigate={onNavigate} />
    </div>
  );
}
