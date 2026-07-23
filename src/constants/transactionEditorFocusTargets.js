export const TRANSACTION_EDITOR_FOCUS_TARGETS = Object.freeze({
  description: "description",
  date: "date",
  amount: "amount",
  type: "type",
  account: "account",
  category: "category",
  subcategory: "subcategory",
  thirdParty: "thirdParty",
  activity: "activity",
  project: "project",
});

export const TRANSACTION_EDITOR_FOCUS_SELECTORS = Object.freeze({
  [TRANSACTION_EDITOR_FOCUS_TARGETS.description]: 'input[name="description"]',
  [TRANSACTION_EDITOR_FOCUS_TARGETS.date]: 'input[name="date"]',
  [TRANSACTION_EDITOR_FOCUS_TARGETS.amount]: 'input[name="montant"]',
  [TRANSACTION_EDITOR_FOCUS_TARGETS.type]: 'input[name="type"]',
  [TRANSACTION_EDITOR_FOCUS_TARGETS.account]: 'input[name="accountId"]',
  [TRANSACTION_EDITOR_FOCUS_TARGETS.category]: 'input[name="categorie"]',
  [TRANSACTION_EDITOR_FOCUS_TARGETS.subcategory]: 'input[name="subcategoryId"]',
  [TRANSACTION_EDITOR_FOCUS_TARGETS.thirdParty]: 'input[name="thirdPartyId"]',
  [TRANSACTION_EDITOR_FOCUS_TARGETS.activity]: 'input[name="activityId"]',
  [TRANSACTION_EDITOR_FOCUS_TARGETS.project]: 'input[name="projectId"]',
});

export function getTransactionEditorFocusSelector(focusTarget = "") {
  return TRANSACTION_EDITOR_FOCUS_SELECTORS[focusTarget] || "";
}
