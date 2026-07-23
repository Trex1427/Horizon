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
  await wait(4500);
}

async function screenshot(send, name) {
  const result = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(`${ARTIFACT_DIR}/${name}`, Buffer.from(result.data, "base64"));
}

async function clickByAriaLabel(send, label) {
  return evaluate(send, `(() => {
    const element = [...document.querySelectorAll("[aria-label]")]
      .find((node) => node.getAttribute("aria-label") === ${JSON.stringify(label)});
    if (!element) return false;
    element.click();
    return true;
  })()`);
}

async function navigateHome(send) {
  await send("Page.navigate", { url: TARGET_URL });
  await wait(2500);
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
  await screenshot(send, `validation-cockpit-interactif-${name}.png`);

  const result = {
    name,
    base: await evaluate(send, `(() => {
      const text = document.body.innerText;
      const labels = [...document.querySelectorAll("[aria-label]")]
        .map((element) => element.getAttribute("aria-label"))
        .filter(Boolean);
      return {
        hasSolde: text.includes("Solde actuel") || labels.includes("Ouvrir les transactions depuis le solde actuel"),
        hasVariation: text.includes("Variation du mois"),
        hasFin: text.includes("Solde prevu fin de mois") || labels.includes("Faire defiler la trajectoire jusqu'au mois courant"),
        hasDec: text.includes("Solde prevu au 31 decembre"),
        interactive: labels
          .filter((label) => /Ouvrir|Faire defiler/.test(label || ""))
          .slice(0, 30),
      };
    })()`),
  };

  if (name === "desktop") {
    result.clickSolde = await clickByAriaLabel(send, "Ouvrir les transactions depuis le solde actuel");
    await wait(1500);
    result.afterSolde = await evaluate(send, `document.body.innerText.includes("Transactions")`);

    await navigateHome(send);
    result.clickVariation = await clickByAriaLabel(send, "Ouvrir l'analyse du mois courant");
    await wait(700);
    result.afterVariation = await evaluate(send, `document.body.innerText.includes("Analyse financiere")`);

    await navigateHome(send);
    result.clickFin = await clickByAriaLabel(send, "Faire defiler la trajectoire jusqu'au mois courant");
    await wait(700);
    result.activeAfterFin = await evaluate(send, `document.activeElement?.getAttribute("aria-label") || ""`);

    result.clickDec = await clickByAriaLabel(send, "Faire defiler la trajectoire jusqu'a decembre");
    await wait(700);
    result.activeAfterDec = await evaluate(send, `document.activeElement?.getAttribute("aria-label") || ""`);

    result.clickMonth = await evaluate(send, `(() => {
      const element = [...document.querySelectorAll("[aria-label]")]
        .find((node) => /^Ouvrir l'analyse du mois de /.test(node.getAttribute("aria-label") || ""));
      if (!element) return "";
      const label = element.getAttribute("aria-label");
      element.click();
      return label;
    })()`);
    await wait(700);
    result.afterMonth = await evaluate(send, `document.body.innerText.includes("Analyse financiere")`);

    await navigateHome(send);
    result.clickOpportunities = await clickByAriaLabel(send, "Ouvrir les opportunites");
    await wait(700);
    result.afterOpportunities = await evaluate(send, `document.body.innerText.includes("Opportunites")`);

    await navigateHome(send);
    await evaluate(send, `(() => {
      const element = [...document.querySelectorAll("[aria-label]")]
        .find((node) => node.getAttribute("aria-label") === "Ouvrir les transactions depuis le solde actuel");
      element?.focus();
      return Boolean(element);
    })()`);
    await send("Input.dispatchKeyEvent", {
      type: "keyDown",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
    });
    await send("Input.dispatchKeyEvent", {
      type: "keyUp",
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
    });
    await wait(700);
    result.keyboardSolde = await evaluate(send, `document.body.innerText.includes("Transactions")`);
  }

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
