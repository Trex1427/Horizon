import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const componentPath = resolve(process.cwd(), "src/components/ReferentialPilotDrawer.jsx");

test("ReferentialPilotDrawer uses Drawer on desktop and BottomSheet on mobile", async () => {
  const content = await readFile(componentPath, "utf8");

  assert.equal(content.includes("AppDrawer"), true);
  assert.equal(content.includes("sections={["), true);
  assert.equal(content.includes("Navigation croisée"), false);
  assert.equal(content.includes("Ouvrir"), true);
  assert.equal(content.includes("Modifier"), true);
  assert.equal(content.includes("Supprimer"), true);
});

test("ReferentialPilotDrawer exposes statistics, relations and administration tools", async () => {
  const content = await readFile(componentPath, "utf8");

  for (const label of ["Informations", "Statistiques", "Relations", "Transactions", "Historique", "Fusionner", "Remplacer par...", "Renommer", "Désactiver", "Réactiver"]) {
    assert.equal(content.includes(label), true, label);
  }
  assert.equal(content.includes("Montant total"), true);
  assert.equal(content.includes("Montant moyen"), true);
  assert.equal(content.includes("Mois concernés"), true);
});
