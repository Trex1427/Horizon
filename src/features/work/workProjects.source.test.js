import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("dossier creation is transactional, deterministic and links the accepted quote", async () => {
  const service = await readFile(resolve(process.cwd(), "src/services/workProjectsService.js"), "utf8");
  assert.equal(service.includes('const PROJECTS = "workProjects"'), true);
  assert.equal(service.includes("runTransaction"), true);
  assert.equal(service.includes("doc(db, PROJECTS, quote.id)"), true);
  assert.equal(service.includes('currentQuote.status !== "accepted"'), true);
  assert.equal(service.includes("currentQuote.projectId"), true);
  assert.equal(service.includes("transaction.update(quoteRef, { projectId: projectRef.id"), true);
});

test("only accepted quote cards expose dossier creation or access", async () => {
  const source = await readFile(resolve(process.cwd(), "src/pages/Travail.jsx"), "utf8");
  assert.equal(source.includes('quote.status === "accepted" && <Button'), true);
  assert.equal(source.includes('"Créer le dossier"'), true);
  assert.equal(source.includes('"Ouvrir le dossier"'), true);
  assert.equal(source.includes("<WorkProjectsSection"), true);
  assert.equal(source.includes("<WorkDashboard"), true);
});
