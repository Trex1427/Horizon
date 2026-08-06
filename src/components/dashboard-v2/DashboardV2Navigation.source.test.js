import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const navigationPath = resolve(
  process.cwd(),
  "src/components/dashboard-v2/DashboardV2Navigation.jsx",
);

test("the V2 Plus button opens its own mobile bottom sheet", async () => {
  const navigation = await readFile(navigationPath, "utf8");

  assert.match(navigation, /const \[open, setOpen\] = useState\(false\)/);
  assert.match(navigation, /onClick=\{\(\) => setOpen\(true\)\}/);
  assert.match(navigation, /\{open && \(/);
  assert.match(navigation, /className="v2-sheet-backdrop"[\s\S]*?style=\{\{ display: "flex" \}\}/);
  assert.match(navigation, /id="v2-more-sheet"/);
});

test("the V2 bottom sheet keeps its existing close paths", async () => {
  const navigation = await readFile(navigationPath, "utf8");

  assert.match(navigation, /const closeSheet = \(\) => \{[\s\S]*?setOpen\(false\)/);
  assert.match(navigation, /event\.target === event\.currentTarget && closeSheet\(\)/);
  assert.match(navigation, /event\.key === "Escape" && closeSheet\(\)/);
  assert.match(navigation, /className="v2-sheet-close" onClick=\{closeSheet\}/);
  assert.match(navigation, /className="v2-sheet-dismiss" onClick=\{closeSheet\}/);
});
