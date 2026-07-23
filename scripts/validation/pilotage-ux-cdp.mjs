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
  await wait(7000);
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
    const isVisible = (node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    };
    const element = elements.find((node) => {
      if (!isVisible(node)) return false;
      const label = node.innerText || node.textContent || node.getAttribute("aria-label") || "";
      return label.includes(target);
    });
    if (!element) return false;
    const clickable = element.closest("button, [role='button'], .MuiBottomNavigationAction-root, .MuiListItemButton-root") || element;
    clickable.click();
    return true;
  })()`);
}

async function openPage(send, pageLabel, mobile = false) {
  if (mobile && !["Accueil", "Transactions", "Budgets"].includes(pageLabel)) {
    await clickText(send, "Plus");
    await wait(450);
  }

  const clicked = await clickText(send, pageLabel);
  await wait(1500);
  return clicked;
}

async function inspectPage(send, title, searchPlaceholder = "") {
  const page = await evaluate(send, `(() => {
    const text = document.body.innerText;
    const labels = [...document.querySelectorAll("[aria-label]")].map((node) => node.getAttribute("aria-label")).filter(Boolean);
    const progressCount = document.querySelectorAll('[role="progressbar"], .MuiLinearProgress-root').length;
    const buttonCount = document.querySelectorAll("button, [role='button']").length;
    const hasSearch = ${JSON.stringify(searchPlaceholder)} ? Boolean([...document.querySelectorAll("input")].find((input) => input.placeholder === ${JSON.stringify(searchPlaceholder)})) : true;
    return {
      hasTitle: text.includes(${JSON.stringify(title)}),
      hasPilotage: text.includes("Pilotage financier"),
      hasResume: labels.includes("Resume du pilotage financier"),
      hasList: text.includes("Liste principale"),
      hasSearch,
      progressCount,
      buttonCount,
      bodySample: text.slice(0, 500),
    };
  })()`);

  if (searchPlaceholder) {
    page.searchWorks = await evaluate(send, `(() => {
      const input = [...document.querySelectorAll("input")].find((node) => node.placeholder === ${JSON.stringify(searchPlaceholder)});
      if (!input) return false;
      input.focus();
      input.value = "zz-no-result";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`);
    await wait(400);
  }

  return page;
}

async function testDoubleClick(send) {
  return evaluate(send, `(() => {
    const card = document.querySelector('[role="button"][aria-label]');
    if (!card) return { attempted: false, dialogOpened: false };
    card.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, view: window }));
    return {
      attempted: true,
      dialogOpened: Boolean(document.querySelector('[role="dialog"]')),
    };
  })()`);
}

function getSevereEvents(events) {
  return events
    .filter((event) => (
      event.method === "Runtime.exceptionThrown"
      || (event.method === "Log.entryAdded" && ["error", "warning"].includes(event.params?.entry?.level))
    ))
    .map((event) => event.params);
}

async function runViewport(name, width, height, mobile = false) {
  const { websocket, send, events } = await newPage();
  await setup(send, width, height, mobile);

  const result = { name };

  result.openBudgets = await openPage(send, "Budgets", mobile);
  result.budgets = await inspectPage(send, "Budgets", "Rechercher un budget");
  result.budgetDoubleClick = name === "desktop" ? await testDoubleClick(send) : null;
  await screenshot(send, `validation-pilotage-${name}-budgets.png`);

  await send("Page.navigate", { url: TARGET_URL });
  await wait(2500);
  result.openObjectifs = await openPage(send, "Objectifs", mobile);
  result.objectifs = await inspectPage(send, "Objectifs", "Rechercher un objectif");
  result.objectifDoubleClick = name === "desktop" ? await testDoubleClick(send) : null;
  await screenshot(send, `validation-pilotage-${name}-objectifs.png`);

  await send("Page.navigate", { url: TARGET_URL });
  await wait(2500);
  result.openPrevisions = await openPage(send, "Previsions", mobile);
  result.previsions = await inspectPage(send, "Previsions");
  await screenshot(send, `validation-pilotage-${name}-previsions.png`);

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
