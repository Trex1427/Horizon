import { Card, CardContent, Box, IconButton, Typography, Checkbox, Chip, Tooltip } from "@mui/material";
import MoreVert from "@mui/icons-material/MoreVert";

const TYPE_STYLES = {
  expense: {
    label: "Dépense",
    color: "#c24135",
    bg: "rgba(194, 65, 53, 0.08)",
    border: "rgba(194, 65, 53, 0.26)",
  },
  income: {
    label: "Revenu",
    color: "#147d64",
    bg: "rgba(20, 125, 100, 0.08)",
    border: "rgba(20, 125, 100, 0.26)",
  },
  fixedExpense: {
    label: "Dépense fixe",
    color: "#c24135",
    bg: "rgba(194, 65, 53, 0.08)",
    border: "rgba(194, 65, 53, 0.26)",
  },
  recurringIncome: {
    label: "Revenu récurrent",
    color: "#147d64",
    bg: "rgba(20, 125, 100, 0.08)",
    border: "rgba(20, 125, 100, 0.26)",
  },
  futureIncome: {
    label: "Revenu futur",
    color: "#147d64",
    bg: "rgba(20, 125, 100, 0.08)",
    border: "rgba(20, 125, 100, 0.26)",
  },
  transfer: {
    label: "Transfert",
    color: "#0f5f8f",
    bg: "rgba(15, 95, 143, 0.08)",
    border: "rgba(15, 95, 143, 0.26)",
  },
  adjustment: {
    label: "Ajustement",
    color: "#d97706",
    bg: "rgba(217, 119, 6, 0.1)",
    border: "rgba(217, 119, 6, 0.28)",
  },
};

function renderBadge(badge, index, handleFieldDoubleClick) {
  if (!badge?.value) {
    return null;
  }

  const label = badge.label ? `${badge.label}: ${badge.value}` : badge.value;
  const chip = (
    <Chip
      key={`${badge.label || "badge"}-${badge.value || index}`}
      label={label}
      size="small"
      variant="outlined"
      data-transaction-focus-target={badge.field || undefined}
      onDoubleClick={badge.field ? (event) => handleFieldDoubleClick(badge.field, event) : undefined}
      sx={{
        maxWidth: { xs: 138, sm: 190 },
        height: 22,
        borderRadius: "999px",
        borderColor: "rgba(20, 41, 43, 0.14)",
        bgcolor: "rgba(246, 248, 244, 0.9)",
        color: "#42575b",
        fontWeight: 700,
        fontSize: "0.68rem",
        "& .MuiChip-label": {
          px: 0.8,
          overflow: "hidden",
          textOverflow: "ellipsis",
        },
      }}
    />
  );

  if (String(label).length <= 22) {
    return chip;
  }

  return (
    <Tooltip key={`${badge.label || "badge"}-${badge.value || index}-tooltip`} title={label} arrow>
      {chip}
    </Tooltip>
  );
}

export default function CompactFinanceCard({
  title,
  subtitle,
  metaPrimary = "",
  metaSecondary = "",
  details = "",
  titleField = "",
  categoryIconField = "",
  amountSegments = [],
  metaPrimarySegments = [],
  metaSecondarySegments = [],
  detailsSegments = [],
  amount,
  amountColor,
  categoryIcon,
  transactionKind = "expense",
  badges = [],
  selected = false,
  selectionMode = false,
  onSelectionToggle,
  onEditClick,
  onMenuClick,
  onFieldDoubleClick,
  enableDoubleClickEdit = false,
}) {
  const detailsText = details || ((metaPrimary || metaSecondary) ? "" : subtitle);
  const isInteractive = selectionMode ? typeof onSelectionToggle === "function" : typeof onEditClick === "function";
  const typeStyle = TYPE_STYLES[transactionKind] || TYPE_STYLES.expense;

  function handlePrimaryAction() {
    if (selectionMode) {
      onSelectionToggle?.();
      return;
    }

    onEditClick?.();
  }

  function handleCardKeyDown(event) {
    if (!isInteractive) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handlePrimaryAction();
    }
  }

  function getFieldFromEvent(event) {
    const directTarget = event?.target?.closest?.("[data-transaction-focus-target]");
    if (directTarget) {
      return directTarget.getAttribute("data-transaction-focus-target") || "";
    }

    if (typeof document === "undefined" || typeof document.elementsFromPoint !== "function") {
      return "";
    }

    const pointedTarget = document
      .elementsFromPoint(event.clientX || 0, event.clientY || 0)
      .map((element) => element.closest?.("[data-transaction-focus-target]"))
      .find(Boolean);

    if (pointedTarget) {
      return pointedTarget.getAttribute("data-transaction-focus-target") || "";
    }

    const scopedTargets = [...(event.currentTarget?.querySelectorAll?.("[data-transaction-focus-target]") || [])];
    const targetFromBounds = scopedTargets.find((element) => {
      const rect = element.getBoundingClientRect();
      return event.clientX >= rect.left - 4
        && event.clientX <= rect.right + 4
        && event.clientY >= rect.top - 4
        && event.clientY <= rect.bottom + 4;
    });

    return targetFromBounds?.getAttribute?.("data-transaction-focus-target") || "";
  }

  function handleCardDoubleClick(event) {
    if (selectionMode) {
      return;
    }

    if (!enableDoubleClickEdit) {
      return;
    }

    const field = getFieldFromEvent(event);
    if (field) {
      onFieldDoubleClick?.(field, event);
      return;
    }

    onEditClick?.();
  }

  function handleFieldDoubleClick(field, event) {
    if (!field || selectionMode || !enableDoubleClickEdit) {
      return;
    }

    event.stopPropagation();
    onFieldDoubleClick?.(field, event);
  }

  function renderSegments(segments, fallbackText = "") {
    if (!segments.length) {
      return fallbackText;
    }

    return segments.map((segment, index) => {
      if (!segment?.field) {
        return <span key={`${segment?.text || "segment"}-${index}`}>{segment?.text || ""}</span>;
      }

      return (
        <Box
          component="span"
          key={`${segment.field}-${index}`}
          data-transaction-focus-target={segment.field}
          onDoubleClick={(event) => handleFieldDoubleClick(segment.field, event)}
        >
          {segment.text}
        </Box>
      );
    });
  }

  const shouldHandleSingleClick = selectionMode || !enableDoubleClickEdit;

  const card = (
    <Card
      onClick={isInteractive && shouldHandleSingleClick ? handlePrimaryAction : undefined}
      onDoubleClick={isInteractive && !selectionMode && enableDoubleClickEdit ? handleCardDoubleClick : undefined}
      onKeyDown={handleCardKeyDown}
      tabIndex={isInteractive ? 0 : -1}
      role={isInteractive ? "button" : undefined}
      aria-label={`${typeStyle.label} ${title || ""} ${amount || ""}`.trim()}
      sx={{
        mb: { xs: 0.75, sm: 0.9 },
        cursor: isInteractive ? "pointer" : "default",
        border: "1px solid",
        borderColor: selected ? typeStyle.color : "rgba(20, 41, 43, 0.1)",
        borderLeft: "4px solid",
        borderLeftColor: typeStyle.color,
        borderRadius: 2,
        bgcolor: selected ? "rgba(15, 95, 143, 0.05)" : "rgba(255, 255, 255, 0.94)",
        boxShadow: selected ? "0 10px 24px rgba(15, 95, 143, 0.14)" : "0 5px 18px rgba(23, 42, 47, 0.07)",
        transition: "border-color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease, background-color 0.16s ease",
        "&:hover": isInteractive ? {
          boxShadow: "0 12px 28px rgba(23, 42, 47, 0.14)",
          transform: "translateY(-1px)",
          borderColor: typeStyle.border,
        } : undefined,
        "&:focus-visible": {
          outline: "3px solid rgba(15, 95, 143, 0.28)",
          outlineOffset: 2,
        },
      }}
    >
      <CardContent
        sx={{
          py: { xs: 0.85, sm: 1 },
          px: { xs: 1, sm: 1.25 },
          "&:last-child": { pb: { xs: 0.85, sm: 1 } },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: { xs: 0.8, sm: 1.25 } }}>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.65, minWidth: 0 }}>
              {selectionMode ? (
                <Checkbox
                  checked={selected}
                  onChange={onSelectionToggle}
                  onClick={(event) => event.stopPropagation()}
                  size="small"
                  sx={{ p: 0, mr: 0.25, flexShrink: 0 }}
                />
              ) : null}
              {categoryIcon ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  data-transaction-focus-target={categoryIconField || undefined}
                  onDoubleClick={categoryIconField ? (event) => handleFieldDoubleClick(categoryIconField, event) : undefined}
                  sx={{ lineHeight: 1, flexShrink: 0 }}
                >
                  {categoryIcon}
                </Typography>
              ) : null}
              <Typography
                fontWeight={800}
                noWrap
                data-transaction-focus-target={titleField || undefined}
                onDoubleClick={titleField ? (event) => handleFieldDoubleClick(titleField, event) : undefined}
                sx={{ fontSize: { xs: "0.94rem", sm: "1.02rem" }, lineHeight: 1.18, color: "#172a2f" }}
              >
                {title}
              </Typography>
            </Box>

            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.45, mt: 0.45, overflow: "hidden" }}>
              <Chip
                label={typeStyle.label}
                size="small"
                sx={{
                  height: 22,
                  borderRadius: "999px",
                  bgcolor: typeStyle.bg,
                  color: typeStyle.color,
                  border: "1px solid",
                  borderColor: typeStyle.border,
                  fontWeight: 800,
                  fontSize: "0.68rem",
                }}
              />
              {badges.map((badge, index) => renderBadge(badge, index, handleFieldDoubleClick))}
            </Box>

            {detailsText ? (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 0.35,
                  fontSize: { xs: "0.7rem", sm: "0.74rem" },
                  whiteSpace: "pre-line",
                  display: "-webkit-box",
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  opacity: 0.9,
                  lineHeight: 1.2,
                }}
              >
                {renderSegments(detailsSegments, detailsText)}
              </Typography>
            ) : null}
          </Box>

          <Box sx={{ display: "flex", alignItems: "center", gap: 0.1, flexShrink: 0 }}>
            <Typography
              fontWeight={900}
              color={amountColor}
              sx={{
                minWidth: { xs: 86, sm: 122 },
                textAlign: "right",
                fontSize: { xs: "1.08rem", sm: "1.24rem" },
                letterSpacing: 0,
                lineHeight: 1.08,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {renderSegments(amountSegments, amount)}
            </Typography>
            {!selectionMode && (
              <IconButton
                size="small"
                aria-label="Actions"
                onClick={(event) => {
                  event.stopPropagation();
                  onMenuClick?.(event);
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                }}
                sx={{ p: 0.35 }}
              >
                <MoreVert fontSize="small" />
              </IconButton>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return enableDoubleClickEdit && isInteractive && !selectionMode ? (
    <Tooltip title="Double-clic pour modifier" arrow placement="top">
      {card}
    </Tooltip>
  ) : card;
}
