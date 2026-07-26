import { addDoc, collection, doc, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { requireCurrentUid, sanitizeUserPayload, withOwnerUidForCreate } from "../auth/requireCurrentUid";
import { getRecurringIncomeApplicableAmount } from "../utils/recurringIncomeAmount.js";

const RECURRING_INCOME_COLLECTION = "recurringIncome";

function toDateValue(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value?.toDate === "function") {
    return value.toDate();
  }

  return null;
}

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

function isWithinPeriod(income, targetDate) {
  const target = toDateValue(targetDate);
  const startDate = toDateValue(income?.startDate);
  const endDate = toDateValue(income?.endDate);

  if (!target || !startDate) {
    return false;
  }

  if (target < startDate) {
    return false;
  }

  if (endDate && target > endDate) {
    return false;
  }

  return true;
}

function isMatchingFrequency(income, targetDate) {
  const target = toDateValue(targetDate);
  const startDate = toDateValue(income?.startDate);

  if (!target || !startDate) {
    return false;
  }

  if (income?.frequency === "annuel") {
    return (
      target.getMonth() === startDate.getMonth() &&
      target.getDate() === startDate.getDate() &&
      target >= startDate
    );
  }

  return target >= startDate;
}

export function subscribeToRecurringIncome(onData, onError) {
  const ownerUid = requireCurrentUid(auth);
  return onSnapshot(
    query(collection(db, RECURRING_INCOME_COLLECTION), where("ownerUid", "==", ownerUid), where("isActive", "==", true)),
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

export async function createRecurringIncome(payload) {
  const safePayload = sanitizeUserPayload(payload, { removeSystemFields: true });
  const resolvedCategoryName = safePayload.categoryName?.trim() || safePayload.category?.trim() || "";

  return addDoc(collection(db, RECURRING_INCOME_COLLECTION), withOwnerUidForCreate({
    name: safePayload.name?.trim() || "",
    categoryId: safePayload.categoryId || "",
    categoryName: resolvedCategoryName,
    category: resolvedCategoryName,
    accountId: safePayload.accountId || "",
    frequency: safePayload.frequency || "mensuel",
    initialAmount: Number(safePayload.initialAmount || 0),
    startDate: normalizeDateString(safePayload.startDate) || null,
    endDate: normalizeDateString(safePayload.endDate) || null,
    variations: Array.isArray(safePayload.variations) ? safePayload.variations : [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }, { auth }));
}

export async function updateRecurringIncome(id, payload) {
  const safePayload = sanitizeUserPayload(payload, { removeSystemFields: true });
  const resolvedCategoryName = safePayload.categoryName?.trim() || safePayload.category?.trim() || "";

  return updateDoc(doc(db, RECURRING_INCOME_COLLECTION, id), {
    name: safePayload.name?.trim() || "",
    categoryId: safePayload.categoryId || "",
    categoryName: resolvedCategoryName,
    category: resolvedCategoryName,
    accountId: safePayload.accountId || "",
    frequency: safePayload.frequency || "mensuel",
    initialAmount: Number(safePayload.initialAmount || 0),
    startDate: normalizeDateString(safePayload.startDate) || null,
    endDate: normalizeDateString(safePayload.endDate) || null,
    variations: Array.isArray(safePayload.variations) ? safePayload.variations : [],
    updatedAt: new Date(),
  });
}

export async function deleteRecurringIncome(id) {
  return updateDoc(doc(db, RECURRING_INCOME_COLLECTION, id), {
    isActive: false,
    updatedAt: new Date(),
  });
}

export function calculateRecurringIncomeAmount(income, targetDate) {
  if (!income?.isActive) {
    return 0;
  }

  if (!isWithinPeriod(income, targetDate) || !isMatchingFrequency(income, targetDate)) {
    return 0;
  }

  return getRecurringIncomeApplicableAmount(income, targetDate);
}
