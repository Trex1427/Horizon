import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const componentPath=resolve(process.cwd(),"src/components/reports-v2/ReportsV2.jsx");const cssPath=resolve(process.cwd(),"src/components/reports-v2/ReportsV2.css");
test("ReportsV2 reuses existing analytical data and Design System charts",async()=>{const source=await readFile(componentPath,"utf8");for(const contract of ["useTransactionsContext","useFixedExpenses","useRecurringIncome","buildAnalysisSnapshot","getPeriodRange","getPreviousPeriodRange","LineChart","DonutChart"])assert.match(source,new RegExp(contract));assert.doesNotMatch(source,/ExpenseCategoryPieChart|firebase|firestore|collection\(|setDoc|addDoc/)});
test("ReportsV2 delivers the requested responsive cockpit without invented export",async()=>{const[source,css]=await Promise.all([readFile(componentPath,"utf8"),readFile(cssPath,"utf8")]);for(const label of ["Rapports","Revenus","Dépenses","Épargne","Taux d'épargne","Évolution des revenus et dépenses","Répartition des dépenses","Points clés","Aucune donnée disponible."])assert.match(source,new RegExp(label));assert.doesNotMatch(source,/Exporter|Télécharger|download/);assert.match(css,/max-width:620px/);assert.match(css,/prefers-reduced-motion/);assert.doesNotMatch(css,/overflow-x:\s*(auto|scroll)/)});
