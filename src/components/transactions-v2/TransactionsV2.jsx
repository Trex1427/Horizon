import { Bell, CalendarDays, ChevronDown } from "lucide-react";
import Transactions from "../../pages/Transactions.jsx";
import { DashboardV2MobileNavigation, DashboardV2Sidebar } from "../dashboard-v2/DashboardV2Navigation.jsx";
import "../dashboard-v2/DashboardV2.css";
import "./TransactionsV2.css";

export default function TransactionsV2({ onNavigate, ...transactionsProps }) {
  const openPeriodFilters = () => {
    const buttons = [...document.querySelectorAll(".transactions-v2-engine button")];
    buttons.find((button) => button.textContent?.includes("Filtres"))?.click();
  };

  return (
    <div className="horizon-v2 transactions-v2">
      <div className="v2-shell">
        <DashboardV2Sidebar active="transactions" onNavigate={onNavigate} />
        <main className="v2-main transactions-v2-main">
          <header className="v2-header transactions-v2-header">
            <div>
              <p className="v2-eyebrow">Pilotage financier</p>
              <h1>Transactions</h1>
              <p>Suivez, classez et gérez tous vos mouvements financiers.</p>
            </div>
            <div className="v2-header-actions">
              <button type="button" className="v2-period" aria-label="Choisir la période" onClick={openPeriodFilters}>
                <CalendarDays size={18} strokeWidth={1.8} />Ce mois<ChevronDown size={16} />
              </button>
              <button type="button" className="v2-bell" aria-label="Ouvrir les notifications"><Bell size={18} strokeWidth={1.8} /></button>
            </div>
          </header>

          <section className="transactions-v2-engine" aria-label="Gestion des transactions">
            <Transactions {...transactionsProps} />
          </section>
        </main>
      </div>
      <DashboardV2MobileNavigation active="transactions" onNavigate={onNavigate} />
    </div>
  );
}
