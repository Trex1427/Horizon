import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { requireCurrentUid, sanitizeUserPayload, withOwnerUidForCreate } from "../auth/requireCurrentUid";
import { calculateBudgetSpentAmount, toDateValue } from "./financeCalculations";

const BUDGETS_COLLECTION = "budgets";

function normalizeDateString(value) {
  const dateValue = toDateValue(value);

  if (!dateValue) {
    return null;
  }

  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}


export function subscribeToBudgets(onData, onError) {
  const ownerUid = requireCurrentUid(auth);
  return onSnapshot(
    query(collection(db, BUDGETS_COLLECTION), where("ownerUid", "==", ownerUid), where("isActive", "==", true)),
    (snapshot) => {
      const data = snapshot.docs
        .map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data(),
        }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

      onData(data);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    }
  );
}

export async function createBudget(payload) {
  const safePayload = sanitizeUserPayload(payload, { removeSystemFields: true });
  return addDoc(collection(db, BUDGETS_COLLECTION), withOwnerUidForCreate({
    name: safePayload.name?.trim() || "",
    categoryId: safePayload.categoryId || "",
    categoryName: safePayload.categoryName?.trim() || "",
    accountId: safePayload.accountId || null,
    amount: Number(safePayload.amount || 0),
    startDate: normalizeDateString(safePayload.startDate) || null,
    endDate: normalizeDateString(safePayload.endDate) || null,
    typeBudget: safePayload.typeBudget || "depense",
    periodType: safePayload.periodType || "mensuel",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }, { auth }));
}

export async function updateBudget(id, payload) {
  const safePayload = sanitizeUserPayload(payload, { removeSystemFields: true });
  return updateDoc(doc(db, BUDGETS_COLLECTION, id), {
    name: safePayload.name?.trim() || "",
    categoryId: safePayload.categoryId || "",
    categoryName: safePayload.categoryName?.trim() || "",
    accountId: safePayload.accountId || null,
    amount: Number(safePayload.amount || 0),
    startDate: normalizeDateString(safePayload.startDate) || null,
    endDate: normalizeDateString(safePayload.endDate) || null,
    typeBudget: safePayload.typeBudget || "depense",
    periodType: safePayload.periodType || "mensuel",
    updatedAt: new Date(),
  });
}

export async function deleteBudget(id) {
  return updateDoc(doc(db, BUDGETS_COLLECTION, id), {
    isActive: false,
    updatedAt: new Date(),
  });
}

export function calculateBudgetMetrics(budget, transactions = []) {
  const amount = Number(budget?.amount || 0);
  const spent = calculateBudgetSpentAmount(budget, transactions);

  const remaining = amount - spent;
  const consumedPercent = amount > 0 ? (spent / amount) * 100 : 0;

  let color = "success.main";
  if (consumedPercent > 100) {
    color = "error.main";
  } else if (consumedPercent >= 70) {
    color = "warning.main";
  }

  return {
    plannedAmount: amount,
    spentAmount: spent,
    remainingAmount: remaining,
    consumedPercent,
    color,
  };
}
