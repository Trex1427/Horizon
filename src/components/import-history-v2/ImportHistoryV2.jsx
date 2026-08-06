import { ReceiptText } from "lucide-react";
import { DashboardV2MobileNavigation, DashboardV2Sidebar } from "../dashboard-v2/DashboardV2Navigation.jsx";
import { useAccounts } from "../../hooks/useAccounts.js";
import { useTransactions } from "../../hooks/useTransactions.js";
import ImportHistorySection from "../../features/bankingImport/components/ImportHistorySection.jsx";
import "../dashboard-v2/DashboardV2.css";
import { ErrorState, LoadingState, SectionCard } from "../ui";

export default function ImportHistoryV2({ onNavigate }) {
  const { accounts = [], loading: accountsLoading, error: accountsError } = useAccounts();
  const { transactions = [], loading: transactionsLoading, error: transactionsError } = useTransactions();
  const loading = accountsLoading || transactionsLoading;
  const error = accountsError || transactionsError;

  return (
    <div className="horizon-v2 import-history-v2">
      <div className="v2-shell">
        <DashboardV2Sidebar active="settings" onNavigate={onNavigate} />
        <main className="v2-main">
          <header className="v2-header">
            <div>
              <p className="v2-eyebrow">Configuration</p>
              <h1>Historique des imports</h1>
              <p>Consultez et annulez les lots d'import bancaire en restant dans le shell V2.</p>
            </div>
          </header>

          {loading && (
            <LoadingState unstyled as="div" className="v2-card v2-empty">
              Chargement de l'historique...
            </LoadingState>
          )}

          {error && (
            <ErrorState unstyled as="p" className="v2-card v2-empty">
              {String(error)}
            </ErrorState>
          )}

          {!loading && !error && (
            <SectionCard unstyled as="section" className="v2-card v2-panel">
              <div className="v2-heading">
                <div>
                  <h2>Lots importes</h2>
                  <p>Suivi des imports et annulation securisee.</p>
                </div>
                <span className="v2-icon" aria-hidden="true">
                  <ReceiptText size={18} />
                </span>
              </div>
              <ImportHistorySection accounts={accounts} transactions={transactions} />
            </SectionCard>
          )}
        </main>
      </div>
      <DashboardV2MobileNavigation active="settings" onNavigate={onNavigate} />
    </div>
  );
}
