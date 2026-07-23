import { useCallback, useRef, useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import SummaryCard from "./SummaryCard";
import TransactionList from "./TransactionList";
import CashBalanceAdjustmentDialog from "./CashBalanceAdjustmentDialog";
import { useObjectives } from "../hooks/useObjectives";
import ExpenseCategoryPieChart from "./charts/ExpenseCategoryPieChart";
import { CASH_ACCOUNT_NAME, CASH_ACCOUNT_TYPE, CASH_ADJUSTMENT_KINDS } from "../constants/cashBalanceConstants";
import { findFirstProjectedNegativeMonth } from "../services/annualTrajectoryService";
import AccountBalanceWallet from "@mui/icons-material/AccountBalanceWallet";
import CalendarMonth from "@mui/icons-material/CalendarMonth";
import Flag from "@mui/icons-material/Flag";
import InfoOutlined from "@mui/icons-material/InfoOutlined";
import Insights from "@mui/icons-material/Insights";
import Savings from "@mui/icons-material/Savings";
import ShowChart from "@mui/icons-material/ShowChart";
import TrendingDown from "@mui/icons-material/TrendingDown";
import TrendingFlat from "@mui/icons-material/TrendingFlat";
import TrendingUp from "@mui/icons-material/TrendingUp";
import WarningAmber from "@mui/icons-material/WarningAmber";

function formatCurrency(value) {
  const amount = Number(value);

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number.isFinite(amount) ? amount : 0);
}

const MONTH_LABELS = [
  "Janvier",
  "Fevrier",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Aout",
  "Septembre",
  "Octobre",
  "Novembre",
  "Decembre",
];

const STATUS_LABELS = {
  actual: "Realise",
  current: "En cours",
  forecast: "Prévision",
};

const HORIZON_COLORS = {
  green: "#147d64",
  blue: "#0f5f8f",
  orange: "#d97706",
  red: "#c24135",
  ink: "#172a2f",
  muted: "#61777b",
  light: "#f6f8f4",
  secondary: "#e6ece7",
  line: "rgba(23, 42, 47, 0.12)",
};

const CARD_SX = {
  border: "1px solid",
  borderColor: HORIZON_COLORS.line,
  borderRadius: 3,
  background: "rgba(255,255,255,0.94)",
  boxShadow: "0 12px 28px rgba(20, 41, 43, 0.08)",
  p: { xs: 1.75, sm: 2 },
  transition: "transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease",
  "&:hover": {
    transform: "translateY(-1px)",
    boxShadow: "0 16px 34px rgba(20, 41, 43, 0.11)",
    borderColor: "rgba(15, 95, 143, 0.24)",
  },
};

const CLICKABLE_SX = {
  cursor: "pointer",
  textAlign: "left",
  width: "100%",
  display: "block",
  "&:focus-visible": {
    outline: `3px solid ${HORIZON_COLORS.blue}`,
    outlineOffset: 3,
  },
};

function monthKeyToDate(monthKey) {
  const [year, month] = String(monthKey || "").split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return new Date(year, month - 1, 1);
}

function formatMonthYear(monthKey) {
  const [year, month] = String(monthKey || "").split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function getTrajectoryYear(trajectory = []) {
  const firstMonth = trajectory[0]?.month || "";
  const year = Number(firstMonth.slice(0, 4));
  return Number.isInteger(year) ? year : new Date().getFullYear();
}

function getRemainingStatus(remaining, totalRevenue) {
  const revenue = Number(totalRevenue);
  const amount = Number(remaining);
  const percent = revenue > 0 ? Math.max(0, Math.min(100, Math.round((amount / revenue) * 100))) : 0;
  if (percent >= 30) return { percent, label: "Confort", color: HORIZON_COLORS.green };
  if (percent >= 10) return { percent, label: "Vigilance", color: HORIZON_COLORS.orange };
  return { percent, label: "Tension", color: HORIZON_COLORS.red };
}

function getDecemberTrend(rows = []) {
  const november = rows[10];
  const december = rows[11];
  const delta = Number(december?.closingBalance) - Number(november?.closingBalance);
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) {
    return { icon: <TrendingFlat fontSize="small" />, label: "Stable", color: HORIZON_COLORS.muted, delta: 0 };
  }
  if (delta > 0) {
    return { icon: <TrendingUp fontSize="small" />, label: "Hausse", color: HORIZON_COLORS.green, delta };
  }
  return { icon: <TrendingDown fontSize="small" />, label: "Baisse", color: HORIZON_COLORS.red, delta };
}

function getExpectedOpportunitiesTotal(rows = []) {
  return rows.reduce((sum, row) => {
    const amount = Number(row?.expectedOpportunities);
    return Number.isFinite(amount) ? sum + amount : sum;
  }, 0);
}

function getExpectedOpportunitiesCount(rows = []) {
  return rows.reduce((sum, row) => {
    const count = Number(row?.expectedOpportunitiesCount);
    if (Number.isFinite(count)) return sum + count;

    const amount = Number(row?.expectedOpportunities);
    return Number.isFinite(amount) && amount > 0 ? sum + 1 : sum;
  }, 0);
}

function getFiniteAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function MonthAmountLine({ label, value, color = "text.secondary" }) {
  return (
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between" sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0 }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ color, fontWeight: 800, whiteSpace: "nowrap" }}>
        {formatCurrency(value)}
      </Typography>
    </Stack>
  );
}

function MetricCard({
  icon,
  title,
  value,
  subtitle,
  color = HORIZON_COLORS.blue,
  children,
  large = false,
  helpText = "",
  onClick = null,
  ariaLabel = "",
}) {
  const cardContent = (
    <>
      <Stack direction="row" spacing={1.25} alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
          <Box
            aria-hidden="true"
            sx={{
              width: 36,
              height: 36,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              color,
              bgcolor: `${color}14`,
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: 0, lineHeight: 1.2 }}>
            {title}
          </Typography>
        </Stack>
        {helpText && (
          <Tooltip title={helpText} enterTouchDelay={0} leaveTouchDelay={4000}>
            <IconButton
              size="small"
              aria-label={`${title} : ${helpText}`}
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              sx={{ color: HORIZON_COLORS.muted, flexShrink: 0 }}
            >
              <InfoOutlined fontSize="inherit" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
      <Typography
        sx={{
          color: HORIZON_COLORS.ink,
          fontWeight: 900,
          lineHeight: 1,
          fontSize: large ? { xs: "2.35rem", sm: "3rem", md: "3.35rem" } : { xs: "1.65rem", sm: "2rem" },
        }}
      >
        {value}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {subtitle}
        </Typography>
      )}
      {children}
    </>
  );

  const sx = { ...CARD_SX, minHeight: large ? { xs: 168, sm: 190 } : 144 };

  if (typeof onClick === "function") {
    return (
      <ButtonBase
        component="article"
        onClick={onClick}
        aria-label={ariaLabel || `Ouvrir ${title}`}
        sx={{ ...sx, ...CLICKABLE_SX }}
      >
        {cardContent}
      </ButtonBase>
    );
  }

  return (
    <Box sx={sx}>
      {cardContent}
    </Box>
  );
}

function AlertPanel({ error, firstNegativeMonth, firstNegativeMonthLabel, duplicateGroups, onNegativeMonthClick = null }) {
  const alerts = [];
  if (error) {
    alerts.push({ level: "error", label: "Erreur", detail: "Erreur de calcul de la trajectoire annuelle." });
  }
  if (firstNegativeMonth && firstNegativeMonthLabel) {
    alerts.push({
      level: "error",
      label: "Solde negatif",
      detail: `${firstNegativeMonthLabel} - ${formatCurrency(firstNegativeMonth.closingBalance)}`,
    });
  }
  if (duplicateGroups.length > 0) {
    alerts.push({
      level: "warning",
      label: "Doublons",
      detail: duplicateGroups.map((group) => `${group.name} (${group.count})`).join(", "),
    });
  }
  if (alerts.length === 0) {
    alerts.push({ level: "ok", label: "Prévisions", detail: "Aucune alerte critique détectée." });
  }

  return (
    <Box sx={CARD_SX} role="status" aria-label="Alertes du cockpit">
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.25 }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            color: alerts.some((alert) => alert.level === "error") ? HORIZON_COLORS.red : HORIZON_COLORS.orange,
            bgcolor: "rgba(217, 119, 6, 0.12)",
          }}
        >
          <WarningAmber />
        </Box>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: 0 }}>
          Alertes
        </Typography>
      </Stack>
      <Stack spacing={1}>
        {alerts.map((alert) => {
          const color = alert.level === "error" ? HORIZON_COLORS.red : alert.level === "warning" ? HORIZON_COLORS.orange : HORIZON_COLORS.green;
          const isNegativeBalanceAlert = alert.label === "Solde negatif" && typeof onNegativeMonthClick === "function";
          const alertSx = {
            border: "1px solid",
            borderColor: `${color}33`,
            borderRadius: 2,
            px: 1.25,
            py: 1,
            bgcolor: `${color}0f`,
            ...(isNegativeBalanceAlert ? CLICKABLE_SX : {}),
          };

          const content = (
            <>
              <Typography variant="body2" sx={{ fontWeight: 800, color }}>
                {alert.label}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {alert.detail}
              </Typography>
            </>
          );

          if (isNegativeBalanceAlert) {
            return (
              <ButtonBase
                key={`${alert.label}-${alert.detail}`}
                component="article"
                onClick={onNegativeMonthClick}
                aria-label={`Ouvrir le mois en alerte ${firstNegativeMonthLabel}`}
                sx={alertSx}
              >
                {content}
              </ButtonBase>
            );
          }

          return (
            <Box
              key={`${alert.label}-${alert.detail}`}
              sx={alertSx}
            >
              {content}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

function AnnualTrajectorySummary({
  trajectory = [],
  error = null,
  monthRefs = null,
  onMonthClick = null,
}) {
  const rows = Array.isArray(trajectory) ? trajectory : [];
  const year = getTrajectoryYear(rows);
  const december = rows[11] || null;

  if (error) {
    return (
      <Box sx={{ border: "1px solid", borderColor: "error.light", borderRadius: 3, p: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Trajectoire annuelle - {year}
        </Typography>
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          Erreur de calcul de la trajectoire annuelle.
        </Typography>
      </Box>
    );
  }

  if (rows.length === 0) {
    return (
      <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, p: 2.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Trajectoire annuelle - {year}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Aucune donnée disponible pour calculer la trajectoire annuelle.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={CARD_SX}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        sx={{ mb: 2 }}
      >
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <CalendarMonth fontSize="small" sx={{ color: HORIZON_COLORS.blue }} />
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Trajectoire - {year}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            Vue compacte des soldes de fin de mois
          </Typography>
        </Box>
        <Typography
          variant="h6"
          sx={{ fontWeight: 800, color: Number(december?.closingBalance) < 0 ? "error.main" : "text.primary" }}
          aria-label={Number(december?.closingBalance) < 0 ? "Solde prévu négatif au 31 décembre" : "Solde prévu au 31 décembre"}
        >
          {formatCurrency(december?.closingBalance)}
        </Typography>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(3, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))", lg: "repeat(6, minmax(0, 1fr))" },
          gap: 0.75,
        }}
      >
        {rows.map((row, index) => {
          const closingBalance = Number(row?.closingBalance);
          const monthlyIncome = getFiniteAmount(row?.monthlyIncome);
          const monthlyExpenses = getFiniteAmount(row?.monthlyExpenses);
          const monthlyNet = getFiniteAmount(row?.monthlyNet);
          const isNegative = Number.isFinite(closingBalance) && closingBalance < 0;
          const isCurrent = row.status === "current";
          const isDecember = index === 11;
          const borderColor = isNegative ? HORIZON_COLORS.red : isCurrent ? HORIZON_COLORS.blue : isDecember ? HORIZON_COLORS.green : HORIZON_COLORS.line;
          const monthLabel = MONTH_LABELS[index] || row.month;
          const isInteractive = typeof onMonthClick === "function" && row.month;
          const monthCardSx = {
            border: "1px solid",
            borderColor,
            borderRadius: 2,
            p: 1,
            minWidth: 0,
            bgcolor: isNegative ? "rgba(194, 65, 53, 0.06)" : isCurrent ? "rgba(15, 95, 143, 0.07)" : isDecember ? "rgba(20, 125, 100, 0.06)" : "rgba(255,255,255,0.7)",
            ...(isInteractive ? CLICKABLE_SX : {}),
          };

          const monthContent = (
            <>
              <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="space-between">
                <Typography variant="caption" sx={{ fontWeight: 800, minWidth: 0 }}>
                  {monthLabel}
                </Typography>
                <Chip label={STATUS_LABELS[row.status] || "Prévision"} size="small" sx={{ height: 20, fontSize: "0.65rem" }} />
              </Stack>
              <Typography sx={{ fontWeight: 900, mt: 0.5, lineHeight: 1.1, fontSize: { xs: "0.98rem", sm: "1rem" } }}>
                {formatCurrency(closingBalance)}
              </Typography>
              <Stack spacing={0.15} sx={{ mt: 0.75 }}>
                <MonthAmountLine label="Rev." value={monthlyIncome} color={HORIZON_COLORS.green} />
                <MonthAmountLine label="Dep." value={monthlyExpenses} color={HORIZON_COLORS.red} />
                <MonthAmountLine label="Variation" value={monthlyNet} color={monthlyNet >= 0 ? HORIZON_COLORS.green : HORIZON_COLORS.red} />
              </Stack>
              {isNegative && (
                <Typography variant="caption" color="error">
                  Solde negatif
                </Typography>
              )}
            </>
          );

          const ref = (node) => {
            if (monthRefs?.current && row.month) {
              monthRefs.current[row.month] = node;
            }
          };

          if (isInteractive) {
            return (
              <ButtonBase
                key={row.month || index}
                component="article"
                ref={ref}
                onClick={() => onMonthClick(row.month)}
                aria-label={`Ouvrir l'analyse du mois de ${monthLabel}`}
                sx={monthCardSx}
              >
                {monthContent}
              </ButtonBase>
            );
          }

          return (
            <Box
              key={row.month || index}
              ref={ref}
              sx={monthCardSx}
            >
              {monthContent}
            </Box>
          );
        })}
      </Box>

      <Divider sx={{ my: 2 }} />
      <Typography variant="body2" sx={{ fontWeight: 700 }}>
        Solde prévu au 31 décembre : {formatCurrency(december?.closingBalance)}
      </Typography>
    </Box>
  );
}

function LegacyHorizonCockpit({ metrics = {} }) {
  const {
    balance = 0,
    remaining = 0,
    totalRevenue = 0,
    totalExpense = 0,
    monthlySavings = 0,
    recentTransactions = [],
    yearTrend = [],
    transactionCount = 0,
    accountBalances = [],
    monthlyIncomeCategoryData = { catégories: [], total: 0 },
    annualTrajectory = [],
    annualTrajectoryError = null,
    cashBalance = {},
  } = metrics;
  const [cashDialogMode, setCashDialogMode] = useState(null);

  const { objectives = [], loading: objectivesLoading } = useObjectives();
  const objectivesList = Array.isArray(objectives) ? objectives : [];
  const trendData = Array.isArray(yearTrend) ? yearTrend : [];
  const transactionsToShow = Array.isArray(recentTransactions) ? recentTransactions : [];
  const cashAccount = accountBalances.find((account) => (
    account?.type === CASH_ACCOUNT_TYPE || account?.name === CASH_ACCOUNT_NAME
  ));

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
          p: { xs: 3, md: 4 },
          background: "linear-gradient(135deg, rgba(25,118,210,0.06), rgba(25,118,210,0.02))",
        }}
      >
        <Typography variant="overline" color="text.secondary">
          Aujourd’hui
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
          {formatCurrency(balance)}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Trésorerie actuelle
        </Typography>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 2 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Argent disponible
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {formatCurrency(balance)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Solde prévu fin de mois
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {formatCurrency(remaining)}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <AnnualTrajectorySummary
        trajectory={annualTrajectory}
        error={annualTrajectoryError}
      />

      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
          p: 2.5,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Soldes par compte
        </Typography>
        <Grid container spacing={1.5}>
          {accountBalances.map((account) => (
            <Grid item xs={12} sm={6} key={account.id}>
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1.5 }}>
                <Typography variant="body2" color="text.secondary">
                  {account.icon || "💳"} {account.name}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {formatCurrency(account.balance)}
                </Typography>
                {(account?.type === CASH_ACCOUNT_TYPE || account?.name === CASH_ACCOUNT_NAME) && (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setCashDialogMode(CASH_ADJUSTMENT_KINDS.opening)}
                    >
                      Initialiser le solde
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      onClick={() => setCashDialogMode(CASH_ADJUSTMENT_KINDS.balance)}
                    >
                      Ajuster le solde
                    </Button>
                  </Stack>
                )}
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              p: 2.5,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Ce mois
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <SummaryCard title="Revenus" value={formatCurrency(totalRevenue)} color="success.main" />
              </Grid>
              <Grid item xs={12} sm={4}>
                <SummaryCard title="Dépenses" value={formatCurrency(totalExpense)} color="error.main" />
              </Grid>
              <Grid item xs={12} sm={4}>
                <SummaryCard title="Variation du mois" value={formatCurrency(monthlySavings)} color="primary.main" />
              </Grid>
            </Grid>

            <Box sx={{ mt: 2 }}>
              {monthlyIncomeCategoryData?.catégories?.length > 0 ? (
                <ExpenseCategoryPieChart
                  data={monthlyIncomeCategoryData.catégories}
                  total={monthlyIncomeCategoryData.total}
                  title="Revenus du mois par catégorie"
                  subtitle="Revenus du mois par catégorie"
                  totalLabel="Total des revenus"
                  emptyMessage="Aucun revenu sur cette période"
                  valueLabel="Revenus"
                  entityLabelSingular="revenu"
                  entityLabelPlural="revenus"
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Aucun revenu sur cette période
                </Typography>
              )}
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} md={5}>
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              p: 2.5,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Cette année
            </Typography>
            <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ height: 130 }}>
              {trendData.map((month) => {
                const height = Math.max(18, Math.min(110, 30 + Math.abs(month.net) / 12));
                const color = month.net >= 0 ? "success.main" : "error.main";

                return (
                  <Box key={month.label} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <Box
                      sx={{
                        width: "100%",
                        height: `${height}px`,
                        borderRadius: "999px 999px 0 0",
                        bgcolor: color,
                        opacity: month.net === 0 ? 0.35 : 0.9,
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      {month.label}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
            <Chip label={`${transactionCount} transactions ce mois`} size="small" sx={{ mt: 1.5 }} />
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              p: 2.5,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Objectifs
            </Typography>
            {objectivesLoading ? (
              <Typography variant="body2" color="text.secondary">
                Chargement des objectifs...
              </Typography>
            ) : objectivesList.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Aucun objectif actif pour le moment.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {objectivesList.map((goal) => {
                  const current = Number(goal.currentAmount) || 0;
                  const target = Number(goal.targetAmount) || 0;
                  const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
                  const title = goal.name || goal.label || "Objectif";

                  return (
                    <Box key={goal.id || title}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {progress}%
                        </Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 999 }} />
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Grid>

        <Grid item xs={12} md={5}>
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
              p: 2.5,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              Dernières transactions
            </Typography>
            <TransactionList transactions={transactionsToShow} />
          </Box>
        </Grid>
      </Grid>

      <CashBalanceAdjustmentDialog
        open={Boolean(cashDialogMode)}
        mode={cashDialogMode || CASH_ADJUSTMENT_KINDS.balance}
        account={cashAccount}
        currentBalance={cashAccount?.balance || 0}
        hasHistory={cashBalance.hasHistory === true}
        onClose={() => setCashDialogMode(null)}
        onSubmit={cashBalance.onSubmit}
      />
    </Box>
  );
}

export default function HorizonCockpit({
  metrics = {},
  onOpenTransactions = null,
  onOpenAnalysisMonth = null,
  onOpenOpportunities = null,
}) {
  const {
    balance = 0,
    remaining = 0,
    totalRevenue = 0,
    totalExpense = 0,
    monthlySavings = 0,
    recentTransactions = [],
    yearTrend = [],
    transactionCount = 0,
    accountBalances = [],
    monthlyIncomeCategoryData = { catégories: [], total: 0 },
    annualTrajectory = [],
    annualTrajectoryError = null,
    cashBalance = {},
  } = metrics;
  const [cashDialogMode, setCashDialogMode] = useState(null);
  const trajectoryMonthRefs = useRef({});

  const { objectives = [], loading: objectivesLoading } = useObjectives();
  const objectivesList = Array.isArray(objectives) ? objectives : [];
  const trendData = Array.isArray(yearTrend) ? yearTrend : [];
  const transactionsToShow = Array.isArray(recentTransactions) ? recentTransactions : [];
  const trajectoryRows = Array.isArray(annualTrajectory) ? annualTrajectory : [];
  const trajectoryYear = getTrajectoryYear(trajectoryRows);
  const december = trajectoryRows[11] || null;
  const decemberTrend = getDecemberTrend(trajectoryRows);
  const remainingStatus = getRemainingStatus(remaining, totalRevenue);
  const duplicateGroups = trajectoryRows[0]?.duplicateFixedExpenseGroups || [];
  const firstNegativeMonth = findFirstProjectedNegativeMonth(trajectoryRows);
  const firstNegativeMonthLabel = formatMonthYear(firstNegativeMonth?.month);
  const expectedOpportunitiesTotal = getExpectedOpportunitiesTotal(trajectoryRows);
  const expectedOpportunitiesCount = getExpectedOpportunitiesCount(trajectoryRows);
  const cashAccount = accountBalances.find((account) => (
    account?.type === CASH_ACCOUNT_TYPE || account?.name === CASH_ACCOUNT_NAME
  ));
  const currentTrajectoryMonth = trajectoryRows.find((row) => row.status === "current")?.month || trajectoryRows[new Date().getMonth()]?.month || null;
  const decemberMonth = trajectoryRows[11]?.month || null;

  const scrollToTrajectoryMonth = useCallback((monthKey) => {
    const node = trajectoryMonthRefs.current?.[monthKey];
    if (!node) {
      return;
    }

    node.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    window.setTimeout(() => {
      node.focus?.({ preventScroll: true });
    }, 180);
  }, []);

  const openAnalysisMonth = useCallback((monthKey) => {
    const monthDate = monthKeyToDate(monthKey);
    if (typeof onOpenAnalysisMonth === "function" && monthDate) {
      onOpenAnalysisMonth(monthKey, monthDate);
    }
  }, [onOpenAnalysisMonth]);

  return (
    <Box sx={{ display: "grid", gap: { xs: 2, sm: 2.5 }, color: HORIZON_COLORS.ink }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
          gap: { xs: 1.5, sm: 2 },
          alignItems: "stretch",
        }}
      >
        <MetricCard
          icon={<AccountBalanceWallet />}
          title="Solde actuel"
          value={formatCurrency(balance)}
          subtitle="Total actuel de tous les comptes actifs."
          color={HORIZON_COLORS.blue}
          large
          helpText="Total actuel de tous les comptes actifs."
          onClick={onOpenTransactions}
          ariaLabel="Ouvrir les transactions depuis le solde actuel"
        >
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 2 }}>
            <Chip
              label={`${transactionCount} transactions ce mois`}
              size="small"
              sx={{ width: "fit-content", color: HORIZON_COLORS.muted, fontWeight: 700 }}
            />
          </Stack>
        </MetricCard>

        <MetricCard
          icon={monthlySavings > 0 ? <TrendingUp /> : monthlySavings < 0 ? <TrendingDown /> : <TrendingFlat />}
          title="Variation du mois"
          value={formatCurrency(monthlySavings)}
          subtitle={`${formatCurrency(totalRevenue)} de revenus - ${formatCurrency(totalExpense)} de depenses.`}
          color={monthlySavings >= 0 ? HORIZON_COLORS.green : HORIZON_COLORS.red}
          large
          helpText="Revenus moins dépenses du mois."
          onClick={() => openAnalysisMonth(currentTrajectoryMonth)}
          ariaLabel="Ouvrir l'analyse du mois courant"
        >
          <Chip
            icon={monthlySavings > 0 ? <TrendingUp /> : monthlySavings < 0 ? <TrendingDown /> : <TrendingFlat />}
            label={monthlySavings > 0 ? "Mois positif" : monthlySavings < 0 ? "Mois sous tension" : "Mois stable"}
            size="small"
            sx={{ mt: 2, width: "fit-content", color: monthlySavings >= 0 ? HORIZON_COLORS.green : HORIZON_COLORS.red, fontWeight: 800 }}
          />
        </MetricCard>

        <MetricCard
          icon={<Savings />}
          title="Solde prévu fin de mois"
          value={formatCurrency(remaining)}
          subtitle={`${remainingStatus.percent}% des revenus du mois - ${remainingStatus.label}`}
          color={remainingStatus.color}
          large
          helpText="Estimation du solde à la fin du mois selon les prévisions actuelles."
          onClick={() => scrollToTrajectoryMonth(currentTrajectoryMonth)}
          ariaLabel="Faire défiler la trajectoire jusqu'au mois courant"
        >
          <Box
            role="meter"
            aria-label="Jauge du solde prévu fin de mois"
            aria-valuenow={remainingStatus.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            sx={{
              mt: 2,
              height: 12,
              borderRadius: 999,
              bgcolor: HORIZON_COLORS.secondary,
              overflow: "hidden",
            }}
          >
            <Box
              sx={{
                width: `${remainingStatus.percent}%`,
                minWidth: remainingStatus.percent > 0 ? 8 : 0,
                height: "100%",
                borderRadius: 999,
                bgcolor: remainingStatus.color,
                transition: "width 240ms ease",
              }}
            />
          </Box>
        </MetricCard>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" },
          gap: { xs: 1.5, sm: 2 },
        }}
      >
        <MetricCard
          icon={<Flag />}
          title="Solde prévu au 31 décembre"
          value={formatCurrency(december?.closingBalance)}
          subtitle={`Prévision au 31 decembre ${trajectoryYear}`}
          color={Number(december?.closingBalance) < 0 ? HORIZON_COLORS.red : HORIZON_COLORS.green}
          helpText="Projection du solde au dernier jour de l'année."
          onClick={() => scrollToTrajectoryMonth(decemberMonth)}
          ariaLabel="Faire défiler la trajectoire jusqu'à décembre"
        >
          <Chip
            icon={decemberTrend.icon}
            label={`${decemberTrend.label} vs novembre (${formatCurrency(decemberTrend.delta)})`}
            size="small"
            sx={{ mt: 1.5, width: "fit-content", color: decemberTrend.color, fontWeight: 800 }}
          />
        </MetricCard>

        <MetricCard
          icon={<Insights />}
          title="Opportunités prévues"
          value={formatCurrency(expectedOpportunitiesTotal)}
          subtitle={`${expectedOpportunitiesCount} opportunités incluses dans la trajectoire`}
          color={HORIZON_COLORS.orange}
          onClick={onOpenOpportunities}
          ariaLabel="Ouvrir les opportunités"
        />

        <AlertPanel
          error={annualTrajectoryError}
          firstNegativeMonth={firstNegativeMonth}
          firstNegativeMonthLabel={firstNegativeMonthLabel}
          duplicateGroups={duplicateGroups}
          onNegativeMonthClick={firstNegativeMonth?.month ? () => scrollToTrajectoryMonth(firstNegativeMonth.month) : null}
        />
      </Box>

      <AnnualTrajectorySummary
        trajectory={annualTrajectory}
        error={annualTrajectoryError}
        monthRefs={trajectoryMonthRefs}
        onMonthClick={openAnalysisMonth}
      />

      <Box sx={CARD_SX}>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
          Soldes par compte
        </Typography>
        <Grid container spacing={1.25}>
          {accountBalances.map((account) => (
            <Grid item xs={12} sm={6} md={4} key={account.id}>
              <Box sx={{ border: "1px solid", borderColor: HORIZON_COLORS.line, borderRadius: 2, p: 1.25, bgcolor: HORIZON_COLORS.light }}>
                <Typography variant="body2" color="text.secondary">
                  {account.icon || ""} {account.name}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mt: 0.5 }}>
                  {formatCurrency(account.balance)}
                </Typography>
                {(account?.type === CASH_ACCOUNT_TYPE || account?.name === CASH_ACCOUNT_NAME) && (
                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
                    <Button size="small" variant="outlined" onClick={() => setCashDialogMode(CASH_ADJUSTMENT_KINDS.opening)}>
                      Initialiser le solde
                    </Button>
                    <Button size="small" variant="contained" onClick={() => setCashDialogMode(CASH_ADJUSTMENT_KINDS.balance)}>
                      Ajuster le solde
                    </Button>
                  </Stack>
                )}
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Box sx={CARD_SX}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
              Ce mois
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
              {[
                { label: "Revenus", value: totalRevenue, color: HORIZON_COLORS.green },
                { label: "Dépenses", value: totalExpense, color: HORIZON_COLORS.red },
                { label: "Variation du mois", value: monthlySavings, color: monthlySavings >= 0 ? HORIZON_COLORS.green : HORIZON_COLORS.red },
              ].map((item) => (
                <Box key={item.label} sx={{ border: "1px solid", borderColor: HORIZON_COLORS.line, borderRadius: 2, p: 1.25, bgcolor: HORIZON_COLORS.light }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                    {item.label}
                  </Typography>
                  <Typography sx={{ fontWeight: 900, color: item.color, fontSize: "1.15rem" }}>
                    {formatCurrency(item.value)}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box sx={{ mt: 2 }}>
              {monthlyIncomeCategoryData?.catégories?.length > 0 ? (
                <ExpenseCategoryPieChart
                  data={monthlyIncomeCategoryData.catégories}
                  total={monthlyIncomeCategoryData.total}
                  title="Revenus du mois par catégorie"
                  subtitle="Revenus du mois par catégorie"
                  totalLabel="Total des revenus"
                  emptyMessage="Aucun revenu sur cette période"
                  valueLabel="Revenus"
                  entityLabelSingular="revenu"
                  entityLabelPlural="revenus"
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Aucun revenu sur cette période
                </Typography>
              )}
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12} md={5}>
          <Box sx={CARD_SX}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
              <ShowChart fontSize="small" sx={{ color: HORIZON_COLORS.blue }} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Tendance realisee
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ height: 130 }}>
              {trendData.map((month) => {
                const height = Math.max(18, Math.min(110, 30 + Math.abs(month.net) / 12));
                return (
                  <Box key={month.label} sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <Box
                      sx={{
                        width: "100%",
                        height: `${height}px`,
                        borderRadius: "999px 999px 0 0",
                        bgcolor: month.net >= 0 ? HORIZON_COLORS.green : HORIZON_COLORS.red,
                        opacity: month.net === 0 ? 0.35 : 0.9,
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                      {month.label}
                    </Typography>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Box sx={CARD_SX}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
              Objectifs
            </Typography>
            {objectivesLoading ? (
              <Typography variant="body2" color="text.secondary">
                Chargement des objectifs...
              </Typography>
            ) : objectivesList.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Aucun objectif actif pour le moment.
              </Typography>
            ) : (
              <Stack spacing={2}>
                {objectivesList.map((goal) => {
                  const current = Number(goal.currentAmount) || 0;
                  const target = Number(goal.targetAmount) || 0;
                  const progress = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
                  const title = goal.name || goal.label || "Objectif";

                  return (
                    <Box key={goal.id || title}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {progress}%
                        </Typography>
                      </Box>
                      <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 999 }} />
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Grid>

        <Grid item xs={12} md={5}>
          <Box sx={CARD_SX}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 2 }}>
              Dernieres transactions
            </Typography>
            <TransactionList transactions={transactionsToShow} />
          </Box>
        </Grid>
      </Grid>

      <CashBalanceAdjustmentDialog
        open={Boolean(cashDialogMode)}
        mode={cashDialogMode || CASH_ADJUSTMENT_KINDS.balance}
        account={cashAccount}
        currentBalance={cashAccount?.balance || 0}
        hasHistory={cashBalance.hasHistory === true}
        onClose={() => setCashDialogMode(null)}
        onSubmit={cashBalance.onSubmit}
      />
    </Box>
  );
}
