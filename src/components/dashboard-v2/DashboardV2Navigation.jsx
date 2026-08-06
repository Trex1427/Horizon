import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  BriefcaseBusiness,

  CalendarClock,
  CarFront,
  ChartNoAxesCombined,
  ChevronDown,
  CircleDollarSign,
  FileCheck2,
  FileText,
  Flag,
  Goal,
  HandCoins,
  House,
  Landmark,
  LayoutGrid,
  ReceiptText,
  Settings,
  Target,
  TrendingUp,
  WalletCards,
  X,
} from "lucide-react";

const NAVIGATION_GROUPS = [
  {
    id: "pilotage",
    label: "Pilotage",
    icon: TrendingUp,
    items: [
      ["home", "Accueil", House],
      ["transactions", "Transactions", ReceiptText],
      ["forecast", "Prévisions", ChartNoAxesCombined],
      ["analysis", "Analyse", BarChart3],
      ["reports", "Rapports", FileText],
    ],
  },
  {
    id: "financial",
    label: "Gestion financière",
    icon: CircleDollarSign,
    items: [
      ["accounts", "Comptes", Landmark],
      ["budgets", "Budgets", Target],
      ["recurring-income", "Revenus récurrents", CalendarClock],
      ["fixed-expenses", "Frais fixes", WalletCards],
      ["debts", "Dettes & créances", HandCoins],
    ],
  },
  {
    id: "organization",
    label: "Organisation",
    icon: Goal,
    items: [
      ["goals", "Objectifs", Goal],
      ["work", "Travail", BriefcaseBusiness],
      ["vehicles", "Véhicules", CarFront],
    ],
  },
  {
    id: "activity",
    label: "Activité",
    icon: FileText,
    items: [
      ["quotes", "Devis", FileText],
      ["invoices", "Factures", FileCheck2],
    ],
  },
  {
    id: "configuration",
    label: "Configuration",
    icon: Settings,
    items: [["settings", "Paramètres", Settings]],
  },
];

const MOBILE_PRIMARY_ITEMS = [
  ["home", "Accueil", House],
  ["transactions", "Transactions", ReceiptText],
  ["analysis", "Analyse", BarChart3],
  ["goals", "Objectifs", Goal],
];

const MOBILE_MORE_ITEMS = [
  ["accounts", "Comptes", Landmark],
  ["budgets", "Budgets", Target],
  ["forecast", "Prévisions", ChartNoAxesCombined],
  ["recurring-income", "Revenus récurrents", CalendarClock],
  ["fixed-expenses", "Frais fixes", WalletCards],
  ["debts", "Dettes & créances", HandCoins],
  ["work", "Travail", BriefcaseBusiness],
  ["vehicles", "Véhicules", CarFront],
  ["quotes", "Devis", FileText],
  ["invoices", "Factures", FileCheck2],
  ["reports", "Rapports", BarChart3],
  ["settings", "Paramètres", Settings],
];

function NavigationButton({ item, active, onNavigate, className = "" }) {
  const [id, label, Icon, destination = id] = item;
  return (
    <button
      type="button"
      className={`${className}${active === id ? " active" : ""}`}
      aria-current={active === id ? "page" : undefined}
      onClick={() => onNavigate?.(destination)}
    >
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

export function DashboardV2Sidebar({ active, onNavigate }) {
  return (
    <aside className="v2-sidebar">
      <div className="v2-brand">
        <span className="v2-brand-mark"><Flag size={16} strokeWidth={1.8} aria-hidden="true" /></span>
        <span className="v2-brand-copy"><strong>Horizon</strong><small>Gestion financière personnelle</small></span>
      </div>
      <nav className="v2-nav" aria-label="Navigation principale V2">
        {NAVIGATION_GROUPS.map((group) => {
          return (
            <section className="v2-nav-group" key={group.id} aria-labelledby={`v2-group-${group.id}`}>
              <h2 id={`v2-group-${group.id}`}>{group.label}</h2>
              <div>{group.items.map((item) => <NavigationButton key={item[0]} item={item} active={active} onNavigate={onNavigate} />)}</div>
            </section>
          );
        })}
      </nav>
    </aside>
  );
}

export function DashboardV2MobileNavigation({ active, onNavigate }) {
  const [open, setOpen] = useState(false);
  const moreButtonRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  const closeSheet = () => {
    setOpen(false);
    window.requestAnimationFrame(() => moreButtonRef.current?.focus());
  };

  const navigateFromSheet = (id) => {
    setOpen(false);
    onNavigate?.(id);
  };

  return (
    <>
      <nav className="v2-bottom-nav" aria-label="Navigation mobile V2">
        {MOBILE_PRIMARY_ITEMS.map((item) => <NavigationButton key={item[0]} item={item} active={active} onNavigate={onNavigate} />)}
        <button
          ref={moreButtonRef}
          type="button"
          className={open ? "active" : ""}
          aria-expanded={open}
          aria-controls="v2-more-sheet"
          onClick={() => setOpen(true)}
        >
          <LayoutGrid size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>Plus</span>
        </button>
      </nav>

      {open && (
        <div
          className="v2-sheet-backdrop"
          role="presentation"
          style={{ display: "flex" }}
          onMouseDown={(event) => event.target === event.currentTarget && closeSheet()}
        >
          <section
            id="v2-more-sheet"
            className="v2-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="v2-more-title"
            onKeyDown={(event) => event.key === "Escape" && closeSheet()}
          >
            <div className="v2-sheet-handle" aria-hidden="true" />
            <header>
              <div><p>Navigation</p><h2 id="v2-more-title">Plus</h2></div>
              <button ref={closeButtonRef} type="button" className="v2-sheet-close" onClick={closeSheet} aria-label="Fermer le menu Plus"><X size={18} /></button>
            </header>
            <div className="v2-sheet-grid">
              {MOBILE_MORE_ITEMS.map((item) => <NavigationButton key={item[0]} item={item} active={active} onNavigate={navigateFromSheet} />)}
            </div>
            <button type="button" className="v2-sheet-dismiss" onClick={closeSheet}>Fermer <ChevronDown size={16} /></button>
          </section>
        </div>
      )}
    </>
  );
}
