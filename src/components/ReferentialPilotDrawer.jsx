import { useMemo } from "react";
import { Alert, Box, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { buildTransactionUsageTotals, filterTransactionUsageRows, sortTransactionUsageRows } from "../utils/transactionUsageExplorerModel.js";
import { AppCard, AppDrawer, AppInfoList, AppSecondaryAction, AppTimeline, SectionCard } from "./ui";

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR").format(Number(value || 0));
}

export function ReferentialPilotDrawer({
  open = false,
  detail = null,
  searchText = "",
  sortKey = "alphabetical",
  transactionFilters = {},
  transactionSort = { field: "date", direction: "desc" },
  onSearchChange,
  onSortChange,
  onTransactionFiltersChange,
  onTransactionSortChange,
  onClose,
  onOpenReference,
  onOpenTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onRename,
  onToggleActive,
  onOpenMergePreview,
}) {
  const visibleTransactions = useMemo(() => {
    const filtered = filterTransactionUsageRows(detail?.transactionRows || [], transactionFilters || {});
    return sortTransactionUsageRows(filtered, transactionSort || {});
  }, [detail?.transactionRows, transactionFilters, transactionSort]);
  const transactionTotals = useMemo(() => buildTransactionUsageTotals(visibleTransactions), [visibleTransactions]);

  if (!detail) return null;

  const infoKpis = [
    { label: "Statut", value: detail.status },
    { label: "Type", value: detail.type },
    { label: "Utilisations", value: formatNumber(detail.usageCount) },
    { label: "Transactions", value: formatNumber(detail.transactionRows.length) },
  ];

  const transactionsPanel = (
    <Stack spacing={0.9}>
      <details>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Options avancées</summary>
        <Stack direction={{ xs: "column", lg: "row" }} spacing={1} useFlexGap sx={{ mt: 1 }}>
          <TextField size="small" label="Compte" value={transactionFilters.account || "all"} onChange={(event) => onTransactionFiltersChange?.({ ...transactionFilters, account: event.target.value })} select sx={{ minWidth: { xs: "100%", lg: 180 } }}>
            <MenuItem value="all">Tous les comptes</MenuItem>
            {[...new Set((detail.transactionRows || []).map((row) => row.account))].filter(Boolean).map((account) => <MenuItem key={account} value={account}>{account}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Date début" type="date" value={transactionFilters.fromDate || ""} onChange={(event) => onTransactionFiltersChange?.({ ...transactionFilters, fromDate: event.target.value })} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField size="small" label="Date fin" type="date" value={transactionFilters.toDate || ""} onChange={(event) => onTransactionFiltersChange?.({ ...transactionFilters, toDate: event.target.value })} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField size="small" label="Montant min" type="number" value={transactionFilters.minAmount || ""} onChange={(event) => onTransactionFiltersChange?.({ ...transactionFilters, minAmount: event.target.value })} fullWidth />
          <TextField size="small" label="Montant max" type="number" value={transactionFilters.maxAmount || ""} onChange={(event) => onTransactionFiltersChange?.({ ...transactionFilters, maxAmount: event.target.value })} fullWidth />
          <TextField size="small" label="Tri" value={`${transactionSort.field}:${transactionSort.direction}`} onChange={(event) => {
            const [field, direction] = String(event.target.value).split(":");
            onTransactionSortChange?.({ field, direction });
          }} select sx={{ minWidth: { xs: "100%", lg: 180 } }}>
            <MenuItem value="date:desc">Date décroissante</MenuItem>
            <MenuItem value="date:asc">Date croissante</MenuItem>
            <MenuItem value="amount:desc">Montant décroissant</MenuItem>
            <MenuItem value="amount:asc">Montant croissant</MenuItem>
            <MenuItem value="account:asc">Compte A-Z</MenuItem>
          </TextField>
        </Stack>
      </details>

      <Typography variant="body2" color="text.secondary">
        {transactionTotals.count} transaction(s) · {formatCurrency(transactionTotals.totalAmount)}
      </Typography>

      {visibleTransactions.length === 0 ? (
        <Alert severity="info">Aucune transaction liée à ce référentiel.</Alert>
      ) : (
        <Stack spacing={0.8}>
          {visibleTransactions.map((row) => (
            <AppCard key={row.id} sx={{ p: 1 }}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 800 }}>{row.description}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{new Intl.DateTimeFormat("fr-FR").format(new Date(row.date))} · {row.account}</Typography>
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 900 }}>{formatCurrency(row.amount)}</Typography>
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75} useFlexGap sx={{ mt: 0.8 }}>
                <AppSecondaryAction onClick={() => onOpenTransaction?.(row.transaction)}>Ouvrir</AppSecondaryAction>
                <AppSecondaryAction onClick={() => onEditTransaction?.(row.transaction)}>Modifier</AppSecondaryAction>
                <AppSecondaryAction onClick={() => onDeleteTransaction?.(row.transaction)}>Supprimer</AppSecondaryAction>
              </Stack>
            </AppCard>
          ))}
        </Stack>
      )}
    </Stack>
  );

  const statisticsPanel = (
    <AppInfoList
      items={[
        { label: "Montant total", value: formatCurrency(detail.stats.totalAmount) },
        { label: "Montant moyen", value: formatCurrency(detail.stats.averageAmount) },
        { label: "Montant minimum", value: formatCurrency(detail.stats.minAmount) },
        { label: "Montant maximum", value: formatCurrency(detail.stats.maxAmount) },
        { label: "Première utilisation", value: detail.stats.firstUsage ? new Intl.DateTimeFormat("fr-FR").format(detail.stats.firstUsage) : "Aucune" },
        { label: "Dernière utilisation", value: detail.stats.lastUsage ? new Intl.DateTimeFormat("fr-FR").format(detail.stats.lastUsage) : "Aucune" },
        { label: "Mois concernés", value: formatNumber(detail.stats.monthsCount) },
      ]}
    />
  );

  const historyPanel = (
    <AppTimeline
      items={visibleTransactions.slice(0, 8).map((row) => ({
        id: row.id,
        title: row.description,
        subtitle: `${new Intl.DateTimeFormat("fr-FR").format(new Date(row.date))} · ${formatCurrency(row.amount)}`,
      }))}
    />
  );

  const infoPanel = (
    <Stack spacing={0.9}>
      <AppInfoList
        items={[
          { label: "Création", value: detail.createdAtLabel },
          { label: "Dernière modification", value: detail.updatedAtLabel },
          { label: "Recherche", value: searchText || "Aucun filtre" },
          { label: "Tri", value: sortKey },
        ]}
      />
      <Stack direction={{ xs: "column", lg: "row" }} spacing={1} useFlexGap>
        <TextField size="small" label="Recherche instantanée" value={searchText} onChange={(event) => onSearchChange?.(event.target.value)} fullWidth />
        <TextField size="small" select label="Tri" value={sortKey} onChange={(event) => onSortChange?.(event.target.value)} sx={{ minWidth: { xs: "100%", lg: 220 } }}>
          <MenuItem value="alphabetical">Alphabétique</MenuItem>
          <MenuItem value="mostUsed">Plus utilisé</MenuItem>
          <MenuItem value="lastUsage">Dernière utilisation</MenuItem>
          <MenuItem value="totalAmount">Montant total</MenuItem>
          <MenuItem value="transactionCount">Nombre de transactions</MenuItem>
          <MenuItem value="custom">Ordre personnalisé</MenuItem>
        </TextField>
      </Stack>
      <SectionCard title="Relations" description="Référentiels croisés" className="hui-card--outlined">
        {detail.relations.length === 0 ? (
          <Alert severity="info">Aucune relation croisée détectée.</Alert>
        ) : (
          <Stack spacing={0.75}>
            {detail.relations.map((relation) => (
              <Box key={`${detail.id}-${relation.label}`} sx={{ p: 1, borderRadius: 1.25, border: "1px solid rgba(20,41,43,0.1)" }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }}>{relation.label}</Typography>
                <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.6 }}>
                  {relation.items.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">Aucun</Typography>
                  ) : relation.items.map((item) => (
                    <AppSecondaryAction key={`${relation.type}-${item.id}`} onClick={() => onOpenReference?.(relation.type, item.id)}>{item.name}</AppSecondaryAction>
                  ))}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </SectionCard>
    </Stack>
  );

  return (
    <AppDrawer
      open={open}
      onClose={onClose}
      title={detail.name}
      subtitle={detail.type}
      kpis={infoKpis}
      sections={[
        { title: "Informations", subtitle: "Contexte et dépendances", content: infoPanel },
        { title: "Transactions", subtitle: "Lignes associées au référentiel", content: transactionsPanel },
        { title: "Statistiques", subtitle: "Synthèse des montants et périodes", content: statisticsPanel },
        { title: "Historique", subtitle: "Derniers mouvements liés", content: historyPanel },
      ]}
      actions={(
        <>
          <AppSecondaryAction onClick={() => onRename?.(detail)}>Renommer</AppSecondaryAction>
          <AppSecondaryAction onClick={() => onToggleActive?.(detail)}>{detail.status === "Actif" ? "Désactiver" : "Réactiver"}</AppSecondaryAction>
          <AppSecondaryAction onClick={() => onOpenMergePreview?.(detail, "merge")}>Fusionner</AppSecondaryAction>
          <AppSecondaryAction onClick={() => onOpenMergePreview?.(detail, "replace")}>Remplacer par...</AppSecondaryAction>
        </>
      )}
    />
  );
}
