import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const baseUrl = process.env.HORIZON_BASE_URL || "http://127.0.0.1:5173";
const pdfPath = process.env.HORIZON_REAL_PDF || "C:/Users/alext/Downloads/account-statement_2026-06-01_2026-07-15_fr-fr_d8c4ab.pdf";
const viewport = process.env.HORIZON_VIEWPORT || "desktop";
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const debugPort = Number(process.env.CHROME_DEBUG_PORT || 9223);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.json();
}

async function waitForJson(url, timeoutMs = 10000) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeoutMs) {
    try {
      return await requestJson(url);
    } catch (error) {
      lastError = error;
      await wait(250);
    }
  }
  throw lastError || new Error(`Timeout waiting for ${url}`);
}

function connectCdp(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  let nextId = 1;
  const pending = new Map();
  const events = [];

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) {
        reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else {
        resolve(message.result);
      }
      return;
    }
    events.push(message);
  });

  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => {
      resolve({
        events,
        send(method, params = {}) {
          const id = nextId++;
          socket.send(JSON.stringify({ id, method, params }));
          return new Promise((innerResolve, innerReject) => {
            pending.set(id, { resolve: innerResolve, reject: innerReject });
          });
        },
        close() {
          socket.close();
        },
      });
    });
    socket.addEventListener("error", () => reject(new Error("CDP websocket connection failed")));
  });
}

async function evaluate(client, expression, awaitPromise = true) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return result.result?.value;
}

async function waitFor(client, expression, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await evaluate(client, expression);
    if (value) {
      return value;
    }
    await wait(250);
  }
  throw new Error(`Timeout waiting for: ${expression}`);
}

function clickButtonScript(label) {
  return `(() => {
    const normalize = (value) => String(value || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
    const wanted = normalize(${JSON.stringify(label)});
    const buttons = Array.from(document.querySelectorAll("button"));
    const button = buttons.find((candidate) => normalize(candidate.textContent).includes(wanted) && !candidate.disabled);
    if (!button) return false;
    button.click();
    return true;
  })()`;
}

async function selectFirstAccountIfNeeded(client) {
  await evaluate(client, `(() => {
    const inputs = Array.from(document.querySelectorAll("input"));
    const account = inputs.find((input) => input.getAttribute("aria-invalid") !== "true" && input.value);
    if (account) return true;
    return false;
  })()`);
}

function collectSnapshotScript() {
  return `(() => {
    const text = document.body.innerText;
    const visibleRows = Array.from(document.querySelectorAll('[data-import-preview-row="true"]')).map((node) => node.innerText);
    const validationRows = Array.from(document.querySelectorAll('[data-import-validation-row="true"]')).map((node) => node.innerText);
    const duplicateRows = Array.from(document.querySelectorAll('[data-import-duplicate-row="true"]')).map((node) => node.innerText);
    const diagnostics = window.__horizonBankImportDiagnostics || [];
    const lastDiagnostic = diagnostics[diagnostics.length - 1] || null;
    return {
      title: document.title,
      url: location.href,
      hasFormatRevolut: text.includes("Format detecte : PDF Revolut") || text.includes("Format détecté : PDF Revolut"),
      hasPreviewText: text.includes("ligne(s) detectee(s)") || text.includes("ligne(s) détectée(s)"),
      hasValidationText: text.includes("Importer dans Firestore"),
      hasEnabledImportButton: Array.from(document.querySelectorAll("button")).some((button) => button.textContent.includes("Importer dans Firestore") && !button.disabled),
      visiblePreviewRows: visibleRows.length,
      visibleValidationRows: validationRows.length,
      visibleDuplicateRows: duplicateRows.length,
      bodyText: text.slice(0, 12000),
      diagnosticsCount: diagnostics.length,
      lastDiagnostic,
    };
  })()`;
}

async function main() {
  const userDataDir = mkdtempSync(join(tmpdir(), "horizon-cdp-"));
  const size = viewport === "android" ? "412,915" : "1440,1000";
  const chrome = spawn(chromePath, [
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${userDataDir}`,
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    `--window-size=${size}`,
    "about:blank",
  ], { stdio: "ignore", detached: true });

  try {
    await waitForJson(`http://127.0.0.1:${debugPort}/json/version`, 15000);
    const target = await requestJson(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(`${baseUrl}/transactions`)}`, { method: "PUT" });
    const client = await connectCdp(target.webSocketDebuggerUrl);
    const consoleEntries = [];

    await client.send("Runtime.enable");
    await client.send("Page.enable");
    await client.send("DOM.enable");
    if (viewport === "android") {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: 412,
        height: 915,
        deviceScaleFactor: 2.625,
        mobile: true,
      });
      await client.send("Emulation.setUserAgentOverride", {
        userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36",
      });
    }

    const eventPoll = setInterval(() => {
      let event = client.events.shift();
      while (event) {
        if (event.method === "Runtime.consoleAPICalled") {
          consoleEntries.push({
            type: event.params.type,
            args: event.params.args.map((arg) => arg.value ?? arg.description ?? arg.type),
          });
        }
        if (event.method === "Runtime.exceptionThrown") {
          consoleEntries.push({
            type: "exception",
            args: [event.params.exceptionDetails?.text || "exceptionThrown"],
          });
        }
        event = client.events.shift();
      }
    }, 50);

    await waitFor(client, "document.readyState === 'complete'");
    await waitFor(client, "document.body && document.body.innerText.length > 0");
    await waitFor(client, clickButtonScript("Importer"), 20000);
    await waitFor(client, "Boolean(document.querySelector('input[type=file]'))", 10000);
    const { root } = await client.send("DOM.getDocument");
    const { nodeId } = await client.send("DOM.querySelector", {
      nodeId: root.nodeId,
      selector: "input[type=file]",
    });
    await client.send("DOM.setFileInputFiles", {
      nodeId,
      files: [pdfPath],
    });

    await waitFor(client, "document.body.innerText.includes('PDF Revolut')", 20000);
    await waitFor(client, clickButtonScript("Continuer"), 10000);
    await selectFirstAccountIfNeeded(client);
    await waitFor(client, clickButtonScript("Previsualiser"), 10000);
    await waitFor(client, "document.body.innerText.includes('ligne(s)')", 20000);
    const previewSnapshot = await evaluate(client, collectSnapshotScript());
    await waitFor(client, clickButtonScript("Continuer"), 10000);
    await waitFor(client, clickButtonScript("Valider les lignes"), 10000);
    await waitFor(client, "document.body.innerText.includes('Importer dans Firestore')", 15000);
    const validationSnapshot = await evaluate(client, collectSnapshotScript());

    clearInterval(eventPoll);
    writeFileSync(`validation-real-revolut-${viewport}.json`, JSON.stringify({
      viewport,
      baseUrl,
      pdfPath,
      previewSnapshot,
      validationSnapshot,
      consoleEntries,
    }, null, 2));
    client.close();
  } finally {
    chrome.kill();
    try {
      rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore temporary profile cleanup failures
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
