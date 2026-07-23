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
const EXPECTED_BUNDLE = "index-B7S3sSvt.js";
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
      // Try next browser.
    }
  }
  throw new Error("No Chrome or Edge executable found.");
}

async function waitForPageTarget(port) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === "page" && target.webSocketDebuggerUrl);
        if (page) return page;
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
      consoleMessages.push({ type: message.params.entry.level, text: message.params.entry.text });
    }
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
  };
}

async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
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

async function openImportWizard(cdp, viewport) {
  await cdp.send("Emulation.setDeviceMetricsOverride", viewport);
  await cdp.send("Page.navigate", { url: `${PUBLIC_URL}?bankingImportUxValidation=${viewport.name}-${Date.now()}` });
  await waitFor(cdp, "document.readyState === 'complete'", `${viewport.name} load`);
  await waitFor(cdp, "/Transactions/i.test(document.body?.innerText || '')", `${viewport.name} app shell`);

  await evaluate(cdp, `
    (() => {
      const nav = [...document.querySelectorAll('button, a, [role="tab"], [role="button"]')]
        .find((entry) => /^Transactions$/i.test((entry.textContent || '').trim()));
      nav?.click();
      return true;
    })()
  `);
  await waitFor(cdp, "/Ajouter une transaction|Recherche rapide/i.test(document.body?.innerText || '')", `${viewport.name} transactions page`);

  await evaluate(cdp, `
    (() => {
      const actionButton = [...document.querySelectorAll('button')]
        .find((entry) => /Actions secondaires/i.test(entry.getAttribute('aria-label') || ''));
      if (!actionButton) throw new Error('secondary actions button missing');
      actionButton.click();
      return true;
    })()
  `);
  await waitFor(cdp, "/Importer un releve bancaire|Importer un relev/i.test(document.body?.innerText || '')", `${viewport.name} import menu`);
  await evaluate(cdp, `
    (() => {
      const item = [...document.querySelectorAll('[role="menuitem"], li, button')]
        .find((entry) => /Importer un releve bancaire|Importer un relev/i.test(entry.textContent || ''));
      if (!item) throw new Error('import menu item missing');
      item.click();
      return true;
    })()
  `);
  await waitFor(cdp, "/Importer un releve bancaire|Choisir un fichier/i.test(document.body?.innerText || '')", `${viewport.name} import wizard`);
}

async function validateViewport(cdp, viewport) {
  await openImportWizard(cdp, viewport);
  const result = await evaluate(cdp, `
    (() => {
      const text = document.body.innerText || '';
      const required = [/Fichier/i, /Compte/i, /Lignes/i, /Suggestions/i, /Doublons/i, /Importables/i, /Mapping/i, /Preview/i, /Validation/i, /Choisir un fichier/i];
      const missing = required.filter((pattern) => !pattern.test(text)).map((pattern) => String(pattern));
      const sticky = [...document.querySelectorAll('*')].some((entry) => getComputedStyle(entry).position === 'sticky' && /lignes|importables|a verifier|retour|importer/i.test(entry.innerText || ''));
      const badText = /NaN|Infinity|undefined/.test(text);
      const overflow = document.documentElement.scrollWidth - window.innerWidth;
      const resources = performance.getEntriesByType('resource').map((entry) => entry.name);
      return {
        missing,
        sticky,
        badText,
        overflow,
        bundleLoaded: resources.some((name) => name.includes('${EXPECTED_BUNDLE}')),
      };
    })()
  `);
  if (result.missing.length) throw new Error(`${viewport.name}: missing labels ${result.missing.join(", ")}`);
  if (!result.sticky) throw new Error(`${viewport.name}: sticky action bar not detected`);
  if (result.badText) throw new Error(`${viewport.name}: visible NaN/Infinity/undefined detected`);
  if (result.overflow > 2) throw new Error(`${viewport.name}: horizontal overflow ${result.overflow}px`);
  if (!result.bundleLoaded) throw new Error(`${viewport.name}: expected bundle ${EXPECTED_BUNDLE} not loaded`);
  return result;
}

async function main() {
  const response = await fetch(PUBLIC_URL, { cache: "no-store" });
  if (response.status !== 200) throw new Error(`Public URL returned HTTP ${response.status}`);
  const html = await response.text();
  if (!html.includes(EXPECTED_BUNDLE)) throw new Error(`Public HTML does not reference ${EXPECTED_BUNDLE}`);

  const chromePath = await findChromePath();
  const userDataDir = await mkdtemp(join(tmpdir(), "horizon-import-ux-"));
  const port = 9828 + Math.floor(Math.random() * 500);
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
      validations.push({ viewport: viewport.name, ...(await validateViewport(cdp, viewport)) });
    }

    const blockingConsole = consoleMessages.filter((entry) => ["error", "warning"].includes(entry.type));
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
