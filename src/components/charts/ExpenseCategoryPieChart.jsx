import { Box, Stack, Typography } from "@mui/material";
import { buildChartSegment } from "../../utils/analysisInteractionUtils";
import { getSafeCategoryLabel } from "../../utils/displayTextUtils";

const PIE_COLORS = ["#0f5f8f", "#147d64", "#d97706", "#c24135", "#2f7d82", "#61777b", "#172a2f"];
const CHART_CARD_SX = {
  border: "1px solid",
  borderColor: "rgba(23, 42, 47, 0.12)",
  borderRadius: 2,
  p: { xs: 1.25, sm: 1.5 },
  background: "rgba(255,255,255,0.96)",
  boxShadow: "0 10px 24px rgba(20, 41, 43, 0.07)",
};

function formatCurrency(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function buildConicGradient(data = []) {
  let cursor = 0;
  const slices = data.map((entry, index) => {
    const segmentName = getSafeCategoryLabel(entry?.categoryName || entry?.name, `Segment ${index + 1}`);
    const size = Math.max(0, Number(entry?.percentage ?? entry?.percent) || 0);
    const start = cursor;
    const end = Math.min(100, start + size);
    cursor = end;
    return {
      ...entry,
      name: segmentName,
      categoryName: segmentName,
      amount: Number(entry?.amount || 0),
      percent: size,
      color: PIE_COLORS[index % PIE_COLORS.length],
      start,
      end,
    };
  });

  const gradient = slices
    .map((slice) => `${slice.color} ${slice.start}% ${slice.end}%`)
    .join(", ");

  return {
    gradient,
    slices,
  };
}

function describeArc(cx, cy, radius, startAngle, endAngle) {
  const start = {
    x: cx + radius * Math.cos(startAngle),
    y: cy + radius * Math.sin(startAngle),
  };
  const end = {
    x: cx + radius * Math.cos(endAngle),
    y: cy + radius * Math.sin(endAngle),
  };
  const largeArcFlag = endAngle - startAngle <= Math.PI ? "0" : "1";

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

export default function ExpenseCategoryPieChart({
  data = [],
  total = 0,
  title = "Répartition par catégorie",
  subtitle = "",
  totalLabel = "Total",
  emptyMessage = "Aucune donnée à afficher.",
  valueLabel = "Montant",
  entityLabelSingular = "element",
  entityLabelPlural = "elements",
  onSegmentSelect,
  onSelectCategory,
  selectedCategory = "",
}) {
  if (!Array.isArray(data) || data.length === 0 || Number(total) <= 0) {
    return (
      <Box sx={CHART_CARD_SX}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: subtitle ? 0.25 : 1 }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
            {subtitle}
          </Typography>
        ) : null}
        <Typography variant="body2" color="text.secondary">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  const { slices } = buildConicGradient(data);
  const activeSegmentName = selectedCategory || "";
  const onSelect = onSegmentSelect || ((segment) => onSelectCategory?.(segment));

  return (
    <Box sx={CHART_CARD_SX}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      {subtitle ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          {subtitle}
        </Typography>
      ) : null}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "128px 1fr" }, gap: { xs: 1.25, sm: 1.75 }, alignItems: "center" }}>
        <Box sx={{ display: "flex", justifyContent: "center" }}>
          <Box sx={{ width: 128, height: 128, position: "relative" }}>
            <svg
              width="128"
              height="128"
              viewBox="0 0 120 120"
              role="img"
              aria-label={title}
              title={formatCurrency(total)}
              style={{ transform: "rotate(-90deg)" }}
            >
              <circle cx="60" cy="60" r="40" fill="none" stroke="#E0E0E0" strokeWidth="24" />
              {slices.map((entry) => {
                const startAngle = (entry.start / 100) * Math.PI * 2;
                const endAngle = (entry.end / 100) * Math.PI * 2;
                const segment = buildChartSegment({ ...entry, categoryName: entry.name });
                const isActive = activeSegmentName === segment.categoryName;

                return (
                  <path
                    key={`arc-${entry.name}-${entry.start}`}
                    d={describeArc(60, 60, 40, startAngle, endAngle)}
                    fill="none"
                    stroke={entry.color}
                    strokeWidth={isActive ? 26 : 24}
                    strokeLinecap="round"
                    style={{ cursor: onSelect ? "pointer" : "default" }}
                    role={onSelect ? "button" : undefined}
                    tabIndex={onSelect ? 0 : -1}
                    aria-label={`${segment.categoryName}: ${formatCurrency(segment.amount)}`}
                    onClick={() => onSelect?.(segment)}
                    onKeyDown={(event) => {
                      if (!onSelect) {
                        return;
                      }

                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(segment);
                      }
                    }}
                  />
                );
              })}
            </svg>

            <Box
              sx={{
                position: "absolute",
                inset: 18,
                borderRadius: "50%",
                bgcolor: "background.paper",
                display: "grid",
                placeItems: "center",
                textAlign: "center",
                px: 0.5,
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {totalLabel}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {formatCurrency(total)}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Stack spacing={0.85}>
          {slices.map((entry) => (
            <Box
              key={`legend-${entry.name}-${entry.start}`}
              component="button"
              type="button"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 1,
                width: "100%",
                minHeight: 36,
                border: "1px solid",
                borderColor: activeSegmentName === entry.name ? "primary.main" : "transparent",
                cursor: onSelect ? "pointer" : "default",
                borderRadius: 1.5,
                px: 0.75,
                py: 0.5,
                bgcolor: activeSegmentName === entry.name ? "action.selected" : "transparent",
                textAlign: "left",
                outline: "none",
                "&:focus-visible": { outline: "3px solid rgba(15, 95, 143, 0.28)", outlineOffset: 2 },
              }}
              title={`${entry.name} - ${valueLabel}: ${formatCurrency(entry.amount)} (${Math.round(entry.percent)}% des ${entityLabelPlural})`}
              onClick={() => onSelect?.(buildChartSegment({ ...entry, categoryName: entry.name }))}
              onKeyDown={(event) => {
                if (!onSelect) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelect(buildChartSegment({ ...entry, categoryName: entry.name }));
                }
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: "50%", bgcolor: entry.color, flexShrink: 0 }} />
                <Typography variant="caption" sx={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {entry.name}
                </Typography>
              </Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{
                  whiteSpace: "normal",
                  textAlign: "right",
                  overflowWrap: "anywhere",
                  maxWidth: 120,
                }}
              >
                {Math.round(entry.percent)}% - {formatCurrency(entry.amount)} ({Math.round(entry.percent) === 1 ? entityLabelSingular : entityLabelPlural})
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
