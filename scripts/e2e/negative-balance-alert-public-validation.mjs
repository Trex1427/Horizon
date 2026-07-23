import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PUBLIC_URL = "https://budget-alexandre.web.app";
const EXPECTED_BUNDLE = "index-BD4qVLqv.js";
const CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];
const VIEWPORTS = [
  { label: "desktop", width: 1365, height: 900, mobile: false },
  { label: "tablet", width: 820, height: 1180, mobile: false },
  { label: "android", width: 390, height: 844, mobile: true },
];
const MODES = ["Certaine", "Realiste", "Optimiste"];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findChromePath() {
  const { access } = await import("node:fs/promises");
  for (const path of CHROME_PATHS) {
    try {
      await access(path);
      return path;
    } catch {
      // Try the next known browser path.
    }
  }
  throw new Error("No Chrome or Edge executable found.");
}

async function waitForDebugEndpoint(port) {
  const endpoint = `http://127.0.0.1:${port}/json/version`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) return response.json();
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }
  throw new Error("Chrome DevTools endpoint did not start.");
}

async function waitForPageTarget(port) {
  const endpoint = `http://127.0.0.1:${port}/json/list`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
        if (page) return page;
      }
    } catch {
      // Chrome is still preparing targets.
    }
    await delay(100);
  }
  throw new Error("Chrome page target did not start.");
}

function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();
  const events = [];

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method) events.push(message);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) {
      reject(new Error(message.error.message || JSON.stringify(message.error)));
      return;
    }
    resolve(message.result);
  });

  return {
    async open() {
      await new Promise((resolve, reject) => {
        socket.addEventListener("open", resolve, { once: true });
        socket.addEventListener("error", reject, { once: true });
      });
    },
    send(method, params = {}) {
      const id = nextId;
      nextId += 1;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close() {
      socket.close();
    },
    events,
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "Runtime evaluation failed.");
  }
  return result.result.value;
}

async function waitFor(cdp, expression, label, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await evaluate(cdp, expression);
    if (value) return value;
    await delay(250);
  }
  const bodyText = await evaluate(cdp, "document.body?.innerText?.slice(0, 1200) || ''").catch(() => "");
  throw new Error(`Timed out waiting for ${label}. Page text: ${bodyText}`);
}

async function clickElement(cdp, expression, label) {
  const point = await evaluate(cdp, `
    (() => {
      const element = ${expression};
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()
  `);
  if (!point) throw new Error(`Unable to click ${label}.`);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}

async function selectMode(cdp, mode) {
  await clickElement(
    cdp,
    `[...document.querySelectorAll('[role="combobox"]')].find((element) => /Certaine|Realiste|Réaliste|Optimiste/i.test(element.textContent || ''))`,
    "forecast mode combobox"
  );
  await waitFor(cdp, "Boolean(document.querySelector('[role=\"listbox\"]'))", "forecast mode listbox");
  await clickElement(
    cdp,
    `[...document.querySelectorAll('[role="option"]')].find((element) => new RegExp('${mode}|${mode.replace("e", "é")}', 'i').test(element.textContent || ''))`,
    `forecast mode ${mode}`
  );
  await delay(750);
}

async function collectCockpitState(cdp, mode) {
  return evaluate(cdp, `
    (() => {
      const text = document.body.innerText || "";
      const risk = text.includes("Risque de solde negatif") || text.includes("Risque de solde négatif");
      const noRisk = text.includes("Aucun solde negatif prevu") || text.includes("Aucun solde négatif prévu");
      const monthMatch = text.match(/Premier mois concern(?:e|é)\\s*:\\s*([^\\n]+)/i);
      const balanceMatch = text.match(/Solde previsionnel\\s*:\\s*([^\\n]+)/i) || text.match(/Solde prévisionnel\\s*:\\s*([^\\n]+)/i);
      const decemberMatch = text.match(/Solde au 31 decembre\\s*:\\s*([^\\n]+)/i) || text.match(/Solde au 31 décembre\\s*:\\s*([^\\n]+)/i);
      const visibleMode = (text.match(/Prevision\\s*:\\s*([^\\n]+)/i) || text.match(/Prévision\\s*:\\s*([^\\n]+)/i) || [])[1] || "";
      return {
        mode: "${mode}",
        risk,
        noRisk,
        firstNegativeMonth: monthMatch?.[1]?.trim() || null,
        projectedBalance: balanceMatch?.[1]?.trim() || null,
        decemberBalance: decemberMatch?.[1]?.trim() || null,
        visibleMode: visibleMode.trim(),
        hasTrajectory: text.includes("Trajectoire annuelle"),
        hasInvalidValue: /NaN|undefined|Infinity/.test(text),
      };
    })()
  `);
}

async function validateViewport(cdp, viewport) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.mobile ? 2 : 1,
    mobile: viewport.mobile,
  });
  await cdp.send("Page.navigate", { url: `${PUBLIC_URL}?negativeBalanceValidation=${viewport.label}-${Date.now()}` });
  await waitFor(cdp, "document.readyState === 'complete'", `${viewport.label} page load`);
  await waitFor(cdp, "document.body.innerText.includes('Trajectoire annuelle')", `${viewport.label} cockpit trajectory`);

  const loadedAssets = await evaluate(cdp, "performance.getEntriesByType('resource').map((entry) => entry.name)");
  const bundleLoaded = loadedAssets.some((entry) => entry.includes(EXPECTED_BUNDLE));
  const states = [];
  for (const mode of MODES) {
    await selectMode(cdp, mode);
    const state = await collectCockpitState(cdp, mode);
    if (!state.hasTrajectory) throw new Error(`${viewport.label}/${mode}: trajectory missing.`);
    if (state.hasInvalidValue) throw new Error(`${viewport.label}/${mode}: invalid numeric value displayed.`);
    if (!state.risk && !state.noRisk) throw new Error(`${viewport.label}/${mode}: neither risk nor no-risk state visible.`);
    states.push(state);
  }

  return {
    viewport: viewport.label,
    width: viewport.width,
    height: viewport.height,
    bundleLoaded,
    states,
  };
}

async function main() {
  const chromePath = await findChromePath();
  const userDataDir = await mkdtemp(join(tmpdir(), "horizon-negative-balance-validation-"));
  const port = 9600 + Math.floor(Math.random() * 1000);
  const browser = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-cache",
    "about:blank",
  ], { stdio: "ignore" });

  try {
    await waitForDebugEndpoint(port);
    const pageTarget = await waitForPageTarget(port);
    const cdp = connectCdp(pageTarget.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Log.enable");

    const results = [];
    for (const viewport of VIEWPORTS) {
      results.push(await validateViewport(cdp, viewport));
    }

    const consoleIssues = cdp.events
      .filter((event) => event.method === "Runtime.consoleAPICalled" || event.method === "Log.entryAdded")
      .filter((event) => {
        const type = event.params?.type || event.params?.entry?.level || "";
        return ["error", "warning"].includes(type);
      })
      .map((event) => event.params?.args?.map((arg) => arg.value || arg.description).join(" ") || event.params?.entry?.text || "")
      .filter((message) => !/favicon|manifest|workbox|large_barrel/i.test(message));

    const allBundlesLoaded = results.every((result) => result.bundleLoaded);
    const anyRisk = results.flatMap((result) => result.states).find((state) => state.risk);

    await cdp.send("Browser.close");
    cdp.close();

    if (!allBundlesLoaded) throw new Error(`Expected bundle ${EXPECTED_BUNDLE} was not loaded in every viewport.`);
    if (consoleIssues.length > 0) throw new Error(`Console issues found: ${consoleIssues.join(" | ")}`);

    console.log(JSON.stringify({
      url: PUBLIC_URL,
      expectedBundle: EXPECTED_BUNDLE,
      results,
      productionFirstNegativeMonth: anyRisk?.firstNegativeMonth || null,
      productionProjectedBalance: anyRisk?.projectedBalance || null,
      consoleIssues,
      verdict: "NEGATIVE BALANCE ALERT PUBLIC VALIDATION PASSED",
    }, null, 2));
  } finally {
    if (!browser.killed) browser.kill();
    await delay(500);
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error("negative balance alert public validation failed");
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
