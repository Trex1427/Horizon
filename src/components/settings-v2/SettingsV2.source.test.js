import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const component = resolve(process.cwd(), "src/components/settings-v2/SettingsV2.jsx");
const cssPath = resolve(process.cwd(), "src/components/settings-v2/SettingsV2.css");

test("SettingsV2 exposes V2 settings capabilities with secure maintenance reset", async () => {
	const source = await readFile(component, "utf8");
	for (const contract of [
		"exportHorizonDataPlaceholder",
		"importHorizonBackupPlaceholder",
		"resetHorizonData",
		"Historique des imports",
		"Se déconnecter",
		"Maintenance",
		"SUPPRIMER",
		"__APP_VERSION__",
		"__BUILD_DATE__",
		"__APP_ENV__",
	]) {
		assert.match(source, new RegExp(contract));
	}
	assert.doesNotMatch(source, /firebase|firestore|collection\(|setDoc|addDoc/);
});

test("SettingsV2 delivers responsive and accessible V2 settings center", async () => {
	const [source, css] = await Promise.all([readFile(component, "utf8"), readFile(cssPath, "utf8")]);
	for (const label of [
		"Configuration",
		"Paramètres",
		"Import / Export",
		"Sécurité",
		"À propos",
		"Rechercher un paramètre",
	]) {
		assert.match(source, new RegExp(label));
	}
	assert.match(source, /aria-expanded/);
	assert.match(css, /max-width:700px/);
	assert.match(css, /prefers-reduced-motion/);
	assert.doesNotMatch(css, /overflow-x:\s*(auto|scroll)/);
});
