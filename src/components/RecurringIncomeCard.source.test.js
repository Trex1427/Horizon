import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("RecurringIncomeCard wires desktop double-click edit while preserving the menu edit action", async () => {
  const content = await readFile(resolve(process.cwd(), "src/components/RecurringIncomeCard.jsx"), "utf8");

  assert.equal(content.includes('onEditClick={() => onEdit(recurringIncome)}'), true);
  assert.equal(content.includes("enableDoubleClickEdit={enableDoubleClickEdit}"), true);
  assert.equal(content.includes("onEdit(recurringIncome);"), true);
});

test("RevenusRecurrents enables double-click only at the desktop breakpoint", async () => {
  const content = await readFile(resolve(process.cwd(), "src/pages/RevenusRecurrents.jsx"), "utf8");

  assert.equal(content.includes('useMediaQuery(theme.breakpoints.up("md"))'), true);
  assert.equal(content.includes("enableDoubleClickEdit={enableDesktopDoubleClickEdit}"), true);
});
