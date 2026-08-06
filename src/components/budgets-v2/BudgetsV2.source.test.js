import test from"node:test";import assert from"node:assert/strict";import{readFile}from"node:fs/promises";import{resolve}from"node:path";

const component=resolve(process.cwd(),"src/components/budgets-v2/BudgetsV2.jsx");

test("BudgetsV2 wraps legacy Budgets in the Transactions visual shell",async()=>{
	const content=await readFile(component,"utf8");
	for(const token of[
		"../../pages/Budgets.jsx",
		"../transactions-v2/TransactionsV2.css",
		"transactions-v2",
		"transactions-v2-main",
		"transactions-v2-header",
		"transactions-v2-engine",
		"DashboardV2Sidebar active=\"budgets\"",
		"DashboardV2MobileNavigation active=\"budgets\"",
		"Budgets accounts={accounts} onOpenTransactionsFiltered={onOpenTransactionsFiltered}",
		"Choisir la période",
	]){
		assert.equal(content.includes(token),true);
	}
	assert.doesNotMatch(content,/firebase|Firestore|addDoc|updateDoc|deleteDoc/);
});
