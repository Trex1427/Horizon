import { spawnSync } from "node:child_process";

function runStep(args, label) {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: { ...process.env },
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`${label} failed\n${result.stdout || ""}\n${result.stderr || ""}`);
  }

  return {
    label,
    stdout: String(result.stdout || "").trim(),
  };
}

function main() {
  const steps = [];
  steps.push(runStep(["scripts/seed-test-emulator-data.mjs"], "seed"));
  steps.push(runStep(["scripts/integration/local-app-read-emulator.mjs"], "local-read"));

  console.log(JSON.stringify({
    result: "success",
    steps: steps.map((step) => step.label),
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error("SEED_AND_LOCAL_READ_CHECK_FAILED");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
}
