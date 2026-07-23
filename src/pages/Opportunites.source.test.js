import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const pagePath = resolve(process.cwd(), "src/pages/Opportunites.jsx");
const cardPath = resolve(process.cwd(), "src/components/OpportunityCard.jsx");
const cockpitPath = resolve(process.cwd(), "src/components/HorizonCockpit.jsx");

test("Opportunites wires existing reference hooks to OpportunityForm quick-create callbacks", async () => {
  const content = await readFile(pagePath, "utf8");

  assert.equal(content.includes("const { thirdParties, addThirdParty } = useThirdParties"), true);
  assert.equal(content.includes("const { activities, addActivity } = useActivities"), true);
  assert.equal(content.includes("const { projects, addProject } = useProjects"), true);
  assert.equal(content.includes("onRequestCreateThirdParty={addThirdParty}"), true);
  assert.equal(content.includes("onRequestCreateActivity={addActivity}"), true);
  assert.equal(content.includes("onRequestCreateProject={addProject}"), true);
});

test("OpportunityCard does not display probability and shows forecast inclusion", async () => {
  const content = await readFile(cardPath, "utf8");

  assert.equal(content.includes("probability"), false);
  assert.equal(content.includes("Incluse dans la prévision"), true);
  assert.equal(content.includes("Non incluse"), true);
});

test("HorizonCockpit no longer exposes forecast mode or probability threshold controls", async () => {
  const content = await readFile(cockpitPath, "utf8");

  assert.equal(content.includes("forecast-mode-label"), false);
  assert.equal(content.includes("Seuil realiste"), false);
  assert.equal(content.includes("Mode :"), false);
  assert.equal(content.includes("Opportunités prévues"), true);
});
