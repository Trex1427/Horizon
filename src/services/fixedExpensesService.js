import { addDoc, collection, doc, getDoc, getDocs, onSnapshot, query, updateDoc, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { requireCurrentUid, sanitizeUserPayload, withOwnerUidForCreate } from "../auth/requireCurrentUid";
import {
  areFixedExpensesCompatible,
} from "../utils/fixedExpenseIdentity.js";

const FIXED_EXPENSES_COLLECTION = "fixedExpenses";

function isPermissionDeniedError(error) {
  return String(error?.code || "") === "permission-denied";
}

function asSimplePayloadForLogs(payload = {}) {
  const clone = { ...payload };
  if (clone.createdAt instanceof Date) clone.createdAt = clone.createdAt.toISOString();
  if (clone.updatedAt instanceof Date) clone.updatedAt = clone.updatedAt.toISOString();
  return clone;
}

function buildFixedExpensePermissionContext({ ownerUid, fixedExpenseRef, documentPayload, stage, error, hint }) {
  return {
    ownerUid,
    stage,
    hint,
    code: error?.code || "",
    message: error?.message || String(error),
    deniedDocument: {
      path: fixedExpenseRef.path,
      id: fixedExpenseRef.id,
      collection: FIXED_EXPENSES_COLLECTION,
    },
    attemptedPayload: asSimplePayloadForLogs(documentPayload),
  };
}

function buildPermissionErrorMessage(context) {
  return [
    "Firestore permission-denied.",
    `stage=${context.stage}`,
    `doc=${context.deniedDocument.path}`,
    `rule=${context.ruleCandidate?.match || "unknown"}`,
    `allow=${context.ruleCandidate?.allow || "unknown"}`,
    `property=${context.ruleCandidate?.likelyProperty || "unknown"}`,
  ].join(" ");
}

async function enrichPermissionDiagnostics({ ownerUid, fixedExpenseRef, documentPayload, stage, error }) {
  const context = buildFixedExpensePermissionContext({
    ownerUid,
    fixedExpenseRef,
    documentPayload,
    stage,
    error,
    hint: "Diagnostic en cours",
  });

  if (!isPermissionDeniedError(error)) {
    return context;
  }

  try {
    const readProbe = await getDoc(fixedExpenseRef);
    context.readProbe = {
      allowed: true,
      exists: readProbe.exists(),
    };

    if (!readProbe.exists()) {
      context.ruleCandidate = {
        match: "match /fixedExpenses/{documentId}",
        allow: "create",
        condition: "createsOwnDocument()",
        likelyProperty: "request.resource.data.ownerUid",
      };
      context.hint = "La lecture du document cible est autorisee et le document n'existe pas : refus probable sur la regle create.";
    } else {
      context.ruleCandidate = {
        match: "match /fixedExpenses/{documentId}",
        allow: "get",
        condition: "readsOwnDocument()",
        likelyProperty: "resource.data.ownerUid",
      };
      context.hint = "Le document existe deja et est lisible : verifier la coherence ownerUid sur l'ecriture.";
    }
  } catch (probeError) {
    context.readProbe = {
      allowed: false,
      code: probeError?.code || "",
      message: probeError?.message || String(probeError),
    };
    context.ruleCandidate = {
      match: "match /fixedExpenses/{documentId}",
      allow: "get",
      condition: "readsOwnDocument() || !exists(/databases/$(database)/documents/fixedExpenses/$(documentId))",
      likelyProperty: "resource.data.ownerUid",
    };
    context.hint = "La lecture du document cible est refusee : le document existe probablement deja avec un ownerUid different.";
  }

  return context;
}

export function subscribeToFixedExpenses(onData, onError, options = {}) {
  const ownerUid = options.ownerUid || requireCurrentUid(auth);
  return onSnapshot(
    query(collection(db, FIXED_EXPENSES_COLLECTION), where("ownerUid", "==", ownerUid), where("isActive", "==", true)),
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

function buildFixedExpenseCreatePayload(payload, now = new Date()) {
  const safePayload = sanitizeUserPayload(payload, { removeSystemFields: true });
  const resolvedCategoryName = safePayload.categoryName?.trim() || safePayload.category?.trim() || "";

  return {
    ...safePayload,
    name: safePayload.name?.trim() || "",
    amountType: safePayload.amountType === "variable" ? "variable" : "fixed",
    categoryId: safePayload.categoryId || "",
    categoryName: resolvedCategoryName,
    category: resolvedCategoryName,
    subcategoryId: safePayload.subcategoryId || null,
    subcategoryName: safePayload.subcategoryId ? (safePayload.subcategoryName?.trim() || null) : null,
    accountId: safePayload.accountId || "",
    frequency: safePayload.frequency || "monthly",
    initialAmount: Number(safePayload.initialAmount || 0),
    startDate: safePayload.startDate || null,
    endDate: safePayload.endDate || null,
    variations: Array.isArray(safePayload.variations) ? safePayload.variations : [],
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };
}

export async function createFixedExpense(payload) {
  console.log("[CREATE FIXED]", "service =", "fixedExpensesService");
  console.log("[CREATE FIXED]", "function =", "createFixedExpense");
  console.log("[CREATE FIXED]", "using addDoc", true);
  console.log("[CREATE FIXED]", "using setDoc", false);
  console.log("[CREATE FIXED]", "using runTransaction", false);
  console.log("[CREATE FIXED]", "using transaction.get", false);
  const documentPayload = withOwnerUidForCreate(buildFixedExpenseCreatePayload(payload), { auth });
  const ownerUid = documentPayload.ownerUid;

  let activeSnapshot;
  try {
    console.log("[CREATE FIXED]", "first firestore =", "getDocs(query(collection(fixedExpenses), where(ownerUid==uid), where(isActive==true)))");
    activeSnapshot = await getDocs(query(
      collection(db, FIXED_EXPENSES_COLLECTION),
      where("ownerUid", "==", ownerUid),
      where("isActive", "==", true)
    ));
  } catch (error) {
    const context = await enrichPermissionDiagnostics({
      ownerUid,
      fixedExpenseRef: doc(collection(db, FIXED_EXPENSES_COLLECTION), "diagnostic-query-list"),
      documentPayload,
      stage: "preflight.list",
      error,
    });
    console.error("[fixed-expense:create] Firestore refusal diagnostics", context);
    if (isPermissionDeniedError(error)) {
      const wrappedError = new Error(buildPermissionErrorMessage(context));
      wrappedError.code = error.code;
      wrappedError.details = context;
      throw wrappedError;
    }
    throw error;
  }

  const compatibleDocument = activeSnapshot.docs.find((snapshot) => areFixedExpensesCompatible(documentPayload, snapshot.data()));

  if (compatibleDocument) {
    const error = new Error("Une fiche de frais fixe compatible existe déjà. Associez la transaction à cette fiche.");
    error.code = "fixed-expense/already-exists";
    error.existingId = compatibleDocument.id;
    throw error;
  }

  let fixedExpenseRef;
  try {
    console.log("[CREATE FIXED]", "firestore write =", "addDoc(collection(fixedExpenses), documentPayload)");
    fixedExpenseRef = await addDoc(collection(db, FIXED_EXPENSES_COLLECTION), documentPayload);
  } catch (error) {
    if (isPermissionDeniedError(error)) {
      const context = await enrichPermissionDiagnostics({
        ownerUid,
        fixedExpenseRef: fixedExpenseRef || doc(collection(db, FIXED_EXPENSES_COLLECTION), "diagnostic-create"),
        documentPayload,
        stage: "create.addDoc",
        error,
      });
      console.error("[fixed-expense:create] Firestore refusal diagnostics", context);
      const wrappedError = new Error(buildPermissionErrorMessage(context));
      wrappedError.code = error.code;
      wrappedError.details = context;
      throw wrappedError;
    }
    throw error;
  }

  return fixedExpenseRef;
}

export async function updateFixedExpense(id, payload) {
  const safePayload = sanitizeUserPayload(payload, { removeSystemFields: true });
  const resolvedCategoryName = safePayload.categoryName?.trim() || safePayload.category?.trim() || "";

  return updateDoc(doc(db, FIXED_EXPENSES_COLLECTION, id), {
    ...safePayload,
    name: safePayload.name?.trim() || "",
    amountType: safePayload.amountType === "variable" ? "variable" : "fixed",
    categoryId: safePayload.categoryId || "",
    categoryName: resolvedCategoryName,
    category: resolvedCategoryName,
    subcategoryId: safePayload.subcategoryId || null,
    subcategoryName: safePayload.subcategoryId ? (safePayload.subcategoryName?.trim() || null) : null,
    accountId: safePayload.accountId || "",
    frequency: safePayload.frequency || "monthly",
    initialAmount: Number(safePayload.initialAmount || 0),
    startDate: safePayload.startDate || null,
    endDate: safePayload.endDate || null,
    variations: Array.isArray(safePayload.variations) ? safePayload.variations : [],
    updatedAt: new Date(),
  });
}

export async function deleteFixedExpense(id) {
  return updateDoc(doc(db, FIXED_EXPENSES_COLLECTION, id), {
    isActive: false,
    updatedAt: new Date(),
  });
}
