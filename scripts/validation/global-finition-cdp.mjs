import { mkdirSync, writeFileSync } from "node:fs";

const CDP_ROOT = "http://127.0.0.1:9223";
const TARGET_URL = "https://budget-alexandre.web.app";
const ARTIFACT_DIR = "artifacts";

mkdirSync(ARTIFACT_DIR, { recursive: true });

let sequence = 0;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function newPage() {
  const response = await fetch(`${CDP_ROOT}/json/new?about:blank`, { method: "PUT" });
  const target = await response.json();
  const websocket = new WebSocket(target.webSocketDebuggerUrl);
  const pending = new Map();
  const events = [];

  websocket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
      return;
    }
    events.push(message);
  };

  await new Promise((resolve) => {
    websocket.onopen = resolve;
  });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, (message) => {
        if (message.error) {
          reject(new Error(`${method}: ${JSON.stringify(message.error)}`));
          return;
        }
        resolve(message.result);
      });
      websocket.send(JSON.stringify({ id, method, params }));
    });
  }

  return { websocket, send, events };
}

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  return result.result.value;
}

async function setup(send, width, height, mobile = false) {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: mobile ? 3 : 1,
    mobile,
  });
  await send("Page.navigate", { url: TARGET_URL });
  await wait(6500);
}

async function screenshot(send, name) {
  const result = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(`${ARTIFACT_DIR}/${name}`, Buffer.from(result.data, "base64"));
}

async function clickText(send, text) {
  return evaluate(send, `(() => {
    const target = ${JSON.stringify(text)};
    const elements = [...document.querySelectorAll("button, [role='button'], .MuiBottomNavigationAction-root, .MuiListItemButton-root")];
    const visible = (node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const element = elements.find((node) => visible(node) && (node.innerText || node.textContent || node.getAttribute("aria-label") || "").includes(target));
    if (!element) return false;
    element.click();
    return true;
  })()`);
}

async function openPage(send, pageLabel, mobile = false) {
  if (mobile && !["Accueil", "Transactions", "Budgets"].includes(pageLabel)) {
    await clickText(send, "Plus");
    await wait(400);
  }
  let clicked = await clickText(send, pageLabel);
  if (!clicked && pageLabel === "Historique des imports") {
    clicked = await clickText(send, "Historique");
  }
  await wait(1600);
  return clicked;
}

async function inspectPage(send, expectedText = "") {
  const expectedCheck = expectedText ? `text.includes(${JSON.stringify(expectedText)})` : "true";
  return evaluate(send, `(() => {
    const text = document.body.innerText || "";
    const buttons = [...document.querySelectorAll("button, [role='button']")];
    const unnamedButtons = buttons.filter((button) => {
      const visible = button.getBoundingClientRect().width > 0 && button.getBoundingClientRect().height > 0;
      const hasName = Boolean((button.innerText || button.textContent || button.getAttribute("aria-label") || "").trim());
      return visible && !hasName;
    });
    return {
      hasExpectedText: ${expectedCheck},
      horizontalOverflow: document.body.scrollWidth > window.innerWidth + 2,
      hasHorizon: text.includes("HORIZON"),
      hasButtonNameIssue: unnamedButtons.length > 0,
      buttonNameIssueCount: unnamedButtons.length,
      buttonNameIssueSample: unnamedButtons.slice(0, 3).map((button) => ({
        className: String(button.className || ""),
        ariaLabel: button.getAttribute("aria-label") || "",
        title: button.getAttribute("title") || "",
        html: button.outerHTML.slice(0, 260),
      })),
      bodySample: text.slice(0, 160),
    };
  })()`);
}

async function inspectPwa(send) {
  return evaluate(send, `Promise.resolve((async () => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    const manifestUrl = manifestLink ? new URL(manifestLink.getAttribute("href"), location.href).href : "";
    let manifest = null;
    if (manifestUrl) {
      manifest = await fetch(manifestUrl).then((response) => response.json()).catch(() => null);
    }
    const registration = navigator.serviceWorker ? await navigator.serviceWorker.getRegistration().catch(() => null) : null;
    return {
      hasManifest: Boolean(manifest),
      manifestName: manifest?.name || manifest?.short_name || "",
      hasServiceWorker: Boolean(registration),
      controlled: Boolean(navigator.serviceWorker?.controller),
    };
  })())`);
}

function getSevereEvents(events) {
  return events
    .filter((event) => (
      event.method === "Runtime.exceptionThrown"
      || (event.method === "Log.entryAdded" && ["error"].includes(event.params?.entry?.level))
    ))
    .map((event) => event.params);
}

async function runViewport(name, width, height, mobile = false) {
  const { websocket, send, events } = await newPage();
  await setup(send, width, height, mobile);

  const pages = [
    ["Accueil", "HORIZON"],
    ["Transactions", "Transactions"],
    ["Budgets", "Budgets"],
    ["Objectifs", "Objectifs"],
    ["Prévisions", "Prévisions"],
    ["Analyse", "Analyse"],
    ["Catégories", "Catégories"],
    ["Référentiels", "Référentiels"],
    ["Frais fixes", "Frais fixes"],
    ["Revenus récurrents", "Revenus"],
    ["Opportunités", "Opportunités"],
    ["Historique des imports", "Historique des imports"],
    ["Paramètres", "Paramètres"],
  ];

  const result = { name, pages: {} };
  for (const [label, expected] of pages) {
    await send("Page.navigate", { url: TARGET_URL });
    await wait(1800);
    const open = label === "Accueil" ? true : await openPage(send, label, mobile);
    const inspected = await inspectPage(send, expected);
    result.pages[label] = { open, ...inspected };
  }

  await screenshot(send, `validation-global-${name}.png`);
  result.pwa = await inspectPwa(send);
  const severe = getSevereEvents(events);
  result.severeCount = severe.length;
  result.severe = severe.slice(0, 5);
  websocket.close();
  return result;
}

const results = [
  await runViewport("desktop", 1440, 1000),
  await runViewport("tablet", 900, 1180),
  await runViewport("android", 390, 844, true),
];

console.log(JSON.stringify(results, null, 2));
