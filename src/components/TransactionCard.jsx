import CompactFinanceCard from "./CompactFinanceCard";
import { getSafeIconLabel } from "../utils/displayTextUtils";
import { normalizeTransactionType } from "../utils/transactionTypeUtils";
import { getTransactionDisplayCategoryLabel } from "../utils/transactionCategoryDisplay";
import { TRANSACTION_EDITOR_FOCUS_TARGETS } from "../constants/transactionEditorFocusTargets";

function formatAmountValue(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
}

function getTransactionKind(transaction) {
  const rawType = String(transaction?.type || "").toLowerCase();
  const normalizedType = normalizeTransactionType(transaction?.type);

  if (transaction?.isAdjustment || rawType === "adjustment") {
    return "adjustment";
  }

  if (normalizedType === "depense") {
    return "expense";
  }

  if (normalizedType === "revenu") {
    return "income";
  }

  return "transfer";
}

function getAmountDisplay(transaction) {
  const kind = getTransactionKind(transaction);
  const amount = Number(transaction?.montant ?? transaction?.amount ?? 0);
  const formattedAmount = `${formatAmountValue(amount)} EUR`;

  if (kind === "adjustment") {
    return {
      text: `⚙ ${amount > 0 ? "+" : amount < 0 ? "-" : ""}${formattedAmount}`,
      color: "#d97706",
    };
  }

  if (kind === "expense") {
    return {
      text: `- ${formattedAmount}`,
      color: "#c24135",
    };
  }

  if (kind === "income") {
    return {
      text: `+ ${formattedAmount}`,
      color: "#147d64",
    };
  }

  return {
    text: `⇄ ${formattedAmount}`,
    color: "#0f5f8f",
  };
}

function getAmountSegments(transaction, amountText) {
  const kind = getTransactionKind(transaction);
  const prefix = kind === "expense" ? "-"
    : kind === "income" ? "+"
      : kind === "adjustment" ? "⚙"
        : "⇄";

  if (!amountText?.startsWith(prefix)) {
    return [{ text: amountText, field: TRANSACTION_EDITOR_FOCUS_TARGETS.amount }];
  }

  return [
    { text: prefix, field: TRANSACTION_EDITOR_FOCUS_TARGETS.type },
    { text: amountText.slice(prefix.length), field: TRANSACTION_EDITOR_FOCUS_TARGETS.amount },
  ];
}

function getReferenceLineParts(transaction, references = {}) {
  const parts = [];
  const activityLabel = transaction?.activityName || references.activity?.name || "";
  const thirdPartyLabel = transaction?.thirdPartyName || references.thirdParty?.name || "";
  const projectLabel = transaction?.projectName || references.project?.name || "";

  if (activityLabel) {
    const archived = references.activity?.isActive === false ? " (Archive)" : "";
    parts.push(`Activite: ${activityLabel}${archived}`);
  }

  if (thirdPartyLabel) {
    const archived = references.thirdParty?.isActive === false ? " (Archive)" : "";
    parts.push(`Tiers: ${thirdPartyLabel}${archived}`);
  }

  if (projectLabel) {
    const archived = references.project?.isActive === false ? " (Archive)" : "";
    parts.push(`Projet: ${projectLabel}${archived}`);
  }

  return parts.join(" - ");
}

function getCategoryIcon(categoryMeta) {
  return getSafeIconLabel(categoryMeta?.icon) === "Icône" ? "◦" : getSafeIconLabel(categoryMeta?.icon);
}

export default function TransactionCard({
  transaction,
  getAccountLabel,
  categoryMeta,
  subcategory,
  activity,
  thirdParty,
  project,
  selectionMode = false,
  selected = false,
  onSelectionToggle,
  onEditClick,
  onMenuClick,
  onFieldDoubleClick,
  enableDoubleClickEdit = false,
}) {
  const amountDisplay = getAmountDisplay(transaction);
  const transactionKind = getTransactionKind(transaction);
  const category = getTransactionDisplayCategoryLabel(transaction, categoryMeta);
  const subcategoryLabel = transaction?.subcategoryName || subcategory?.name || "";
  const subcategorySuffix = subcategory?.isActive === false ? " (Archive)" : "";
  const accountLabel = getAccountLabel(transaction?.accountId);
  const date = transaction?.date || "Date inconnue";
  const activityLabel = transaction?.activityName || activity?.name || "";
  const thirdPartyLabel = transaction?.thirdPartyName || thirdParty?.name || "";
  const projectLabel = transaction?.projectName || project?.name || "";
  const typeSuffix = transaction?.needsTypeReview ? "Type legacy a revoir" : "";
  const details = [
    date,
    getReferenceLineParts(transaction, { activity, thirdParty, project }),
    typeSuffix,
  ].filter(Boolean).join(" - ");

  const badges = [
    { label: "Categorie", value: category, field: TRANSACTION_EDITOR_FOCUS_TARGETS.category },
    subcategoryLabel ? { label: "Sous-cat.", value: `${subcategoryLabel}${subcategorySuffix}`, field: TRANSACTION_EDITOR_FOCUS_TARGETS.subcategory } : null,
    { label: "Compte", value: accountLabel, field: TRANSACTION_EDITOR_FOCUS_TARGETS.account },
    activityLabel ? { label: "Activite", value: `${activityLabel}${activity?.isActive === false ? " (Archive)" : ""}`, field: TRANSACTION_EDITOR_FOCUS_TARGETS.activity } : null,
    thirdPartyLabel ? { label: "Tiers", value: `${thirdPartyLabel}${thirdParty?.isActive === false ? " (Archive)" : ""}`, field: TRANSACTION_EDITOR_FOCUS_TARGETS.thirdParty } : null,
    projectLabel ? { label: "Projet", value: `${projectLabel}${project?.isActive === false ? " (Archive)" : ""}`, field: TRANSACTION_EDITOR_FOCUS_TARGETS.project } : null,
  ].filter(Boolean);

  return (
    <CompactFinanceCard
      title={transaction?.description || "Sans description"}
      subtitle={details}
      details={details}
      amount={amountDisplay.text}
      amountColor={amountDisplay.color}
      categoryIcon={getCategoryIcon(categoryMeta)}
      transactionKind={transactionKind}
      badges={badges}
      selectionMode={selectionMode}
      selected={selected}
      onSelectionToggle={onSelectionToggle}
      onEditClick={onEditClick}
      onMenuClick={onMenuClick}
      onFieldDoubleClick={onFieldDoubleClick}
      enableDoubleClickEdit={enableDoubleClickEdit}
      titleField={TRANSACTION_EDITOR_FOCUS_TARGETS.description}
      categoryIconField={TRANSACTION_EDITOR_FOCUS_TARGETS.category}
      amountSegments={getAmountSegments(transaction, amountDisplay.text)}
      metaPrimarySegments={[
        { text: category, field: TRANSACTION_EDITOR_FOCUS_TARGETS.category },
        ...(subcategoryLabel
          ? [{ text: ` > ${subcategoryLabel}${subcategorySuffix}`, field: TRANSACTION_EDITOR_FOCUS_TARGETS.subcategory }]
          : []),
      ]}
      metaSecondarySegments={[
        { text: " - " },
        { text: accountLabel, field: TRANSACTION_EDITOR_FOCUS_TARGETS.account },
        { text: " - " },
        { text: date, field: TRANSACTION_EDITOR_FOCUS_TARGETS.date },
        ...(typeSuffix
          ? [
              { text: " - " },
              { text: typeSuffix, field: TRANSACTION_EDITOR_FOCUS_TARGETS.type },
            ]
          : []),
      ]}
      detailsSegments={[
        { text: date, field: TRANSACTION_EDITOR_FOCUS_TARGETS.date },
        ...(activityLabel ? [{ text: " - " }, { text: activityLabel, field: TRANSACTION_EDITOR_FOCUS_TARGETS.activity }] : []),
        ...(thirdPartyLabel ? [{ text: " - " }, { text: thirdPartyLabel, field: TRANSACTION_EDITOR_FOCUS_TARGETS.thirdParty }] : []),
        ...(projectLabel ? [{ text: " - " }, { text: projectLabel, field: TRANSACTION_EDITOR_FOCUS_TARGETS.project }] : []),
      ]}
    />
  );
}
