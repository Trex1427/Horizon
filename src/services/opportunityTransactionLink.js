import { requireCurrentUid, sanitizeUserPayload } from "../auth/requireCurrentUid.js";

const OPPORTUNITIES_COLLECTION = "opportunities";
const TRANSACTIONS_COLLECTION = "transactions";

function normalizeStatus(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeDateString(value = "") {
  const raw = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function toPositiveAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : "";
}

export function isOpportunityRealized(opportunity = {}) {
  return normalizeStatus(opportunity.status) === "realise";
}

export function didOpportunityBecomeRealized(previous = {}, next = {}) {
  return !isOpportunityRealized(previous) && isOpportunityRealized(next);
}

export function buildOpportunityTransactionDraft(opportunity = {}, catalogs = {}, options = {}) {
  const categories = catalogs.categories || [];
  const projects = catalogs.projects || [];
  const thirdParties = catalogs.thirdParties || [];
  const activities = catalogs.activities || [];
  const category = categories.find((item) => item.id === opportunity.categoryId);
  const project = projects.find((item) => item.id === opportunity.projectId);
  const thirdParty = thirdParties.find((item) => item.id === opportunity.thirdPartyId);
  const activity = activities.find((item) => item.id === opportunity.activityId);
  const realizedDate = normalizeDateString(opportunity.realizedDate);
  const estimatedDate = normalizeDateString(opportunity.estimatedDate);
  const amount = toPositiveAmount(opportunity.realizedAmount) || toPositiveAmount(opportunity.estimatedAmount);
  const notes = [opportunity.description, opportunity.comment]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" - ");

  return {
    date: realizedDate || estimatedDate || options.today || todayIsoDate(),
    montant: amount === "" ? "" : String(amount),
    categorie: opportunity.categoryName || opportunity.category || category?.name || "",
    categoryId: opportunity.categoryId || category?.id || "",
    categoryName: opportunity.categoryName || opportunity.category || category?.name || "",
    description: opportunity.name || "",
    type: "revenu",
    accountId: opportunity.accountId || options.defaultAccountId || "",
    subcategoryId: "",
    subcategoryName: "",
    activityId: opportunity.activityId || activity?.id || "",
    activityName: opportunity.activityName || activity?.name || "",
    thirdPartyId: opportunity.thirdPartyId || thirdParty?.id || "",
    thirdPartyName: opportunity.thirdPartyName || thirdParty?.name || "",
    projectId: opportunity.projectId || project?.id || "",
    projectName: opportunity.projectName || project?.name || "",
    destinationAccountId: "",
    isFixedExpense: false,
    fixedExpenseId: "",
    opportunityId: opportunity.id || "",
    opportunityNotes: notes,
  };
}

export function buildOpportunityLinkedTransactionPayload(transactionPayload = {}, opportunity = {}) {
  return {
    ...transactionPayload,
    opportunityId: opportunity.id,
    opportunityName: opportunity.name || "",
    opportunityLinkedAt: new Date().toISOString(),
  };
}

export function createOpportunityTransactionAdapter({ transactionRunner, createDocRef, resolveOwnerUid = null, now = () => new Date().toISOString() } = {}) {
  if (typeof transactionRunner !== "function" || typeof createDocRef !== "function") {
    throw new Error("Opportunity transaction adapter is incomplete.");
  }

  return async function createLinkedTransaction({ opportunityId = "", transactionPayload = {} } = {}) {
    const normalizedOpportunityId = String(opportunityId || "").trim();
    if (!normalizedOpportunityId) {
      throw new Error("Opportunity id is required.");
    }

    return transactionRunner(async (tx) => {
      const opportunityRef = createDocRef(OPPORTUNITIES_COLLECTION, normalizedOpportunityId);
      const opportunitySnapshot = await tx.get(opportunityRef);
      if (!opportunitySnapshot.exists()) {
        throw new Error("Opportunite introuvable.");
      }

      const opportunity = opportunitySnapshot.data();
      const existingTransactionId = String(opportunity.realizedTransactionId || "").trim();
      if (existingTransactionId) {
        const existingRef = createDocRef(TRANSACTIONS_COLLECTION, existingTransactionId);
        const existingSnapshot = await tx.get(existingRef);
        const existingData = existingSnapshot.exists() ? existingSnapshot.data() : null;
        if (existingSnapshot.exists() && existingData?.isDeleted !== true) {
          return {
            status: "already_exists",
            transactionId: existingTransactionId,
          };
        }
      }

      const transactionRef = createDocRef(TRANSACTIONS_COLLECTION);
      const transactionId = transactionRef.id;
      const ownerUid = resolveOwnerUid?.();
      const safeTransactionPayload = sanitizeUserPayload(transactionPayload, { removeSystemFields: true });
      tx.set(transactionRef, {
        ...safeTransactionPayload,
        opportunityId: normalizedOpportunityId,
        createdAt: now(),
        ...(ownerUid ? { ownerUid } : {}),
      });
      tx.update(opportunityRef, {
        realizedTransactionId: transactionId,
        realizedTransactionLinkedAt: now(),
        updatedAt: new Date(),
      });

      return {
        status: "created",
        transactionId,
      };
    });
  };
}

export async function createTransactionFromRealizedOpportunity({ opportunityId = "", transactionPayload = {} } = {}) {
  const [{ collection, doc, runTransaction }, { auth, db }] = await Promise.all([
    import("firebase/firestore"),
    import("../firebase.js"),
  ]);
  const adapter = createOpportunityTransactionAdapter({
    transactionRunner: (callback) => runTransaction(db, callback),
    createDocRef: (collectionName, id = "") => (id ? doc(db, collectionName, id) : doc(collection(db, collectionName))),
    resolveOwnerUid: () => requireCurrentUid(auth),
  });

  return adapter({ opportunityId, transactionPayload });
}
