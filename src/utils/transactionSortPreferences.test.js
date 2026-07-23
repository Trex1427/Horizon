import test from "node:test";
import assert from "node:assert/strict";

import {
  parseTransactionSortPreferences,
  sanitizeTransactionSortPreferences,
} from "./transactionSortPreferences.js";

test("parseTransactionSortPreferences falls back to defaults when storage is invalid", () => {
  const defaults = { field: "date", direction: "desc" };

  const fromInvalidJson = parseTransactionSortPreferences("{bad-json", defaults);
  assert.deepEqual(fromInvalidJson, defaults);

  const fromInvalidShape = parseTransactionSortPreferences(
    JSON.stringify({ field: "unknown", direction: "down" }),
    defaults
  );
  assert.deepEqual(fromInvalidShape, defaults);
});

test("sanitizeTransactionSortPreferences keeps supported fields and directions", () => {
  const defaults = { field: "date", direction: "desc" };

  assert.deepEqual(
    sanitizeTransactionSortPreferences({ field: "amount", direction: "asc" }, defaults),
    { field: "amount", direction: "asc" }
  );

  assert.deepEqual(
    sanitizeTransactionSortPreferences({ field: "type", direction: "asc" }, defaults),
    { field: "type", direction: "asc" }
  );
});

test("reset behavior is represented by defaults", () => {
  const defaults = { field: "date", direction: "desc" };
  const resetValue = parseTransactionSortPreferences(null, defaults);

  assert.deepEqual(resetValue, { field: "date", direction: "desc" });
});
