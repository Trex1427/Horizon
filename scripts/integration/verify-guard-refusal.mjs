import { spawnSync } from "node:child_process";

function main() {
  const env = { ...process.env };
  delete env.FIRESTORE_EMULATOR_HOST;
  delete env.USE_FIRESTORE_EMULATOR;
  delete env.VITE_USE_FIRESTORE_EMULATOR;

  const result = spawnSync(process.execPath, ["scripts/seed-demo-data.mjs", "--confirm-run"], {
    cwd: process.cwd(),
    env,
    encoding: "utf8",
  });

  const combinedOutput = `${result.stdout || ""}\n${result.stderr || ""}`;
  const refused = combinedOutput.includes("OPÉRATION AUTOMATISÉE REFUSÉE")
    && combinedOutput.includes("Le projet budget-alexandre est protégé.")
    && combinedOutput.includes("Utilisez Firestore Emulator.");

  if (!refused) {
    console.error("GUARD_REFUSAL_CHECK_FAILED");
    console.error(combinedOutput);
    process.exit(1);
  }

  console.log(JSON.stringify({
    result: "success",
    refused: true,
    exitCode: result.status,
  }, null, 2));
}

main();
