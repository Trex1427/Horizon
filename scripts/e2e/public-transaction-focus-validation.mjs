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
const TARGETS = {
  description: "description",
  date: "date",
  amount: "montant",
  account: "accountId",
  category: "categorie",
  subcategory: "subcategoryId",
  thirdParty: "thirdPartyId",
  activity: "activityId",
  project: "projectId",
};

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
      if (response.ok) {
        return response.json();
      }
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
        if (page) {
          return page;
        }
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

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
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

async function waitFor(cdp, expression, label, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await evaluate(cdp, expression);
    if (value) {
      return value;
    }
    await delay(250);
  }
  const bodyText = await evaluate(cdp, "document.body?.innerText?.slice(0, 1000) || ''").catch(() => "");
  throw new Error(`Timed out waiting for ${label}. Page text: ${bodyText}`);
}

async function closeEditor(cdp) {
  await evaluate(cdp, `
    (() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return true;
      const buttons = [...dialog.querySelectorAll('button')];
      const cancel = buttons.find((button) => /annuler|fermer/i.test(button.textContent || button.getAttribute('aria-label') || ''));
      if (cancel) cancel.click();
      return true;
    })()
  `);
  await delay(250);
  await evaluate(cdp, `
    (() => {
      const dialogs = [...document.querySelectorAll('[role="dialog"]')];
      const confirm = dialogs.find((dialog) => /Fermer sans enregistrer/i.test(dialog.textContent || ''));
      if (!confirm) return true;
      const button = [...confirm.querySelectorAll('button')]
        .find((entry) => /Fermer sans enregistrer/i.test(entry.textContent || ''));
      if (button) button.click();
      return true;
    })()
  `);
  await delay(250);
  const startedAt = Date.now();
  while (Date.now() - startedAt < 3000) {
    const hasDialog = await evaluate(cdp, "Boolean(document.querySelector('[role=\"dialog\"]'))");
    if (!hasDialog) {
      return;
    }
    await delay(100);
  }
}

async function validateFocusedTarget(cdp, target, expectedName) {
  await closeEditor(cdp);
  const targetExists = await evaluate(cdp, `Boolean(document.querySelector('[data-transaction-focus-target="${target}"]'))`);
  if (!targetExists) {
    return { target, expectedName, skipped: true, reason: "no visible public transaction value for target" };
  }

  const point = await evaluate(cdp, `
    (() => {
      const element = document.querySelector('[data-transaction-focus-target="${target}"]');
      if (!element) throw new Error('missing target ${target}');
      const rect = element.getBoundingClientRect();
      return { x: rect.left + Math.min(6, Math.max(1, rect.width / 2)), y: rect.top + rect.height / 2 };
    })()
  `);
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 2 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 2 });
  await waitFor(cdp, "Boolean(document.querySelector('[role=\"dialog\"]'))", `dialog for ${target}`);
  let focused = "";
  const startedAt = Date.now();
  while (Date.now() - startedAt < 5000) {
    focused = await evaluate(cdp, `
      (() => {
        const active = document.activeElement;
        return active?.getAttribute?.('name') || active?.querySelector?.('[name]')?.getAttribute('name') || '';
      })()
    `);
    if (focused === expectedName) {
      break;
    }
    await delay(100);
  }
  if (focused !== expectedName) {
    const debug = await evaluate(cdp, `
      (() => ({
        activeTag: document.activeElement?.tagName || '',
        activeName: document.activeElement?.getAttribute?.('name') || '',
        activeRole: document.activeElement?.getAttribute?.('role') || '',
        activeHtml: document.activeElement?.outerHTML?.slice(0, 500) || '',
        dialogText: document.querySelector('[role="dialog"]')?.innerText?.slice(0, 500) || '',
        expectedExists: Boolean(document.querySelector('[name="${expectedName}"]'))
      }))()
    `);
    throw new Error(`Expected ${expectedName} focus for ${target}, got ${focused || "<none>"}. Debug: ${JSON.stringify(debug)}`);
  }

  return { target, expectedName, focused, skipped: false };
}

async function runViewportValidation(cdp, { width, height, mobile, label }) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: mobile ? 2 : 1,
    mobile,
  });
  await cdp.send("Page.navigate", { url: `${PUBLIC_URL}?focusValidation=${encodeURIComponent(label)}-${Date.now()}` });
  await waitFor(cdp, "document.readyState === 'complete'", `${label} page load`);
  await evaluate(cdp, `
    (() => {
      const item = [...document.querySelectorAll('button, a, [role="button"], [role="tab"]')]
        .find((element) => /transactions/i.test(element.textContent || element.getAttribute('aria-label') || ''));
      if (item) item.click();
      return Boolean(item);
    })()
  `);
  await waitFor(cdp, "Boolean(document.querySelector('[data-transaction-focus-target]'))", `${label} transaction targets`);

  const consoleErrors = await evaluate(cdp, "window.__focusValidationConsoleErrors || []");

  if (mobile) {
    const openedByDoubleClick = await evaluate(cdp, `
      (() => {
        const element = document.querySelector('[data-transaction-focus-target="description"]');
        element?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, view: window }));
        return Boolean(document.querySelector('[role="dialog"]'));
      })()
    `);
    if (openedByDoubleClick) {
      throw new Error(`${label} opened editor from targeted double-click.`);
    }
    return { label, checked: "mobile double-click blocked", consoleErrors };
  }

  const targetResults = [];
  for (const [target, expectedName] of Object.entries(TARGETS)) {
    targetResults.push(await validateFocusedTarget(cdp, target, expectedName));
  }

  await closeEditor(cdp);
  const generalDebug = await evaluate(cdp, `
    (() => {
      const target = document.querySelector('[data-transaction-focus-target]');
      const card = target?.closest('[role="button"]');
      return {
        target: target?.getAttribute('data-transaction-focus-target') || '',
        hasCard: Boolean(card),
        cardText: card?.innerText?.slice(0, 200) || '',
        tag: card?.tagName || '',
      };
    })()
  `);
  const generalPoint = await evaluate(cdp, `
    (() => {
      const card = document.querySelector('[data-transaction-focus-target]')?.closest('[role="button"]');
      if (!card) return null;
      const rect = card.getBoundingClientRect();
      return { x: rect.left + Math.min(24, rect.width / 2), y: rect.top + rect.height / 2 };
    })()
  `);
  if (!generalPoint) {
    throw new Error(`${label} general double-click could not find a card. Debug: ${JSON.stringify(generalDebug)}`);
  }
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: generalPoint.x, y: generalPoint.y });
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: generalPoint.x, y: generalPoint.y, button: "left", clickCount: 2 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: generalPoint.x, y: generalPoint.y, button: "left", clickCount: 2 });
  await delay(250);
  const generalOpened = await evaluate(cdp, "Boolean(document.querySelector('[role=\"dialog\"]'))");
  if (!generalOpened) {
    throw new Error(`${label} general double-click did not open editor. Debug: ${JSON.stringify(generalDebug)}`);
  }
  await closeEditor(cdp);

  return { label, checked: "visible focus targets", targetResults, consoleErrors };
}

async function main() {
  const chromePath = await findChromePath();
  const userDataDir = await mkdtemp(join(tmpdir(), "horizon-focus-validation-"));
  const port = 9223 + Math.floor(Math.random() * 1000);
  const browser = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "about:blank",
  ], { stdio: "ignore" });

  try {
    await waitForDebugEndpoint(port);
    const pageTarget = await waitForPageTarget(port);
    const cdp = connectCdp(pageTarget.webSocketDebuggerUrl);
    await cdp.open();
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    await cdp.send("Runtime.addBinding", { name: "noop" });
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        window.__focusValidationConsoleErrors = [];
        const originalError = console.error;
        console.error = (...args) => {
          window.__focusValidationConsoleErrors.push(args.map(String).join(' '));
          originalError.apply(console, args);
        };
      `,
    });

    const results = [];
    results.push(await runViewportValidation(cdp, { width: 1365, height: 900, mobile: false, label: "desktop" }));
    results.push(await runViewportValidation(cdp, { width: 820, height: 1180, mobile: false, label: "tablet" }));
    results.push(await runViewportValidation(cdp, { width: 390, height: 844, mobile: true, label: "android" }));

    await cdp.send("Browser.close");
    cdp.close();

    console.log(JSON.stringify({
      url: PUBLIC_URL,
      results,
      verdict: "PUBLIC TRANSACTION FOCUS VALIDATION PASSED",
    }, null, 2));
  } finally {
    if (!browser.killed) {
      browser.kill();
    }
    await delay(500);
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch((error) => {
  console.error("public transaction focus validation failed");
  console.error(error?.stack || error?.message || String(error));
  process.exitCode = 1;
});
