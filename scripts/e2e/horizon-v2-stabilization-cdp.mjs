import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const CDP = process.env.HORIZON_CDP_URL || "http://127.0.0.1:9222";
const APP = process.env.HORIZON_APP_URL || "http://127.0.0.1:4173";
const OUT = path.resolve(process.env.HORIZON_E2E_OUTPUT || "artifacts/horizon-v2-final-validation");
export const VIEWPORTS = [390, 768, 1024, 1440];
export const PAGES = [
  ["dashboard","resume","Tableau de bord"],["transactions","transactions","Transactions"],
  ["accounts","comptes-v2","Comptes"],["budgets","budgets-v2","Budgets"],
  ["forecast","previsions","Prévisions"],["analysis","analyse","Analyse"],
  ["reports","rapports","Rapports"],["objectives","objectifs","Objectifs"],
  ["recurring-income","revenus-recurrents","Revenus récurrents"],["fixed-expenses","frais-fixes","Frais fixes"],
  ["debts-claims","dettes-creances","Dettes & créances"],["vehicles","vehicules","Véhicules"],
  ["work","travail","Travail"],["quotes","devis","Devis"],
  ["invoices","factures","Factures"],["settings","parametres","Paramètres"],
];

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function target(url) {
  const response = await fetch(`${CDP}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  if (!response.ok) throw new Error("Chrome CDP authentifié requis sur le port 9222.");
  return response.json();
}
function session(info, messages) {
  const socket = new WebSocket(info.webSocketDebuggerUrl);
  const pending = new Map();
  let sequence = 0;
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === "Runtime.consoleAPICalled") messages.push({ level: message.params.type, text: message.params.args.map((item) => item.value ?? item.description ?? "").join(" ") });
    if (message.method === "Runtime.exceptionThrown") messages.push({ level: "error", text: message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text });
    if (message.method === "Log.entryAdded") messages.push({ level: message.params.entry.level, text: message.params.entry.text });
    if (!message.id || !pending.has(message.id)) return;
    const task = pending.get(message.id);
    pending.delete(message.id);
    message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
  };
  return {
    open: () => new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }),
    send(method, params = {}) {
      const id = ++sequence;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    close: () => socket.close(),
  };
}
async function evaluate(cdp, expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function ready(cdp) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const state = await evaluate(cdp, `({v2:Boolean(document.querySelector(".horizon-v2")),login:Boolean(document.querySelector('input[type="email"],input[type="password"]'))})`);
    if (state.login) throw new Error("Session authentifiée requise.");
    if (state.v2) return;
    await delay(100);
  }
  throw new Error("Page V2 indisponible.");
}

const AUDIT = `(() => {
 const visible=n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width>0&&r.height>0&&s.display!=="none"&&s.visibility!=="hidden"};
 const label=n=>(n.getAttribute("aria-label")||n.innerText||n.textContent||n.tagName).trim();
 const controls=[...document.querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(visible);
 const clipped=[...document.querySelectorAll("main *")].filter(n=>visible(n)&&!n.children.length&&n.textContent.trim()&&getComputedStyle(n).overflow==="hidden"&&(n.scrollWidth>n.clientWidth+1||n.scrollHeight>n.clientHeight+1)).map(label);
 return {
  title:document.querySelector("h1")?.textContent?.trim()||"",
  overflow:document.documentElement.scrollWidth>innerWidth+1,
  clipped,
  unnamed:controls.filter(n=>!(n.getAttribute("aria-label")||n.getAttribute("aria-labelledby")||n.innerText?.trim()||n.value||n.title)).map(label),
  undersized:innerWidth<=768?controls.filter(n=>{const r=n.getBoundingClientRect();return r.width<44||r.height<44}).map(label):[]
 };
})()`;

async function run(page, width) {
 const [name,slug,title]=page,url=new URL(APP); url.searchParams.set("page",slug);
 const messages=[],info=await target(url.href),cdp=session(info,messages); await cdp.open();
 try {
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Log.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride",{width,height:width===390?844:1000,deviceScaleFactor:1,mobile:width===390});
  await cdp.send("Page.navigate",{url:url.href}); await ready(cdp);
  const layout=await evaluate(cdp,AUDIT);
  await cdp.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Tab",code:"Tab",windowsVirtualKeyCode:9});
  await cdp.send("Input.dispatchKeyEvent",{type:"keyUp",key:"Tab",code:"Tab",windowsVirtualKeyCode:9});
  const focus=await evaluate(cdp,`document.activeElement?.tagName||""`);
  const dialogTrigger=await evaluate(cdp,`(() => {
   const pattern=/^(Ajouter|Nouveau|Nouvelle|Créer)/i;
   const button=[...document.querySelectorAll("button")].find(node=>{
    const rect=node.getBoundingClientRect();
    return rect.width>0&&rect.height>0&&pattern.test((node.innerText||"").trim());
   });
   if(!button)return false;
   button.click();
   return true;
  })()`);
  let dialog={available:dialogTrigger,opened:false,closed:true};
  if(dialogTrigger){
   await delay(150);
   dialog.opened=await evaluate(cdp,`Boolean(document.querySelector('[role="dialog"]'))`);
   if(dialog.opened){
    await cdp.send("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
    await cdp.send("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
    await delay(150);
    dialog.closed=!await evaluate(cdp,`Boolean(document.querySelector('[role="dialog"]'))`);
   }
  }
  const image=await cdp.send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
  await writeFile(path.join(OUT,`${name}-${width}.png`),Buffer.from(image.data,"base64"));
  const failures=[];
  if(layout.title!==title)failures.push("titre"); if(layout.overflow)failures.push("overflow");
  if(layout.clipped.length)failures.push("troncature"); if(layout.unnamed.length)failures.push("aria");
  if(!focus||focus==="BODY")failures.push("focus");
  if(dialog.available&&(!dialog.opened||!dialog.closed))failures.push("dialogue");
  if(messages.some(({level})=>level==="error"||level==="warning"))failures.push("console");
  return {page:name,width,layout,focus,dialog,messages,failures};
 } finally {cdp.close(); await fetch(`${CDP}/json/close/${info.id}`);}
}
async function main() {
 if(process.argv.includes("--self-test")){
  assert.equal(PAGES.length,16); assert.deepEqual(VIEWPORTS,[390,768,1024,1440]);
  assert.equal(new Set(PAGES.map(([,slug])=>slug)).size,16);
  console.log("Matrice E2E valide : 16 pages × 4 viewports, lecture seule."); return;
 }
 await mkdir(OUT,{recursive:true});
 const results=[];
 for(const width of VIEWPORTS)for(const page of PAGES){
  const result=await run(page,width); results.push(result);
  console.log(`${result.failures.length?"FAIL":"PASS"} ${result.page} @ ${width}px`);
 }
 const failures=results.reduce((sum,item)=>sum+item.failures.length,0);
 await writeFile(path.join(OUT,"results.json"),JSON.stringify({generatedAt:new Date().toISOString(),checks:results.length,failures,results},null,2),"utf8");
 if(failures)process.exitCode=1;
}
main().catch((error)=>{console.error(error.message);process.exitCode=1;});
