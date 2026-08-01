import { useEffect, useMemo, useState } from "react";
import {
	Alert,
	Box,
	Button,
	Chip,
	LinearProgress,
	MenuItem,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import AccountBalanceWallet from "@mui/icons-material/AccountBalanceWallet";
import PieChart from "@mui/icons-material/PieChart";
import Savings from "@mui/icons-material/Savings";
import TrendingDown from "@mui/icons-material/TrendingDown";
import TrendingUp from "@mui/icons-material/TrendingUp";
import WarningAmber from "@mui/icons-material/WarningAmber";
import { useTransactionsContext } from "../context/TransactionsContext";
import { useFixedExpenses } from "../hooks/useFixedExpenses";
import { useRecurringIncome } from "../hooks/useRecurringIncome";
import { useAccounts } from "../hooks/useAccounts";
import { useCategories } from "../hooks/useCategories";
import { useSubcategories } from "../hooks/useSubcategories";
import ExpenseCategoryPieChart from "../components/charts/ExpenseCategoryPieChart";
import IncomeExpenseTrendChart from "../components/charts/IncomeExpenseTrendChart";
import {
	buildAnalysisSnapshot,
	getPeriodRange,
	getPreviousPeriodRange,
} from "../utils/analysisDataUtils";
import { getAnalysisPieChartCopy } from "../utils/analysisChartConfig";
import { getAnalysisTrendChartCopy } from "../utils/analysisTrendChartConfig";
import {
	buildTransactionsNavigationFilters,
	getDetailActionLabel,
	getDetailCountLabel,
} from "../utils/analysisInteractionUtils";
import { getSafeCategoryLabel, isTechnicalCategoryDisplayValue } from "../utils/displayTextUtils";

function formatCurrency(value) {
	return new Intl.NumberFormat("fr-FR", {
		style: "currency",
		currency: "EUR",
	}).format(Number(value || 0));
}

function formatPercent(value) {
	if (value === null || value === undefined) {
		return "N/A";
	}

	const normalized = Number(value);
	if (!Number.isFinite(normalized)) {
		return "N/A";
	}

	return `${normalized >= 0 ? "+" : ""}${normalized.toFixed(1)}%`;
}

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
	background: "rgba(255,255,255,0.96)",
	boxShadow: "0 12px 28px rgba(20, 41, 43, 0.08)",
	p: { xs: 1.5, sm: 2 },
};

function getVariationTone(variation, positiveColor = HORIZON_COLORS.green, negativeColor = HORIZON_COLORS.red) {
	if (variation === null || variation === undefined || !Number.isFinite(Number(variation)) || Number(variation) === 0) {
		return HORIZON_COLORS.muted;
	}

	return Number(variation) > 0 ? positiveColor : negativeColor;
}

function getVariationText(variation) {
	if (variation === null || variation === undefined) {
		return "Nouvelle reference";
	}

	return `${formatPercent(variation)} vs période précédente`;
}

function parseNavigationReferenceDate(value) {
	const date = value instanceof Date ? value : new Date(value);
	return date && !Number.isNaN(date.getTime()) ? date : null;
}

function SectionShell({ title, subtitle, children, action }) {
	return (
		<Box component="section" sx={{ mb: 2 }}>
			<Stack
				direction={{ xs: "column", sm: "row" }}
				spacing={1}
				justifyContent="space-between"
				alignItems={{ xs: "flex-start", sm: "flex-end" }}
				sx={{ mb: 1 }}
			>
				<Box>
					<Typography variant="h6" sx={{ fontWeight: 900, color: HORIZON_COLORS.ink }}>
						{title}
					</Typography>
					{subtitle && (
						<Typography variant="body2" color="text.secondary">
							{subtitle}
						</Typography>
					)}
				</Box>
				{action}
			</Stack>
			{children}
		</Box>
	);
}

function SummaryMetricCard({ title, total, share, variation, tone = HORIZON_COLORS.blue, icon }) {
	const iconBackground = String(tone || "").startsWith("#") ? `${tone}14` : "action.hover";
	const variationTone = getVariationTone(variation, tone, HORIZON_COLORS.red);
	const variationBackground = String(variationTone || "").startsWith("#") ? `${variationTone}14` : "action.hover";

	return (
		<Box sx={{ ...CARD_SX, minHeight: 150 }}>
			<Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
				<Box
					aria-hidden="true"
					sx={{
						width: 34,
						height: 34,
						borderRadius: 2,
						display: "grid",
						placeItems: "center",
						color: tone,
						bgcolor: iconBackground,
					}}
				>
					{icon}
				</Box>
				<Typography variant="overline" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: 0 }}>
					{title}
				</Typography>
			</Stack>
			<Typography sx={{ fontWeight: 950, color: HORIZON_COLORS.ink, lineHeight: 1, fontSize: { xs: "1.75rem", sm: "2rem" } }}>
				{formatCurrency(total)}
			</Typography>
			<Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 1 }}>
				<Chip size="small" label={`Part ${Number(share || 0).toFixed(1)}%`} sx={{ bgcolor: HORIZON_COLORS.light }} />
				<Chip
					size="small"
					label={getVariationText(variation)}
					sx={{
						color: variationTone,
						bgcolor: variationBackground,
						fontWeight: 800,
					}}
				/>
			</Stack>
		</Box>
	);
}

function MonthlySummary({ expenses, revenues, balance, savingsRate, rangeLabel }) {
	const balanceColor = balance >= 0 ? HORIZON_COLORS.green : HORIZON_COLORS.red;

	return (
		<Box
			component="section"
			aria-label="Synthese mensuelle"
			sx={{
				border: "1px solid",
				borderColor: HORIZON_COLORS.line,
				borderRadius: 3,
				background: `linear-gradient(135deg, ${HORIZON_COLORS.light}, #ffffff)`,
				p: { xs: 1.75, sm: 2.25 },
				mb: 2,
			}}
		>
			<Stack direction={{ xs: "column", md: "row" }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }}>
				<Box>
					<Typography variant="overline" sx={{ color: HORIZON_COLORS.muted, fontWeight: 900, letterSpacing: 0 }}>
						Synthèse {rangeLabel}
					</Typography>
					<Typography sx={{ color: balanceColor, fontWeight: 950, lineHeight: 1, fontSize: { xs: "2.25rem", sm: "3rem" } }}>
						{formatCurrency(balance)}
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
						Solde analytique après revenus, dépenses fixes et dépenses variables.
					</Typography>
				</Box>

				<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1, minWidth: { md: 470 } }}>
					<Box sx={{ borderLeft: { xs: 0, sm: "3px solid" }, borderColor: HORIZON_COLORS.red, pl: { sm: 1.25 } }}>
						<Typography variant="caption" color="text.secondary">Dépenses</Typography>
						<Typography sx={{ fontWeight: 900, color: HORIZON_COLORS.red }}>{formatCurrency(expenses)}</Typography>
					</Box>
					<Box sx={{ borderLeft: { xs: 0, sm: "3px solid" }, borderColor: HORIZON_COLORS.green, pl: { sm: 1.25 } }}>
						<Typography variant="caption" color="text.secondary">Revenus</Typography>
						<Typography sx={{ fontWeight: 900, color: HORIZON_COLORS.green }}>{formatCurrency(revenues)}</Typography>
					</Box>
					<Box sx={{ borderLeft: { xs: 0, sm: "3px solid" }, borderColor: HORIZON_COLORS.blue, pl: { sm: 1.25 } }}>
						<Typography variant="caption" color="text.secondary">Épargne</Typography>
						<Typography sx={{ fontWeight: 900, color: HORIZON_COLORS.blue }}>{Number(savingsRate || 0).toFixed(1)}%</Typography>
					</Box>
				</Box>
			</Stack>
		</Box>
	);
}

function RankingCards({ title, subtitle, items = [], total = 0, emptyMessage, tone = HORIZON_COLORS.blue, onSelect, selectedCategory }) {
	return (
		<Box sx={CARD_SX}>
			<Typography variant="subtitle1" sx={{ fontWeight: 900, color: HORIZON_COLORS.ink }}>
				{title}
			</Typography>
			<Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
				{subtitle}
			</Typography>

			{items.length === 0 || Number(total) <= 0 ? (
				<Typography variant="body2" color="text.secondary">{emptyMessage}</Typography>
			) : (
				<Stack spacing={1}>
					{items.slice(0, 5).map((item) => {
						const label = getSafeCategoryLabel(item.categoryName || item.name);
						const percent = Number(item.percentage ?? item.percent ?? 0);
						const isSelected = selectedCategory === label;

						return (
							<Box
								key={`${title}-${label}`}
								component="button"
								type="button"
								onClick={() => onSelect?.(item)}
								sx={{
									border: "1px solid",
									borderColor: isSelected ? tone : HORIZON_COLORS.line,
									borderRadius: 2,
									bgcolor: isSelected ? `${tone}10` : "background.paper",
									p: 1,
									textAlign: "left",
									cursor: onSelect ? "pointer" : "default",
									width: "100%",
									"&:focus-visible": { outline: `3px solid ${tone}40`, outlineOffset: 2 },
								}}
								aria-label={`${label}, ${formatCurrency(item.amount)}, ${percent.toFixed(1)} pour cent`}
							>
								<Stack direction="row" spacing={1} justifyContent="space-between" alignItems="baseline">
									<Typography variant="body2" sx={{ fontWeight: 850, color: HORIZON_COLORS.ink, minWidth: 0 }} noWrap>
										{label}
									</Typography>
									<Typography variant="body2" sx={{ fontWeight: 900, color: tone }}>
										{formatCurrency(item.amount)}
									</Typography>
								</Stack>
								<Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
									<LinearProgress
										variant="determinate"
										value={Math.max(0, Math.min(100, percent))}
										aria-label={`Part de ${label}`}
										sx={{
											flex: 1,
											height: 8,
											borderRadius: 999,
											bgcolor: HORIZON_COLORS.secondary,
											"& .MuiLinearProgress-bar": { bgcolor: tone, borderRadius: 999 },
										}}
									/>
									<Typography variant="caption" color="text.secondary" sx={{ minWidth: 46, textAlign: "right" }}>
										{percent.toFixed(1)}%
									</Typography>
								</Stack>
							</Box>
						);
					})}
				</Stack>
			)}
		</Box>
	);
}

function AttentionPanel({ items = [] }) {
	if (items.length === 0) {
		return null;
	}

	return (
		<Stack spacing={1} sx={{ mb: 2 }} role="status" aria-label="Points d'attention analyse">
			{items.map((item) => (
				<Alert
					key={item.label}
					severity={item.severity}
					icon={item.icon}
					sx={{
						border: "1px solid",
						borderColor: item.color,
						bgcolor: `${item.color}10`,
						color: HORIZON_COLORS.ink,
						"& .MuiAlert-icon": { color: item.color },
					}}
				>
					<Typography variant="body2" sx={{ fontWeight: 850 }}>{item.label}</Typography>
					<Typography variant="caption" color="text.secondary">{item.description}</Typography>
				</Alert>
			))}
		</Stack>
	);
}

function FilterPanel({
	period,
	accountId,
	categoryFilter,
	accounts = [],
	categoryFilterOptions = [],
	range,
	onPeriodChange,
	onAccountChange,
	onCategoryChange,
}) {
	const selectedAccountName = accountId === "all"
		? "Tous les comptes"
		: accounts.find((account) => account.id === accountId)?.name || "Compte filtre";
	const selectedCategoryName = categoryFilter === "all" ? "Toutes les catégories" : categoryFilter;

	return (
		<Box
			component="section"
			aria-label="Filtres d'analyse"
			sx={{
				...CARD_SX,
				mb: 2,
				p: { xs: 1.25, sm: 1.5 },
			}}
		>
			<Stack spacing={1.25}>
				<Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" aria-label="Filtres actifs">
					<Chip size="small" color="primary" variant="outlined" label={range.label} />
					<Chip size="small" label={selectedAccountName} sx={{ bgcolor: HORIZON_COLORS.light, fontWeight: 700 }} />
					<Chip size="small" label={selectedCategoryName} sx={{ bgcolor: HORIZON_COLORS.light, fontWeight: 700 }} />
				</Stack>

				<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
					<TextField
						label="Période"
						size="small"
						select
						value={period}
						onChange={(event) => onPeriodChange(event.target.value)}
						fullWidth
					>
						<MenuItem value="currentMonth">Mois courant</MenuItem>
						<MenuItem value="previousMonth">Mois précédent</MenuItem>
						<MenuItem value="last3Months">3 derniers mois</MenuItem>
						<MenuItem value="currentYear">Année en cours</MenuItem>
					</TextField>

					<TextField
						label="Compte"
						size="small"
						select
						value={accountId}
						onChange={(event) => onAccountChange(event.target.value)}
						fullWidth
					>
						<MenuItem value="all">Tous les comptes</MenuItem>
						{accounts.map((account) => (
							<MenuItem key={account.id} value={account.id}>
								{account.name}
							</MenuItem>
						))}
					</TextField>

					<TextField
						label="Catégorie"
						size="small"
						select
						value={categoryFilter}
						onChange={(event) => onCategoryChange(event.target.value)}
						fullWidth
					>
						<MenuItem value="all">Toutes les catégories</MenuItem>
						{categoryFilterOptions.map((name) => (
							<MenuItem key={name} value={name}>{name}</MenuItem>
						))}
					</TextField>
				</Box>
			</Stack>
		</Box>
	);
}

function SectionHeader({ title, subtitle }) {
	return (
		<Box sx={{ mb: 1 }}>
			<Typography variant="h6" sx={{ fontWeight: 700 }}>
				{title}
			</Typography>
			{subtitle && (
				<Typography variant="caption" color="text.secondary">
					{subtitle}
				</Typography>
			)}
		</Box>
	);
}

function AnalysisSegmentDetail({
	segment,
	sectionType,
	onClose,
	onViewTransactions,
	canViewTransactions,
}) {
	if (!segment) {
		return null;
	}

	return (
		<Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 1, mt: 1 }}>
			<Typography variant="body2" sx={{ fontWeight: 700 }}>
				{getSafeCategoryLabel(segment.categoryName)}
			</Typography>
			<Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
				{formatCurrency(segment.amount)}
			</Typography>
			<Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
				{Number(segment.percentage || 0).toFixed(1)}%
			</Typography>
			<Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
				{getDetailCountLabel(sectionType, segment)}
			</Typography>

			{Array.isArray(segment.sourceNames) && segment.sourceNames.length > 0 && !canViewTransactions && (
				<Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
					Postes: {segment.sourceNames.map((name) => getSafeCategoryLabel(name)).slice(0, 3).join(", ")}
				</Typography>
			)}

			<Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
				{canViewTransactions && (
					<Button size="small" variant="outlined" onClick={onViewTransactions}>
						{getDetailActionLabel(sectionType)}
					</Button>
				)}
				<Button size="small" onClick={onClose}>
					Fermer
				</Button>
			</Stack>
		</Box>
	);
}

function DetailOverviewCard({ title, total, countLabel, variation, tone, segment, sectionType, onViewTransactions, onClose }) {
	const selected = Boolean(segment);

	return (
		<Box sx={{ ...CARD_SX, minHeight: 176 }}>
			<Stack direction="row" spacing={1} justifyContent="space-between" alignItems="flex-start">
				<Box sx={{ minWidth: 0 }}>
					<Typography variant="overline" color="text.secondary" sx={{ fontWeight: 900, letterSpacing: 0 }}>
						{title}
					</Typography>
					<Typography sx={{ color: tone, fontWeight: 950, lineHeight: 1.05, fontSize: { xs: "1.45rem", sm: "1.7rem" } }}>
						{formatCurrency(total)}
					</Typography>
				</Box>
				<Chip
					size="small"
					label={formatPercent(variation)}
					sx={{ color: getVariationTone(variation), bgcolor: HORIZON_COLORS.light, fontWeight: 800 }}
				/>
			</Stack>
			<Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
				{countLabel}
			</Typography>
			{selected ? (
				<AnalysisSegmentDetail
					segment={segment}
					sectionType={sectionType}
					onViewTransactions={onViewTransactions}
					onClose={onClose}
					canViewTransactions={Boolean(segment?.transactionIds?.length)}
				/>
			) : (
				<Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.25 }}>
					Sélectionne une carte ou une part de graphique pour afficher le détail ici.
				</Typography>
			)}
		</Box>
	);
}

export default function Analyse({ onOpenTransactionsFiltered, navigationContext = null, onNavigationContextApplied = null }) {
	const { transactions, loading: transactionsLoading, error: transactionsError } = useTransactionsContext();
	const { fixedExpenses, loading: fixedLoading, error: fixedError } = useFixedExpenses();
	const { recurringIncome, loading: recurringLoading, error: recurringError } = useRecurringIncome();
	const { accounts } = useAccounts();
	const { categories } = useCategories();
	const { subcategories } = useSubcategories();

	const [period, setPeriod] = useState("currentMonth");
	const [referenceDate, setReferenceDate] = useState(() => new Date());
	const [accountId, setAccountId] = useState("all");
	const [categoryFilter, setCategoryFilter] = useState("all");
	const [selectedSegments, setSelectedSegments] = useState({
		variableExpenses: null,
		variableIncome: null,
		fixedExpenses: null,
		fixedIncome: null,
	});

	const range = useMemo(() => getPeriodRange(period, referenceDate), [period, referenceDate]);
	const previousRange = useMemo(() => getPreviousPeriodRange(period, referenceDate), [period, referenceDate]);
	const fixedExpensesChartCopy = useMemo(() => getAnalysisPieChartCopy("fixedExpenses"), []);
	const variableExpensesChartCopy = useMemo(() => getAnalysisPieChartCopy("variableExpenses"), []);
	const variableExpensesTrendCopy = useMemo(() => getAnalysisTrendChartCopy("variableExpenses", range.granularity), [range.granularity]);
	const variableIncomeTrendCopy = useMemo(() => getAnalysisTrendChartCopy("variableIncome", range.granularity), [range.granularity]);

	const categoryFilterOptions = useMemo(() => {
		const names = new Set();

		(categories || []).forEach((category) => {
			const name = String(category?.name || "").trim();
			if (name && !isTechnicalCategoryDisplayValue(name)) {
				names.add(name);
			}
		});

		return Array.from(names).sort((left, right) => left.localeCompare(right, "fr"));
	}, [categories]);

	const normalizedSelectedCategory = categoryFilter === "all" ? "all" : categoryFilter.trim().toLowerCase();

	const snapshot = useMemo(() => buildAnalysisSnapshot({
		transactions,
		fixedExpenses,
		recurringIncome,
		categories,
		subcategories,
		range,
		previousRange,
		accountId,
		selectedCategory: normalizedSelectedCategory,
	}), [
		transactions,
		fixedExpenses,
		recurringIncome,
		categories,
		subcategories,
		range,
		previousRange,
		accountId,
		normalizedSelectedCategory,
	]);

	const variableExpenseTrendRows = useMemo(
		() => (snapshot.variableExpenses.trend || []).map((entry) => ({ label: entry.label, revenu: 0, depense: entry.value })),
		[snapshot.variableExpenses.trend]
	);

	const variableIncomeTrendRows = useMemo(
		() => (snapshot.variableIncome.trend || []).map((entry) => ({ label: entry.label, revenu: entry.value, depense: 0 })),
		[snapshot.variableIncome.trend]
	);

	useEffect(() => {
		if (!navigationContext?.requestId) {
			return;
		}

		const nextReferenceDate = parseNavigationReferenceDate(navigationContext.referenceDate);
		if (nextReferenceDate) {
			setReferenceDate(nextReferenceDate);
		}
		if (navigationContext.period) {
			setPeriod(navigationContext.period);
		}

		if (typeof onNavigationContextApplied === "function") {
			onNavigationContextApplied();
		}
	}, [navigationContext?.requestId, navigationContext?.period, navigationContext?.referenceDate, onNavigationContextApplied]);

	useEffect(() => {
		setSelectedSegments((previous) => {
			const syncSegment = (current, options = []) => {
				if (!current) {
					return null;
				}

				return options.find((item) => item.categoryName === current.categoryName) || null;
			};

			return {
				variableExpenses: syncSegment(previous.variableExpenses, snapshot.variableExpenses.segments),
				variableIncome: syncSegment(previous.variableIncome, snapshot.variableIncome.segments),
				fixedExpenses: syncSegment(previous.fixedExpenses, snapshot.fixedExpenses.segments),
				fixedIncome: syncSegment(previous.fixedIncome, snapshot.fixedIncome.segments),
			};
		});
	}, [
		snapshot.fixedExpenses.segments,
		snapshot.variableExpenses.segments,
		snapshot.fixedIncome.segments,
		snapshot.variableIncome.segments,
	]);

	function handleSegmentSelect(sectionKey, segment) {
		setSelectedSegments((previous) => ({
			...previous,
			[sectionKey]: segment,
		}));
	}

	function handleCloseSegment(sectionKey) {
		setSelectedSegments((previous) => ({
			...previous,
			[sectionKey]: null,
		}));
	}

	function handleOpenTransactions(sectionType, segment) {
		if (!onOpenTransactionsFiltered || !segment) {
			return;
		}

		onOpenTransactionsFiltered(buildTransactionsNavigationFilters({
			sectionType,
			segment,
			period,
			accountId,
		}));
	}

	const isLoading = transactionsLoading || fixedLoading || recurringLoading;
	const expensesTotal = snapshot.totals.expenses;
	const revenuesTotal = snapshot.totals.revenues;
	const analyticalBalance = snapshot.totals.analyticalBalance;
	const savingsRate = revenuesTotal > 0 ? (analyticalBalance / revenuesTotal) * 100 : 0;
	const topVariableExpense = snapshot.variableExpenses.segments[0] || null;
	const topFixedExpense = snapshot.fixedExpenses.segments[0] || null;
	const topExpenseCategory = [topVariableExpense, topFixedExpense]
		.filter(Boolean)
		.sort((left, right) => Number(right.amount || 0) - Number(left.amount || 0))[0] || null;
	const attentionItems = [
		snapshot.variableExpenses.variation > 20 ? {
			label: "Dépenses variables en forte hausse",
			description: `${getVariationText(snapshot.variableExpenses.variation)}. Vérifie surtout les catégories variables les plus hautes.`,
			severity: "warning",
			color: HORIZON_COLORS.orange,
			icon: <TrendingUp fontSize="inherit" />,
		} : null,
		topExpenseCategory && Number(topExpenseCategory.percentage || 0) >= 35 ? {
			label: "Catégorie dominante",
			description: `${getSafeCategoryLabel(topExpenseCategory.categoryName)} représente ${Number(topExpenseCategory.percentage || 0).toFixed(1)}% de son bloc.`,
			severity: "warning",
			color: HORIZON_COLORS.orange,
			icon: <WarningAmber fontSize="inherit" />,
		} : null,
		snapshot.variableIncome.variation < -15 || snapshot.fixedIncome.variation < -15 ? {
			label: "Revenus en baisse",
			description: `Revenus fixes: ${formatPercent(snapshot.fixedIncome.variation)}. Revenus variables: ${formatPercent(snapshot.variableIncome.variation)}.`,
			severity: "error",
			color: HORIZON_COLORS.red,
			icon: <TrendingDown fontSize="inherit" />,
		} : null,
	].filter(Boolean);

	return (
		<Box sx={{ minWidth: 0, maxWidth: "100%", overflowX: "hidden", "& .MuiButtonBase-root": { minHeight: 44 }, "& canvas, & svg": { maxWidth: "100%" } }}>
			<SectionHeader
				title="Analyse financière"
				subtitle={`${range.label} • ${range.start.toLocaleDateString("fr-FR")} au ${range.end.toLocaleDateString("fr-FR")}`}
			/>

			<FilterPanel
				period={period}
				accountId={accountId}
				categoryFilter={categoryFilter}
				accounts={accounts}
				categoryFilterOptions={categoryFilterOptions}
				range={range}
				onPeriodChange={setPeriod}
				onAccountChange={setAccountId}
				onCategoryChange={setCategoryFilter}
			/>

			{(transactionsError || fixedError || recurringError) && (
				<Alert severity="error" sx={{ mb: 1.25 }}>
					{transactionsError || fixedError || recurringError}
				</Alert>
			)}

			{isLoading && (
				<Alert severity="info" sx={{ mb: 1.25 }}>
					Chargement de l’analyse en cours...
				</Alert>
			)}

			<MonthlySummary expenses={expensesTotal} revenues={revenuesTotal} balance={analyticalBalance} savingsRate={savingsRate} rangeLabel={range.label.toLowerCase()} />
			<AttentionPanel items={attentionItems} />

			<SectionShell title="Cartes KPI" subtitle="Trois lectures rapides: sortie d'argent, entrée d'argent, capacité d'épargne.">
				<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
					<SummaryMetricCard
						title="Dépenses"
						total={expensesTotal}
						share={revenuesTotal > 0 ? (expensesTotal / revenuesTotal) * 100 : 0}
						variation={snapshot.variableExpenses.variation}
						tone={HORIZON_COLORS.red}
						icon={<TrendingDown fontSize="small" />}
					/>
					<SummaryMetricCard
						title="Revenus"
						total={revenuesTotal}
						share={revenuesTotal > 0 ? 100 : 0}
						variation={snapshot.variableIncome.variation}
						tone={HORIZON_COLORS.green}
						icon={<TrendingUp fontSize="small" />}
					/>
					<SummaryMetricCard
						title="Épargne"
						total={analyticalBalance}
						share={savingsRate}
						variation={null}
						tone={analyticalBalance >= 0 ? HORIZON_COLORS.blue : HORIZON_COLORS.orange}
						icon={<Savings fontSize="small" />}
					/>
				</Box>
			</SectionShell>

			<SectionShell
				title="Graphiques"
				subtitle="Les donnees existantes sont conservées ; seule la lecture est réorganisée."
				action={<Chip size="small" icon={<PieChart />} label="Répartition et tendance" variant="outlined" />}
			>
				<Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.25 }}>
					<ExpenseCategoryPieChart
						data={snapshot.variableExpenses.segments}
						total={snapshot.variableExpenses.total}
						{...variableExpensesChartCopy}
						onSegmentSelect={(segment) => handleSegmentSelect("variableExpenses", segment)}
						selectedCategory={selectedSegments.variableExpenses?.categoryName || ""}
					/>
					<IncomeExpenseTrendChart data={variableExpenseTrendRows} {...variableExpensesTrendCopy} />
					<ExpenseCategoryPieChart
						data={snapshot.fixedExpenses.segments}
						total={snapshot.fixedExpenses.total}
						{...fixedExpensesChartCopy}
						onSegmentSelect={(segment) => handleSegmentSelect("fixedExpenses", segment)}
						selectedCategory={selectedSegments.fixedExpenses?.categoryName || ""}
					/>
					<IncomeExpenseTrendChart data={variableIncomeTrendRows} {...variableIncomeTrendCopy} />
				</Box>
			</SectionShell>

			<SectionShell title="Classements" subtitle="Les plus gros postes passent en cartes avec montant, part et barre de progression.">
				<Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.25 }}>
					<RankingCards
						title="Dépenses variables"
						subtitle="Catégories qui expliquent le plus les sorties variables."
						items={snapshot.variableExpenses.segments}
						total={snapshot.variableExpenses.total}
						emptyMessage="Aucune dépense variable sur cette période."
						tone={HORIZON_COLORS.red}
						onSelect={(segment) => handleSegmentSelect("variableExpenses", segment)}
						selectedCategory={selectedSegments.variableExpenses?.categoryName || ""}
					/>
					<RankingCards
						title="Frais fixes"
						subtitle="Postes récurrents les plus structurants."
						items={snapshot.fixedExpenses.segments}
						total={snapshot.fixedExpenses.total}
						emptyMessage="Aucun frais fixe calculé sur cette période."
						tone={HORIZON_COLORS.orange}
						onSelect={(segment) => handleSegmentSelect("fixedExpenses", segment)}
						selectedCategory={selectedSegments.fixedExpenses?.categoryName || ""}
					/>
					<RankingCards
						title="Revenus fixes"
						subtitle="Sources récurrentes les plus importantes."
						items={snapshot.fixedIncome.segments}
						total={snapshot.fixedIncome.total}
						emptyMessage="Aucun revenu fixe calculé sur cette période."
						tone={HORIZON_COLORS.green}
						onSelect={(segment) => handleSegmentSelect("fixedIncome", segment)}
						selectedCategory={selectedSegments.fixedIncome?.categoryName || ""}
					/>
					<RankingCards
						title="Revenus variables"
						subtitle="Catégories de revenus ponctuels."
						items={snapshot.variableIncome.segments}
						total={snapshot.variableIncome.total}
						emptyMessage="Aucun revenu variable sur cette période."
						tone={HORIZON_COLORS.blue}
						onSelect={(segment) => handleSegmentSelect("variableIncome", segment)}
						selectedCategory={selectedSegments.variableIncome?.categoryName || ""}
					/>
				</Box>
			</SectionShell>

			<SectionShell
				title="Détails"
				subtitle="Lecture compacte par bloc, avec accès aux transactions quand un segment le permet."
				action={<Chip size="small" icon={<AccountBalanceWallet />} label={`${snapshot.variableExpenses.count + snapshot.variableIncome.count} transactions filtrées`} variant="outlined" />}
			>
				{snapshot.fallbackNotes.length > 0 && (
					<Alert severity="warning" sx={{ mb: 1.5 }}>
						{snapshot.fallbackNotes.join(" ")}
					</Alert>
				)}

				<Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 1.25 }}>
					<DetailOverviewCard
						title="Dépenses variables"
						total={snapshot.variableExpenses.total}
						countLabel={`${snapshot.variableExpenses.count} transactions. Moyenne: ${formatCurrency(snapshot.variableExpenses.averagePerBucket)} par ${range.granularity === "week" ? "semaine" : "mois"}.`}
						variation={snapshot.variableExpenses.variation}
						tone={HORIZON_COLORS.red}
						segment={selectedSegments.variableExpenses}
						sectionType="expense-variable"
						onViewTransactions={() => handleOpenTransactions("expense-variable", selectedSegments.variableExpenses)}
						onClose={() => handleCloseSegment("variableExpenses")}
					/>
					<DetailOverviewCard
						title="Dépenses fixes"
						total={snapshot.fixedExpenses.total}
						countLabel={`${snapshot.fixedExpenses.count} postes. ${snapshot.fixedExpenses.matchedTransactionsCount} transactions déjà détectées.`}
						variation={snapshot.fixedExpenses.variation}
						tone={HORIZON_COLORS.orange}
						segment={selectedSegments.fixedExpenses}
						sectionType="expense-fixed"
						onViewTransactions={() => handleOpenTransactions("expense-fixed", selectedSegments.fixedExpenses)}
						onClose={() => handleCloseSegment("fixedExpenses")}
					/>
					<DetailOverviewCard
						title="Revenus récurrents"
						total={snapshot.fixedIncome.total}
						countLabel={`${snapshot.fixedIncome.activeSources} sources actives. ${snapshot.fixedIncome.matchedTransactionsCount} transactions déjà détectées.`}
						variation={snapshot.fixedIncome.variation}
						tone={HORIZON_COLORS.green}
						segment={selectedSegments.fixedIncome}
						sectionType="income-fixed"
						onViewTransactions={() => handleOpenTransactions("income-fixed", selectedSegments.fixedIncome)}
						onClose={() => handleCloseSegment("fixedIncome")}
					/>
					<DetailOverviewCard
						title="Revenus variables"
						total={snapshot.variableIncome.total}
						countLabel={`Moyenne: ${formatCurrency(snapshot.variableIncome.averagePerBucket)} par ${range.granularity === "week" ? "semaine" : "mois"}. Meilleure période: ${snapshot.variableIncome.bestBucket?.label || "N/A"}.`}
						variation={snapshot.variableIncome.variation}
						tone={HORIZON_COLORS.blue}
						segment={selectedSegments.variableIncome}
						sectionType="income-variable"
						onViewTransactions={() => handleOpenTransactions("income-variable", selectedSegments.variableIncome)}
						onClose={() => handleCloseSegment("variableIncome")}
					/>
				</Box>
			</SectionShell>
		</Box>
	);
}
