import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const compactCardPath = resolve(process.cwd(), "src/components/CompactFinanceCard.jsx");

test("CompactFinanceCard stops targeted double-click propagation and protects selection mode", async () => {
  const content = await readFile(compactCardPath, "utf8");

  assert.equal(content.includes("function handleFieldDoubleClick(field, event)"), true);
  assert.equal(content.includes("function getFieldFromEvent(event)"), true);
  assert.equal(content.includes('closest?.("[data-transaction-focus-target]")'), true);
  assert.equal(content.includes("document.elementsFromPoint"), true);
  assert.equal(content.includes("targetFromBounds"), true);
  assert.equal(content.includes("event.currentTarget?.querySelectorAll"), true);
  assert.equal(content.includes("selectionMode || !enableDoubleClickEdit"), true);
  assert.equal(content.includes("event.stopPropagation();"), true);
  assert.equal(content.includes("onFieldDoubleClick?.(field, event);"), true);
  assert.equal(content.includes("data-transaction-focus-target={segment.field}"), true);
  assert.equal(content.includes("onDoubleClick={(event) => handleFieldDoubleClick(segment.field, event)}"), true);
  assert.equal(content.includes("onDoubleClick={(event) => {"), true);
  assert.equal(content.includes("onMenuClick?.(event);"), true);
});
