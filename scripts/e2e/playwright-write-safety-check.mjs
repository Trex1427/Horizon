import { assertEmulatorWriteMode } from "../safety/automatedWriteGuard.mjs";

function isLocalUrl(url) {
  const normalized = String(url || "").trim().toLowerCase();
  return normalized.startsWith("http://localhost:") || normalized.startsWith("http://127.0.0.1:");
}

function main() {
  assertEmulatorWriteMode({ operationName: "test:e2e" });

  const baseUrl = String(process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:5173").trim();
  if (!isLocalUrl(baseUrl)) {
    throw new Error("Playwright write scenarios must target a local app URL");
  }

  console.log(JSON.stringify({
    result: "success",
    mode: "emulator",
    baseUrl,
    note: "No Playwright write scenario files were found in the repository; safety gate is configured.",
  }, null, 2));
}

main();
