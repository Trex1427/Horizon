import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const componentPath=resolve(process.cwd(),"src/components/debts-claims-v2/DebtsClaimsV2.jsx");
const cssPath=resolve(process.cwd(),"src/components/debts-claims-v2/DebtsClaimsV2.css");

test("DebtsClaimsV2 consumes only existing hooks, model and mutations",async()=>{const source=await readFile(componentPath,"utf8");assert.match(source,/useDebtsReceivables/);assert.match(source,/useThirdParties/);assert.match(source,/calculateDebtsReceivablesSummary/);for(const mutation of ["create","update","remove"])assert.match(source,new RegExp(`\\b${mutation}\\b`));assert.doesNotMatch(source,/firebase|firestore|collection\(|getDocs|setDoc|addDoc/)});
test("DebtsClaimsV2 mirrors the recurring V2 cockpit without invented deadlines",async()=>{const[source,css]=await Promise.all([readFile(componentPath,"utf8"),readFile(cssPath,"utf8")]);for(const label of ["Dettes &amp; créances","Créances","Dettes","Solde net","Échéances proches","À venir","Situation actuelle","Répartition","Ajouter une dette / créance","Aucune dette ni créance."])assert.match(source,new RegExp(label));assert.match(source,/functionalStatus/);assert.match(source,/item\.dueDate/);assert.doesNotMatch(source,/setDate\(|30\s*\*/);assert.match(source,/recurring-income-v2\/RecurringIncomeV2\.css/);assert.match(css,/prefers-reduced-motion/);assert.doesNotMatch(css,/overflow-x:\s*(auto|scroll)/)});
