import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("navigation exposes and renders Dettes et créances without global loading", async () => {
  const app = await readFile(resolve(process.cwd(), "src/App.jsx"), "utf8");
  assert.match(app, /DETTES_CREANCES/);
  assert.match(app, /label: "Dettes et créances"/);
  assert.match(app, /<DettesCreances \/>/);
  assert.equal(app.includes("useDebtsReceivables"), false);
});
test("page presents summaries, CRUD actions, empty state and confirmation", async () => {
  const page = await readFile(resolve(process.cwd(), "src/pages/DettesCreances.jsx"), "utf8");
  for (const label of ["Dettes ouvertes", "Créances ouvertes", "Solde net indicatif", "Modifier", "Supprimer", "Aucune dette ni créance ouverte"]) {
    assert.ok(page.includes(label), `missing ${label}`);
  }
  assert.ok(page.includes("Tiers:"), "missing third-party display");
  assert.ok(page.includes("compatibilité legacy"), "missing legacy compatibility fallback");
  assert.ok(page.includes("introuvable ou supprimé"), "missing missing-third-party fallback");
  assert.equal(page.includes("{item.thirdPartyId}"), false, "must not render raw thirdPartyId");
  assert.match(page, /Cette suppression est logique/);
});
