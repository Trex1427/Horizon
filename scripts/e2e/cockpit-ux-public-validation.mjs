import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
];

const PUBLIC_URL = "https://budget-alexandre.web.app";
const EXPECTED_BUNDLE = "index-Drchcyvo.js";
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false },
  { name: "tablet", width: 820, height: 1180, deviceScaleFactor: 1, mobile: false },
  { name: "android", width: 390, height: 844, deviceScaleFactor: 2, mobile: true },
];

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
      // Try the next browser path.
    }
  }
  throw new Error("No Chrome or Edge executable found.");
}

async function waitForPageTarget(port) {
  const endpoint = `http://127.0.0.1:${port}/json/list`;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
        if (page) {
          return page;
        }
      }
    } catch {
      // Chrome is still starting.
    }
    await delay(100);
  }
  throw new Error("Chrome page target did not start.");
}

function connectCdp(webSocketDebuggerUrl, consoleMessages) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.consoleAPICalled") {
      consoleMessages.push({
        type: message.params.type,
        text: message.params.args?.map((arg) => arg.value || arg.description || "").join(" "),
      });
    }
    if (message.method === "Log.entryAdded") {
      consoleMessages.push({
        type: message.params.entry.level,
        text: message.params.entry.text,
      });
    }
    if (!message.id || !pending.has(message.id)) {
      return;
    }

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
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(
      result.exceptionDetails.exception?.description
        || result.exceptionDetails.exception?.value
        || result.exceptionDetails.text
        || "Runtime evaluation failed."
    );
  }
  return result.result.value;
}

async function waitFor(cdp, expression, label, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await evaluate(cdp, expression);
    if (value) {
      return value;
    }
    await delay(250);
  }
  const bodyText = await evaluate(cdp, "document.body?.innerText?.slice(0, 1200) || ''").catch(() => "");
  throw new Error(`Timed out waiting for ${label}. Page text: ${bodyText}`);
}

async function validateViewport(cdp, viewport) {
  await cdp.send("Emulation.setDeviceMetricsOverride", viewport);
  await cdp.send("Page.navigate", { url: `${PUBLIC_URL}?cockpitUxValidation=${viewport.name}-${Date.now()}` });
  await waitFor(cdp, "document.readyState === 'complete'", `${viewport.name} load`);
  await waitFor(cdp, "/solde actuel/i.test(document.body?.innerText || '')", `${viewport.name} Solde actuel`);

  const result = await evaluate(cdp, `
    (() => {
      const text = document.body.innerText || '';
      const checks = [
        { label: 'Solde actuel', pattern: /solde actuel/i },
        { label: 'Reste a vivre', pattern: /reste a vivre/i },
        { label: 'Fin d\\'annee', pattern: /fin d['’]annee/i },
        { label: 'Trajectoire', pattern: /trajectoire/i },
        { label: 'Opportunites', pattern: /opportunites/i },
        { label: 'Alertes', pattern: /alertes/i },
      ];
      const missing = checks.filter((check) => !check.pattern.test(text)).map((check) => check.label);
      const badText = /NaN|Infinity|undefined/.test(text);
      const meter = document.querySelector('[role="meter"]');
      const overflow = document.documentElement.scrollWidth - window.innerWidth;
      const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
      return {
        missing,
        badText,
        hasMeter: Boolean(meter),
        overflow,
        bundleLoaded: resources.some((name) => name.includes('${EXPECTED_BUNDLE}')),
      };
    })()
  `);

  if (result.missing.length) {
    throw new Error(`${viewport.name}: missing cockpit labels ${result.missing.join(", ")}`);
  }
  if (result.badText) {
    throw new Error(`${viewport.name}: visible NaN/Infinity/undefined detected`);
  }
  if (!result.hasMeter) {
    throw new Error(`${viewport.name}: remaining gauge meter not found`);
  }
  if (result.overflow > 2) {
    throw new Error(`${viewport.name}: horizontal overflow ${result.overflow}px`);
  }
  if (!result.bundleLoaded) {
    throw new Error(`${viewport.name}: expected bundle ${EXPECTED_BUNDLE} not loaded`);
  }

  return { viewport: viewport.name, ...result };
}

async function main() {
  const response = await fetch(PUBLIC_URL, { cache: "no-store" });
  if (response.status !== 200) {
    throw new Error(`Public URL returned HTTP ${response.status}`);
  }
  const html = await response.text();
  if (!html.includes(EXPECTED_BUNDLE)) {
    throw new Error(`Public HTML does not reference ${EXPECTED_BUNDLE}`);
  }

  const chromePath = await findChromePath();
  const userDataDir = await mkdtemp(join(tmpdir(), "horizon-cockpit-ux-"));
  const port = 9228 + Math.floor(Math.random() * 500);
  const chrome = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--disable-gpu",
    "--no-first-run",
    "about:blank",
  ], { stdio: "ignore" });

  const consoleMessages = [];
  let cdp;
  try {
    const page = await waitForPageTarget(port);
    cdp = connectCdp(page.webSocketDebuggerUrl, consoleMessages);
    await cdp.open();
    await cdp.send("Runtime.enable");
    await cdp.send("Log.enable");
    await cdp.send("Page.enable");

    const validations = [];
    for (const viewport of VIEWPORTS) {
      validations.push(await validateViewport(cdp, viewport));
    }

    const blockingConsole = consoleMessages.filter((entry) => {
      const text = entry.text || "";
      if (/Download the React DevTools/i.test(text)) return false;
      if (/Module "node:zlib" has been externalized/i.test(text)) return false;
      return ["error", "warning"].includes(entry.type);
    });
    if (blockingConsole.length) {
      throw new Error(`Console issues detected: ${JSON.stringify(blockingConsole.slice(0, 8), null, 2)}`);
    }

    console.log(JSON.stringify({
      publicUrl: PUBLIC_URL,
      status: response.status,
      expectedBundle: EXPECTED_BUNDLE,
      validations,
      consoleIssues: blockingConsole.length,
    }, null, 2));
  } finally {
    cdp?.close();
    chrome.kill();
    await delay(500);
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
