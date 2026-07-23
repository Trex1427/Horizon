const DEFAULT_FIELDS = new Set(["date", "amount", "description", "category", "account", "type"]);
const DEFAULT_DIRECTIONS = new Set(["asc", "desc"]);

export function sanitizeTransactionSortPreferences(value = {}, defaults = { field: "date", direction: "desc" }) {
  return {
    field: DEFAULT_FIELDS.has(value?.field) ? value.field : defaults.field,
    direction: DEFAULT_DIRECTIONS.has(value?.direction) ? value.direction : defaults.direction,
  };
}

export function parseTransactionSortPreferences(rawValue, defaults = { field: "date", direction: "desc" }) {
  if (!rawValue) {
    return defaults;
  }

  try {
    return sanitizeTransactionSortPreferences(JSON.parse(rawValue), defaults);
  } catch {
    return defaults;
  }
}
