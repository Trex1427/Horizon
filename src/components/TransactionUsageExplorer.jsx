import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
} from "./ui/foundations/MuiPrimitives";
import { BottomSheet, Drawer } from "./ui";
import { filterTransactionUsageRows, sortTransactionUsageRows, buildTransactionUsageTotals } from "../utils/transactionUsageExplorerModel.js";

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "Date indisponible";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Date indisponible";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function TransactionUsageExplorer({
  open = false,
  title = "Détail des transactions",
  subtitle = "",
  summaryItems = [],
  transactionRows = [],
  timeline = null,
  proof = null,
  emptyMessage = "Aucune transaction utilisée.",
  footer = null,
  onClose,
  onOpenTransaction,
  onEditTransaction,
  onDeleteTransaction,
  onDetachTransaction,
  onRerunReconciliation,
}) {
  const isMobile = useMediaQuery("(max-width:899px)");
  const scrollRestoreRef = useRef(0);
  const [filters, setFilters] = useState({
    searchText: "",
    account: "all",
    fromDate: "",
    toDate: "",
    minAmount: "",
    maxAmount: "",
  });
  const [sort, setSort] = useState({ field: "date", direction: "desc" });

  useEffect(() => {
    if (open) {
      scrollRestoreRef.current = typeof window !== "undefined" ? window.scrollY : 0;
      return undefined;
    }

    if (typeof window !== "undefined") {
      window.scrollTo({ top: scrollRestoreRef.current, behavior: "auto" });
    }

    return undefined;
  }, [open]);

  const accountOptions = useMemo(() => {
    const seen = new Set();
    const options = [];
    (transactionRows || []).forEach((row) => {
      const value = String(row?.account || "").trim();
      if (!value || seen.has(value)) return;
      seen.add(value);
      options.push(value);
    });
    return options.sort((left, right) => left.localeCompare(right, "fr", { sensitivity: "base" }));
  }, [transactionRows]);

  const visibleRows = useMemo(() => {
    const filtered = filterTransactionUsageRows(transactionRows, filters);
    return sortTransactionUsageRows(filtered, sort);
  }, [filters, sort, transactionRows]);

  const totals = useMemo(() => buildTransactionUsageTotals(visibleRows), [visibleRows]);

  const shell = (
    <Stack spacing={1.25} sx={{ minWidth: 0 }}>
      <Box>
        <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
      </Box>

      {summaryItems.length > 0 && (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
            gap: 1,
          }}
          aria-label="Synthèse du détail des transactions"
        >
          {summaryItems.map((item) => (
            <Box key={item.label} sx={{ p: 1, borderRadius: 1.25, border: "1px solid rgba(20, 41, 43, 0.1)", bgcolor: "rgba(248, 250, 247, 0.8)" }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{item.label}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 800 }}>{item.value}</Typography>
            </Box>
          ))}
        </Box>
      )}

      <Stack spacing={1} direction={{ xs: "column", lg: "row" }} useFlexGap>
        <TextField size="small" label="Recherche" value={filters.searchText} onChange={(event) => setFilters((previous) => ({ ...previous, searchText: event.target.value }))} fullWidth />
        <TextField size="small" select label="Tri" value={`${sort.field}:${sort.direction}`} onChange={(event) => {
          const [field, direction] = String(event.target.value || "date:desc").split(":");
          setSort({ field, direction });
        }} sx={{ minWidth: { xs: "100%", lg: 180 } }}>
          <MenuItem value="date:desc">Date décroissante</MenuItem>
          <MenuItem value="date:asc">Date croissante</MenuItem>
          <MenuItem value="amount:desc">Montant décroissant</MenuItem>
          <MenuItem value="amount:asc">Montant croissant</MenuItem>
          <MenuItem value="account:asc">Compte A-Z</MenuItem>
        </TextField>
        <TextField size="small" select label="Compte" value={filters.account} onChange={(event) => setFilters((previous) => ({ ...previous, account: event.target.value }))} sx={{ minWidth: { xs: "100%", lg: 180 } }}>
          <MenuItem value="all">Tous les comptes</MenuItem>
          {accountOptions.map((account) => <MenuItem key={account} value={account}>{account}</MenuItem>)}
        </TextField>
      </Stack>

      <Stack spacing={1} direction={{ xs: "column", md: "row" }} useFlexGap>
        <TextField size="small" label="Date début" type="date" InputLabelProps={{ shrink: true }} value={filters.fromDate} onChange={(event) => setFilters((previous) => ({ ...previous, fromDate: event.target.value }))} fullWidth />
        <TextField size="small" label="Date fin" type="date" InputLabelProps={{ shrink: true }} value={filters.toDate} onChange={(event) => setFilters((previous) => ({ ...previous, toDate: event.target.value }))} fullWidth />
        <TextField size="small" label="Montant min" type="number" value={filters.minAmount} onChange={(event) => setFilters((previous) => ({ ...previous, minAmount: event.target.value }))} fullWidth />
        <TextField size="small" label="Montant max" type="number" value={filters.maxAmount} onChange={(event) => setFilters((previous) => ({ ...previous, maxAmount: event.target.value }))} fullWidth />
      </Stack>

      {timeline}

      <Box>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="subtitle2">Transactions utilisées</Typography>
          <Typography variant="body2" color="text.secondary">
            {totals.count} transaction(s) · Total {formatCurrency(totals.totalAmount)}
          </Typography>
        </Stack>

        {visibleRows.length === 0 ? (
          <Alert severity="info">{emptyMessage}</Alert>
        ) : (
          <Stack spacing={0.85}>
            {visibleRows.map((row) => (
              <Box key={row.id} sx={{ border: "1px solid rgba(20, 41, 43, 0.1)", borderRadius: 1.25, p: 1 }}>
                <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 800 }}>{row.description}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      {formatDate(row.date)} · {row.account}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      {row.category} · {row.thirdParty}
                    </Typography>
                    {row.statusLabel && (
                      <Typography variant="caption" color={row.statusTone === "warning" ? "warning.main" : row.statusTone === "success" ? "success.main" : "text.secondary"} sx={{ display: "block", fontWeight: 700 }}>
                        {row.statusLabel}
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 900, whiteSpace: "nowrap" }}>{formatCurrency(row.amount)}</Typography>
                </Stack>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75} sx={{ mt: 1 }} useFlexGap>
                  <Button size="small" variant="outlined" onClick={() => onOpenTransaction?.(row.transaction)}>
                    Ouvrir la transaction
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => onEditTransaction?.(row.transaction)}>
                    Modifier
                  </Button>
                  <Button size="small" variant="outlined" color="error" onClick={() => onDeleteTransaction?.(row.transaction)}>
                    Supprimer
                  </Button>
                  {onDetachTransaction && (
                    <Button size="small" variant="outlined" onClick={() => onDetachTransaction(row.transaction)}>
                      Détacher du frais fixe
                    </Button>
                  )}
                  {onRerunReconciliation && (
                    <Button size="small" variant="outlined" onClick={() => onRerunReconciliation(row.transaction)}>
                      Relancer la réconciliation
                    </Button>
                  )}
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Box>

      {proof}
    </Stack>
  );

  const footerActions = footer || (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} justifyContent="flex-end">
      <Button variant="outlined" onClick={onClose}>Fermer</Button>
    </Stack>
  );

  if (isMobile) {
    return (
      <BottomSheet open={open} title={title} onClose={onClose} footer={footerActions} className="transaction-usage-sheet">
        {shell}
      </BottomSheet>
    );
  }

  return (
    <Drawer open={open} title={title} onClose={onClose} footer={footerActions} side="right" className="transaction-usage-drawer">
      {shell}
    </Drawer>
  );
}
