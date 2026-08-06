import { useMemo, useState } from "react";
import { Box, MenuItem, Stack, TextField, Typography, useMediaQuery } from "../components/ui/foundations/MuiPrimitives";
import { breakpoints, colors, elevation, radius } from "../components/ui/foundations";
import { useFixedExpenses } from "../hooks/useFixedExpenses";
import { useTransactions } from "../hooks/useTransactions";
import { useAccounts } from "../hooks/useAccounts";
import { useCategories } from "../hooks/useCategories";
import { useSubcategories } from "../hooks/useSubcategories";
import { FixedExpenseCard } from "../components/FixedExpenseCard";
import { FixedExpenseForm } from "../components/FixedExpenseForm";
import { TransactionUsageExplorer } from "../components/TransactionUsageExplorer.jsx";
import { buildFixedExpenseScheduleSnapshot } from "../components/fixedExpenseScheduleSnapshot.js";
import {
  buildFixedExpenseReconciliationLedger,
  buildReconciliationTransactionIndex,
} from "../services/reconciliationService";
import {
  AppEmptyState,
  AppPage,
  AppPrimaryAction,
  AppSection,
  AppStatCard,
  AppToolbar,
  AppAlert,
  LoadingMessageCard,
  PrimaryButton,
  SecondaryButton,
} from "../components/ui";
import {
  buildFixedExpenseAuditCsv,
  buildFixedExpenseAuditTimeline,
  buildFixedExpenseGuaranteeLines,
  buildFixedExpensesHealthMetrics,
  buildFixedExpenseSynchronizationMetrics,
  downloadCsvReport,
} from "../utils/fixedExpenseAuditViewModel.js";
import { buildFixedExpenseExplorerRows } from "../utils/transactionUsageExplorerModel.js";
import { findMatchingFixedExpenseForTransaction } from "../utils/transactionFixedExpenseLinking.js";

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function formatSignedCurrency(value) {
  const amount = Number(value || 0);
  const prefix = amount > 0 ? "+" : "";
  return `${prefix}${formatCurrency(amount)}`;
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0))} %`;
}

function normalizeSearch(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function formatOccurrenceDate(value) {
  if (!value) return "Date indisponible";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function getOccurrenceStateLabel(occurrence) {
  if (!occurrence) return "Prévision";
  if (occurrence.state === "transaction") return "Transaction";
  if (occurrence.state === "anomaly") return "Anomalie";
  return "Prévision";
}

const APP_COLORS = {
  green: colors.status.success,
  blue: colors.action.accent,
  orange: colors.status.warning,
  red: colors.status.danger,
  ink: colors.text.primary,
  muted: colors.text.secondary,
};

const APP_CARD_SX = {
  border: "1px solid",
  borderColor: colors.border.subtle,
  borderRadius: `${radius.md}px`,
  background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(246,248,244,0.96))",
  boxShadow: elevation.card,
};

export default function FraisFixes({ onOpenTransactionsFiltered = null }) {
  const enableDesktopDoubleClickEdit = useMediaQuery(breakpoints.up.md);
  const { fixedExpenses, loading, error, addFixedExpense, updateFixedExpense, deleteFixedExpense } =
    useFixedExpenses();
  const { transactions = [], updateTransaction, deleteTransaction } = useTransactions();
  const { accounts } = useAccounts();
  const { categories } = useCategories();
  const { subcategories } = useSubcategories();
  const [formOpen, setFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [linkedDialogOpen, setLinkedDialogOpen] = useState(false);
  const [linkedExpense, setLinkedExpense] = useState(null);
  const [linkedTransactionId, setLinkedTransactionId] = useState("");
  const [linkedDialogError, setLinkedDialogError] = useState("");
  const [reconciliationReferenceDate, setReconciliationReferenceDate] = useState(() => new Date());

  const accountMap = useMemo(
    () => new Map((accounts || []).map((account) => [account.id, account.name || ""])),
    [accounts]
  );

  const filteredFixedExpenses = useMemo(() => {
    const needle = normalizeSearch(searchText);
    if (!needle) return fixedExpenses;

    return fixedExpenses.filter((item) => normalizeSearch([
      item.name,
      item.categoryName,
      item.category,
      item.subcategoryName,
      accountMap.get(item.accountId),
    ].filter(Boolean).join(" ")).includes(needle));
  }, [accountMap, fixedExpenses, searchText]);

  const linkedTransactions = useMemo(() => {
    if (!linkedExpense) return [];
    return transactions.filter((transaction) => String(transaction.fixedExpenseId || "") === linkedExpense.id);
  }, [linkedExpense, transactions]);

  const reconciliationTransactionIndex = useMemo(
    () => buildReconciliationTransactionIndex(transactions),
    [transactions]
  );

  const fixedExpenseLedger = useMemo(() => buildFixedExpenseReconciliationLedger({
    fixedExpenses,
    transactions,
    transactionIndex: reconciliationTransactionIndex,
    periodStart: new Date(reconciliationReferenceDate.getFullYear(), 0, 1),
    periodEnd: new Date(reconciliationReferenceDate.getFullYear(), 11, 31, 23, 59, 59, 999),
    referenceDate: reconciliationReferenceDate,
  }), [fixedExpenses, reconciliationReferenceDate, reconciliationTransactionIndex, transactions]);

  const linkedExpenseReconciliation = useMemo(() => {
    if (!linkedExpense) return null;
    return fixedExpenseLedger.summaryByFixedExpenseId.get(String(linkedExpense.id || "")) || null;
  }, [fixedExpenseLedger, linkedExpense]);
  const linkedExpenseSnapshot = useMemo(() => {
    if (!linkedExpense) return null;
    return buildFixedExpenseScheduleSnapshot({
      fixedExpense: linkedExpense,
      transactions,
      transactionIndex: reconciliationTransactionIndex,
      referenceDate: reconciliationReferenceDate,
    });
  }, [linkedExpense, reconciliationReferenceDate, reconciliationTransactionIndex, transactions]);
  const linkedExpenseTimeline = useMemo(
    () => buildFixedExpenseAuditTimeline(linkedExpenseReconciliation),
    [linkedExpenseReconciliation]
  );
  const linkedExpenseGuarantee = useMemo(
    () => buildFixedExpenseGuaranteeLines(linkedExpenseReconciliation),
    [linkedExpenseReconciliation]
  );
  const linkedExpenseSynchronization = useMemo(
    () => buildFixedExpenseSynchronizationMetrics(linkedExpenseReconciliation),
    [linkedExpenseReconciliation]
  );
  const linkedExpenseExplorerRows = useMemo(
    () => buildFixedExpenseExplorerRows(linkedExpenseReconciliation, accounts),
    [accounts, linkedExpenseReconciliation]
  );

  const availableTransactions = useMemo(() => {
    if (!linkedExpense) return [];
    return transactions.filter((transaction) => String(transaction.fixedExpenseId || "") !== linkedExpense.id);
  }, [linkedExpense, transactions]);

  const summary = useMemo(() => {
    const active = fixedExpenses.filter((item) => item.isActive !== false);
    const inactive = fixedExpenses.length - active.length;
    const monthlyTotal = active.reduce((sum, item) => {
      const amount = Number(item.initialAmount || item.amount || 0);
      return sum + (item.frequency === "annual" ? amount / 12 : amount);
    }, 0);

    return { activeCount: active.length, inactiveCount: inactive, monthlyTotal };
  }, [fixedExpenses]);
  const healthMetrics = useMemo(
    () => buildFixedExpensesHealthMetrics({ fixedExpenses, ledger: fixedExpenseLedger }),
    [fixedExpenseLedger, fixedExpenses]
  );

  const handleSubmit = async (payload) => {
    console.log("[CREATE FIXED]", "service =", "FraisFixes");
    console.log("[CREATE FIXED]", "function =", "handleSubmit");
    if (editingExpense) {
      console.log("[CREATE FIXED]", "next =", "updateFixedExpense(editingExpense.id, payload)");
      return updateFixedExpense(editingExpense.id, payload);
    }

    console.log("[CREATE FIXED]", "next =", "addFixedExpense(payload)");
    return addFixedExpense(payload);
  };

  const handleEdit = (fixedExpense) => {
    setEditingExpense(fixedExpense);
    setFormOpen(true);
  };

  const handleViewTransactions = (fixedExpense) => {
    setLinkedExpense(fixedExpense);
    setLinkedTransactionId("");
    setLinkedDialogError("");
    setLinkedDialogOpen(true);
  };

  const handleCloseLinkedDialog = () => {
    setLinkedDialogOpen(false);
    setLinkedExpense(null);
    setLinkedTransactionId("");
    setLinkedDialogError("");
  };

  const handleLinkTransaction = async () => {
    if (!linkedExpense || !linkedTransactionId) {
      setLinkedDialogError("Sélectionnez une transaction à associer.");
      return;
    }

    const transaction = transactions.find((item) => item.id === linkedTransactionId);
    if (!transaction) {
      setLinkedDialogError("Transaction introuvable.");
      return;
    }

    const result = await updateTransaction(transaction.id, {
      ...transaction,
      fixedExpenseId: linkedExpense.id,
    });

    if (!result.success) {
      setLinkedDialogError(result.error || "Impossible d'associer la transaction.");
      return;
    }

    setLinkedTransactionId("");
    setLinkedDialogError("");
  };

  const handleUnlinkTransaction = async (transaction) => {
    const result = await updateTransaction(transaction.id, {
      ...transaction,
      fixedExpenseId: null,
    });

    if (!result.success) {
      setLinkedDialogError(result.error || "Impossible de retirer l'association.");
    }
  };

  const handleClose = () => {
    setFormOpen(false);
    setEditingExpense(null);
  };

  const handleExportAudit = () => {
    if (!linkedExpenseReconciliation || !linkedExpense) return;
    const report = buildFixedExpenseAuditCsv(linkedExpenseReconciliation);
    const safeName = String(linkedExpense.name || "frais-fixe")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "frais-fixe";
    downloadCsvReport(report, `audit-${safeName}.csv`);
  };

  const handleOpenTransaction = (transaction) => {
    onOpenTransactionsFiltered?.({
      source: "card-explorer",
      transactionIds: transaction?.id ? [transaction.id] : [],
      openTransactionId: transaction?.id || null,
      openMode: "edit",
      requestId: Date.now(),
    });
  };

  const handleDeleteLinkedTransaction = async (transaction) => {
    const result = await deleteTransaction(transaction.id);
    if (!result.success) {
      setLinkedDialogError(result.error || "Impossible de supprimer la transaction.");
      return;
    }
    setLinkedDialogError("");
  };

  const handleRerunTransactionReconciliation = async (transaction) => {
    const matchingFixedExpense = findMatchingFixedExpenseForTransaction(transaction, fixedExpenses);
    if (!matchingFixedExpense) {
      setLinkedDialogError("Aucun frais fixe compatible n'a été retrouvé pour cette transaction.");
      return;
    }

    const result = await updateTransaction(transaction.id, {
      ...transaction,
      fixedExpenseId: matchingFixedExpense.id,
    });

    if (!result.success) {
      setLinkedDialogError(result.error || "Impossible de relancer la réconciliation.");
      return;
    }

    setLinkedDialogError("");
    setReconciliationReferenceDate(new Date());
  };

  if (loading) {
    return (
      <LoadingMessageCard
        title="Chargement des frais fixes..."
        description="Preparation de la liste et des details de reconciliation."
      />
    );
  }

  return (
    <AppPage>
      <AppToolbar
        title="Frais fixes"
        subtitle="Horizon V2 · Pilotage financier"
        countLabel={`${fixedExpenses.length} fiche(s) · ${summary.activeCount} active(s)`}
        search={(
          <TextField
            size="small"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Rechercher un frais fixe"
            aria-label="Rechercher un frais fixe"
            fullWidth
          />
        )}
        actions={(
          <>
            <SecondaryButton
              aria-label="Recalculer les associations avec le service de réconciliation"
              onClick={() => setReconciliationReferenceDate(new Date())}
            >
              Recalculer les associations
            </SecondaryButton>
            <AppPrimaryAction
              onClick={() => {
                setEditingExpense(null);
                setFormOpen(true);
              }}
            >
              Ajouter
            </AppPrimaryAction>
          </>
        )}
      />

      {error && <AppAlert severity="error">{error}</AppAlert>}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1.15 }}>
        <AppStatCard label="Total mensuel prévu" value={formatCurrency(summary.monthlyTotal)} color={APP_COLORS.red} />
        <AppStatCard label="Actifs" value={summary.activeCount} color={APP_COLORS.blue} />
        <AppStatCard label="Inactifs" value={summary.inactiveCount} color={APP_COLORS.muted} />
      </Box>

      <AppSection
        title="Tableau de santé global"
        subtitle="Lecture instantanée du moteur de réconciliation"
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", xl: "repeat(4, minmax(0, 1fr))" },
            gap: 1,
          }}
        >
          {[
            { label: "Frais fixes", value: healthMetrics.fixedExpenseCount, caption: "fiches surveillées", color: APP_COLORS.ink },
            { label: "Échéances", value: healthMetrics.occurrenceCount, caption: "toutes occurrences", color: APP_COLORS.blue },
            { label: "Réconciliées", value: healthMetrics.reconciledCount, caption: "transaction trouvée", color: APP_COLORS.green },
            { label: "Prévisions", value: healthMetrics.forecastCount, caption: "encore visibles", color: APP_COLORS.orange },
            { label: "Anomalies", value: healthMetrics.anomalyCount, caption: "à vérifier", color: APP_COLORS.red },
            { label: "Doublon comptable", value: healthMetrics.duplicateAccountingCount, caption: "même transaction réutilisée", color: healthMetrics.duplicateAccountingCount > 0 ? APP_COLORS.red : APP_COLORS.green },
          ].map((item) => (
            <Box key={item.label} sx={{ ...APP_CARD_SX, p: 1.25 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                {item.label}
              </Typography>
              <Typography sx={{ mt: 0.35, fontWeight: 900, color: item.color, fontSize: { xs: "1.4rem", sm: "1.55rem" } }}>
                {item.value}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {item.caption}
              </Typography>
            </Box>
          ))}

          <Box sx={{ ...APP_CARD_SX, p: 1.25 }} aria-label="Indice de fiabilité">
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
              Indice de fiabilité
            </Typography>
            <Typography sx={{ mt: 0.35, fontWeight: 900, color: APP_COLORS.green, fontSize: { xs: "1.4rem", sm: "1.55rem" } }}>
              {formatPercent(healthMetrics.reliabilityIndex)}
            </Typography>
            <Box sx={{ mt: 0.8, height: 8, borderRadius: 999, bgcolor: "rgba(20, 41, 43, 0.08)", overflow: "hidden" }}>
              <Box
                sx={{
                  width: `${healthMetrics.reliabilityIndex}%`,
                  height: "100%",
                  bgcolor: healthMetrics.reliabilityIndex >= 100 ? APP_COLORS.green : APP_COLORS.orange,
                }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Part des échéances déjà réconciliées avec une transaction réelle.
            </Typography>
          </Box>

          <Box sx={{ ...APP_CARD_SX, p: 1.25 }} aria-label="Garantie globale du moteur">
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
              Garantie
            </Typography>
            <Box component="ul" sx={{ m: 0, mt: 0.6, pl: 2.25 }}>
              {[
                "Une seule valeur comptable utilisée par échéance",
                healthMetrics.duplicateAccountingCount > 0 ? "Des doublons comptables existent" : "Aucun doublon détecté",
                healthMetrics.forecastCount > 0 ? "Les prévisions non couvertes restent visibles" : "Prévisions automatiquement remplacées",
              ].map((line) => (
                <Typography key={line} component="li" variant="body2" sx={{ display: "list-item", color: APP_COLORS.ink }}>
                  ✓ {line}
                </Typography>
              ))}
            </Box>
          </Box>
        </Box>
      </AppSection>

      <AppSection
        title="Liste principale"
        subtitle={`${filteredFixedExpenses.length} fiche(s) affichée(s)`}
      >
        {filteredFixedExpenses.length === 0 ? (
          <AppEmptyState>
            {fixedExpenses.length === 0 ? "Aucun frais fixe pour le moment." : "Aucune correspondance de recherche."}
          </AppEmptyState>
        ) : (
          <Stack spacing={1}>
            {filteredFixedExpenses.map((fixedExpense) => (
              <FixedExpenseCard
                key={fixedExpense.id}
                fixedExpense={fixedExpense}
                onEdit={handleEdit}
                onDelete={deleteFixedExpense}
                onViewTransactions={handleViewTransactions}
                accounts={accounts}
                transactions={transactions}
                transactionIndex={reconciliationTransactionIndex}
                reconciliationSummary={fixedExpenseLedger.summaryByFixedExpenseId.get(String(fixedExpense.id || "")) || null}
                enableDoubleClickEdit={enableDesktopDoubleClickEdit}
              />
            ))}
          </Stack>
        )}
      </AppSection>

      <FixedExpenseForm
        open={formOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        initialExpense={editingExpense}
        isLoading={false}
        accounts={accounts}
        categories={categories}
        subcategories={subcategories}
      />

      <TransactionUsageExplorer
        open={linkedDialogOpen}
        title={linkedExpense ? `${linkedExpense.name || "Frais fixe"}` : "Audit des échéances"}
        subtitle={linkedExpense ? `Montant ${formatCurrency(linkedExpense.initialAmount || linkedExpense.amount || 0)} · Fréquence ${linkedExpense.frequency || "monthly"} · Synchronisation ${linkedExpenseReconciliation?.auditLabel || "en attente"}` : ""}
        summaryItems={linkedExpenseSnapshot && linkedExpenseReconciliation ? [
          { label: "Dernier paiement", value: linkedExpenseSnapshot.lastPayment?.date ? formatOccurrenceDate(linkedExpenseSnapshot.lastPayment.date) : "Aucun paiement détecté" },
          { label: "Prochaine échéance", value: linkedExpenseSnapshot.nextEstimatedDate ? formatOccurrenceDate(linkedExpenseSnapshot.nextEstimatedDate) : "Estimation indisponible" },
          { label: "Paiements détectés", value: linkedExpenseSnapshot.paymentCount },
          { label: "Prévisions restantes", value: linkedExpenseSynchronization.forecastCount },
          { label: "Transactions liées", value: linkedExpenseSynchronization.transactionCount },
          { label: "Écart cumulé", value: formatSignedCurrency(linkedExpenseSynchronization.cumulativeDelta) },
        ] : []}
        transactionRows={linkedExpenseExplorerRows}
        timeline={linkedExpenseReconciliation && linkedExpenseReconciliation.occurrences.length > 0 ? (
          <Box sx={{ mb: 0.5 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Timeline de réconciliation</Typography>
            <Stack spacing={0.75}>
              {linkedExpenseTimeline.map((entry) => (
                <Box key={entry.id} sx={{ border: "1px solid rgba(20, 41, 43, 0.1)", borderRadius: 1.25, px: 1, py: 0.95, bgcolor: "rgba(248, 250, 247, 0.7)" }} aria-label={`Timeline ${entry.monthLabel}`}>
                  <Typography variant="body2" sx={{ fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    {entry.monthLabel}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {entry.dateLabel} · {entry.auditLabel}
                  </Typography>
                  <Stack spacing={0.5} sx={{ mt: 0.8 }}>
                    {entry.steps.map((step) => (
                      <Box key={step.key} sx={{ display: "grid", gridTemplateColumns: "12px 1fr", gap: 0.65, alignItems: "start" }}>
                        <Typography variant="body2" aria-hidden="true">↓</Typography>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: step.tone === "emphasis" ? 800 : 700, color: step.tone === "warning" ? "warning.main" : step.tone === "success" ? "success.main" : "text.primary" }}>
                            {step.label}
                            {typeof step.value === "number" ? ` · ${formatSignedCurrency(step.key === "delta" ? step.value : Math.abs(step.value))}` : ""}
                          </Typography>
                          {step.detail && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                              {step.detail}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                </Box>
              ))}
            </Stack>
          </Box>
        ) : null}
        proof={linkedExpenseReconciliation ? (
          <Box>
            {linkedDialogError && <AppAlert severity="error" sx={{ mb: 1 }}>{linkedDialogError}</AppAlert>}
            <Box sx={{ ...APP_CARD_SX, p: 1.1 }} aria-label="Preuves de réconciliation">
              <Typography variant="subtitle2" sx={{ mb: 0.75 }}>PREUVES</Typography>
              <Typography variant="body2">Prévision: {linkedExpenseReconciliation.forecastCount}</Typography>
              <Typography variant="body2">Transactions réelles: {linkedExpenseReconciliation.transactionCount}</Typography>
              <Typography variant="body2">Valeur comptable retenue: {formatCurrency((linkedExpenseReconciliation.occurrences || []).reduce((sum, occurrence) => sum + Number(occurrence.accountingValue || 0), 0))}</Typography>
              <Typography variant="body2">Double comptage: {linkedExpenseSynchronization.duplicateAccountingCount}</Typography>
              <Box component="ul" sx={{ m: 0, mt: 0.6, pl: 2.25 }}>
                {linkedExpenseGuarantee.map((line) => (
                  <Typography key={line} component="li" variant="body2" sx={{ display: "list-item" }}>
                    ✓ {line}
                  </Typography>
                ))}
              </Box>
              <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 800, color: linkedExpenseReconciliation.anomalyCount > 0 ? "warning.main" : "success.main" }}>
                {linkedExpenseReconciliation.anomalyCount > 0 ? "⚠ Une anomalie détectée" : "✓ Aucun doublon détecté"}
              </Typography>
            </Box>

            <Box sx={{ mt: 1.25 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.75 }}>Ajouter une transaction</Typography>
              <TextField
                label="Transaction disponible"
                select
                value={linkedTransactionId}
                onChange={(event) => setLinkedTransactionId(event.target.value)}
                fullWidth
                size="small"
              >
                <MenuItem value="">Sélectionner</MenuItem>
                {availableTransactions.map((transaction) => (
                  <MenuItem key={transaction.id} value={transaction.id}>
                    {transaction.description || transaction.rawLabel || transaction.label || transaction.id}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>
        ) : null}
        emptyMessage="Aucune transaction liée pour ce frais fixe."
        onClose={handleCloseLinkedDialog}
        onOpenTransaction={handleOpenTransaction}
        onEditTransaction={handleOpenTransaction}
        onDeleteTransaction={handleDeleteLinkedTransaction}
        onDetachTransaction={handleUnlinkTransaction}
        onRerunReconciliation={handleRerunTransactionReconciliation}
        footer={(
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">
            <SecondaryButton onClick={handleExportAudit} disabled={!linkedExpenseReconciliation}>Exporter le rapport d'audit</SecondaryButton>
            <SecondaryButton onClick={handleCloseLinkedDialog}>Fermer</SecondaryButton>
            <PrimaryButton onClick={handleLinkTransaction} disabled={!linkedTransactionId}>Ajouter</PrimaryButton>
          </Stack>
        )}
      />
    </AppPage>
  );
}

