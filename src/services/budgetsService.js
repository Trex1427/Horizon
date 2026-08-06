import { addDoc, collection, doc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { requireCurrentUid, sanitizeUserPayload, withOwnerUidForCreate } from "../auth/requireCurrentUid.js";
import { calculateBudgetSpentAmount } from "./financeCalculations.js";
import { buildBudgetWritePayload, findDuplicateBudgetEnvelope } from "./budgetModel.js";

const BUDGETS_COLLECTION = "budgets";

function duplicateBudgetError(existingBudget) {
  const error = new Error("Une enveloppe identique existe déjà pour ce compte, cette période, cette catégorie et cette sous-catégorie.");
  error.code = "budget/already-exists";
  error.existingId = existingBudget?.id || "";
  return error;
}

async function loadActiveOwnerBudgets(ownerUid) {
  const snapshot = await getDocs(query(
    collection(db, BUDGETS_COLLECTION),
    where("ownerUid", "==", ownerUid),
    where("isActive", "==", true)
  ));
  return snapshot.docs.map((documentSnapshot) => ({ id: documentSnapshot.id, ...documentSnapshot.data() }));
}

export function subscribeToBudgets(onData, onError, options = {}) {
  const ownerUid = options.ownerUid || requireCurrentUid(auth);
  return onSnapshot(
    query(collection(db, BUDGETS_COLLECTION), where("ownerUid", "==", ownerUid), where("isActive", "==", true)),
    (snapshot) => {
      const data = snapshot.docs
        .map((documentSnapshot) => ({ id: documentSnapshot.id, ...documentSnapshot.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      onData(data);
    },
    (error) => onError?.(error)
  );
}

export async function createBudget(payload) {
  const ownerUid = requireCurrentUid(auth);
  const safePayload = sanitizeUserPayload(payload, { removeSystemFields: true });
  const documentPayload = buildBudgetWritePayload(safePayload);
  const duplicate = findDuplicateBudgetEnvelope(await loadActiveOwnerBudgets(ownerUid), documentPayload);
  if (duplicate) throw duplicateBudgetError(duplicate);

  return addDoc(collection(db, BUDGETS_COLLECTION), withOwnerUidForCreate({
    ...documentPayload,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }, { auth }));
}

export async function updateBudget(id, payload) {
  const ownerUid = requireCurrentUid(auth);
  const safePayload = sanitizeUserPayload(payload, { removeSystemFields: true });
  const documentPayload = buildBudgetWritePayload(safePayload);
  const duplicate = findDuplicateBudgetEnvelope(await loadActiveOwnerBudgets(ownerUid), documentPayload, id);
  if (duplicate) throw duplicateBudgetError(duplicate);

  return updateDoc(doc(db, BUDGETS_COLLECTION, id), { ...documentPayload, updatedAt: new Date() });
}

export async function deleteBudget(id) {
  return updateDoc(doc(db, BUDGETS_COLLECTION, id), { isActive: false, updatedAt: new Date() });
}

export function calculateBudgetMetrics(budget, transactions = []) {
  const amount = Number(budget?.amount || 0);
  const spent = calculateBudgetSpentAmount(budget, transactions);
  const remaining = amount - spent;
  const consumedPercent = amount > 0 ? (spent / amount) * 100 : 0;
  let color = "success.main";
  if (consumedPercent > 100) color = "error.main";
  else if (consumedPercent >= 70) color = "warning.main";
  return { plannedAmount: amount, spentAmount: spent, remainingAmount: remaining, consumedPercent, color };
}
