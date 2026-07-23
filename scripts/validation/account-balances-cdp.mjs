import { mkdirSync, writeFileSync } from "node:fs";

const CDP_ROOT = "http://127.0.0.1:9223";
const TARGET_URL = `https://budget-alexandre.web.app/?account-balances-validation=${Date.now()}`;
const ARTIFACT_DIR = "artifacts";

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 1000, mobile: false },
  { name: "tablet", width: 900, height: 1180, mobile: false },
  { name: "android", width: 390, height: 844, mobile: true },
];

const EXPECTED_ACCOUNTS = [
  "Compte courant",
  "Livret A",
  "Compte professionnel",
  "Espèces",
  "PayPal",
];

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

async function screenshot(send, name) {
  const result = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(`${ARTIFACT_DIR}/${name}`, Buffer.from(result.data, "base64"));
}

function getSevereEvents(events) {
  return events
    .filter((event) => (
      event.method === "Runtime.exceptionThrown"
      || (event.method === "Log.entryAdded" && event.params?.entry?.level === "error")
    ))
    .map((event) => event.params);
}

async function runViewport({ name, width, height, mobile }) {
  const { websocket, send, events } = await newPage();

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: mobile ? 3 : 1,
    mobile,
  });
  await send("Page.navigate", { url: `${TARGET_URL}-${name}` });
  await wait(8000);

  const validation = await evaluate(send, `(() => {
    const expectedAccounts = ${JSON.stringify(EXPECTED_ACCOUNTS)};
    const visible = (node) => {
      const rect = node.getBoundingClientRect();
      const style = window.getComputedStyle(node);
      return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
    };
    const heading = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")]
      .find((node) => visible(node) && (node.textContent || "").trim() === "Soldes par compte");
    const section = heading?.closest("article, section, .MuiBox-root") || heading?.parentElement || null;
    const text = section?.innerText || "";
    const amountPattern = /-?\\d[\\d\\s\\u00a0\\u202f,.]*\\s*€/;
    const cards = section
      ? [...section.querySelectorAll(".MuiGrid-item")].map((node) => ({
          text: (node.innerText || "").trim(),
          rect: node.getBoundingClientRect(),
        })).filter((item) => (
          item.rect.width > 0
          && item.rect.height > 0
          && expectedAccounts.some((name) => item.text.includes(name))
          && amountPattern.test(item.text)
        ))
      : [];
    const visibleText = text.replace(/\\s+/g, " ").trim();
    const names = cards.length > 0
      ? cards.map((card) => expectedAccounts.find((name) => card.text.includes(name))).filter(Boolean)
      : expectedAccounts.filter((accountName) => visibleText.includes(accountName));
    const nameCounts = Object.fromEntries(expectedAccounts.map((accountName) => [
      accountName,
      names.filter((name) => name === accountName).length,
    ]));
    const balances = Object.fromEntries(expectedAccounts.map((accountName) => {
      const card = cards.find((item) => item.text.includes(accountName));
      const scopedText = card?.text || visibleText.slice(Math.max(0, visibleText.indexOf(accountName)));
      const amount = scopedText.match(amountPattern)?.[0] || "";
      return [accountName, amount];
    }));
    const cashCardCount = cards.length > 0
      ? cards.filter((card) => card.text.includes("Espèces")).length
      : (visibleText.match(/Espèces/g) || []).length;
    return {
      hasHeading: Boolean(heading),
      cardCount: cards.length || names.length,
      uniqueNameCount: new Set(names).size,
      names,
      nameCounts,
      balances,
      cashCardCount,
      cashInitActions: (text.match(/Initialiser le solde/gi) || []).length,
      cashAdjustActions: (text.match(/Ajuster le solde/gi) || []).length,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      bodyHasDefaultIds: /default-(cash|current|paypal|professional|savings)/.test(document.body.innerText || ""),
      sectionSample: text.slice(0, 500),
    };
  })()`);

  await screenshot(send, `account-balances-${name}.png`);
  const severe = getSevereEvents(events);
  websocket.close();

  return {
    name,
    width,
    height,
    mobile,
    ...validation,
    severeCount: severe.length,
    severe: severe.slice(0, 5),
    passed: validation.hasHeading
      && validation.cardCount === 5
      && validation.uniqueNameCount === 5
      && EXPECTED_ACCOUNTS.every((accountName) => validation.nameCounts[accountName] === 1)
      && validation.cashCardCount === 1
      && validation.cashInitActions === 1
      && validation.cashAdjustActions === 1
      && !validation.horizontalOverflow
      && !validation.bodyHasDefaultIds
      && severe.length === 0,
  };
}

const results = [];
for (const viewport of VIEWPORTS) {
  results.push(await runViewport(viewport));
}

console.log(JSON.stringify(results, null, 2));

if (!results.every((result) => result.passed)) {
  process.exitCode = 1;
}
