import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const entityDialogPath = resolve(process.cwd(), "src/components/EntityDialog.jsx");

test("EntityDialog supports unsaved changes confirmation and keyboard shortcuts", async () => {
  const content = await readFile(entityDialogPath, "utf8");

  assert.equal(content.includes("Fermer sans enregistrer ?"), true);
  assert.equal(content.includes('event.key === "Escape"'), true);
  assert.equal(content.includes('event.key === "Enter"'), true);
});

test("EntityDialog exposes a close control and loading state", async () => {
  const content = await readFile(entityDialogPath, "utf8");

  assert.equal(content.includes('aria-label="Fermer"'), true);
  assert.equal(content.includes("LinearProgress"), true);
});

test("EntityDialog reapplies targeted focus after the opening transition", async () => {
  const content = await readFile(entityDialogPath, "utf8");
  const normalizedContent = content.replace(/\s+/g, " ");
  const transitionFocusConfiguration = /slotProps=\{\{\s*transition:\s*\{\s*onEntered:\s*\(\)\s*=>\s*\{\s*if\s*\(!useFullScreen\)\s*\{\s*focusFirstElement\(contentRef\.current,\s*autoFocusSelector\);\s*\}\s*\},?\s*\},?\s*\}\}/;

  assert.equal(content.includes("TransitionProps"), false);
  assert.match(normalizedContent, transitionFocusConfiguration);
});

test("EntityDialog preserves scroll and adapts to mobile landscape", async () => {
  const content = await readFile(entityDialogPath, "utf8");

  assert.equal(content.includes("window.scrollTo({ top: nextScrollPosition, behavior: \"auto\" })"), true);
  assert.equal(content.includes("(max-height:600px)"), true);
  assert.equal(content.includes("100dvh"), true);
});
