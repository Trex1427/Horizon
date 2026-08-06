import { Bell, CalendarDays, ChevronDown } from "lucide-react";
import Budgets from "../../pages/Budgets.jsx";
import { DashboardV2MobileNavigation, DashboardV2Sidebar } from "../dashboard-v2/DashboardV2Navigation.jsx";
import "../dashboard-v2/DashboardV2.css";
import "../transactions-v2/TransactionsV2.css";

export default function BudgetsV2({ accounts = [], onNavigate, onOpenTransactionsFiltered = null }) {
  const openPeriodFilters = () => {
    const buttons = [...document.querySelectorAll(".budgets-v2-engine button")];
    buttons.find((button) => button.textContent?.includes("Filtres"))?.click();
  };

  return (
    <div className="horizon-v2 transactions-v2 budgets-v2">
      <div className="v2-shell">
        <DashboardV2Sidebar active="budgets" onNavigate={onNavigate} />
        <main className="v2-main transactions-v2-main budgets-v2-main">
          <header className="v2-header transactions-v2-header budgets-v2-header">
            <div>
              <p className="v2-eyebrow">Pilotage financier</p>
              <h1>Budgets</h1>
              <p>Suivez, classez et gérez toutes vos enveloppes de depenses.</p>
            </div>
            <div className="v2-header-actions">
              <button type="button" className="v2-period" aria-label="Choisir la période" onClick={openPeriodFilters}>
                <CalendarDays size={18} strokeWidth={1.8} />Ce mois<ChevronDown size={16} />
              </button>
              <button type="button" className="v2-bell" aria-label="Ouvrir les notifications"><Bell size={18} strokeWidth={1.8} /></button>
            </div>
          </header>

          <section className="transactions-v2-engine budgets-v2-engine" aria-label="Gestion des budgets">
            <Budgets accounts={accounts} onOpenTransactionsFiltered={onOpenTransactionsFiltered} />
          </section>
        </main>
      </div>
      <DashboardV2MobileNavigation active="budgets" onNavigate={onNavigate} />
    </div>
  );
}
