import {
  collection, doc, getDoc, onSnapshot, query, runTransaction, serverTimestamp, updateDoc, where,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { requireCurrentUid } from "../auth/requireCurrentUid.js";
import { buildImportedInvoiceProjectPayload, buildWorkProjectPayload, normalizeWorkProjectUpdate, sortWorkProjects } from "../features/work/workProjectModel.js";

const PROJECTS = "workProjects";
const QUOTES = "workQuotes";

export function subscribeToWorkProjects(onData, onError) {
  const ownerUid = requireCurrentUid(auth);
  return onSnapshot(query(collection(db, PROJECTS), where("ownerUid", "==", ownerUid)), (snapshot) => {
    const projects = snapshot.docs
      .map((entry) => ({ id: entry.id, ...entry.data() }))
      .filter((entry) => !entry.deletedAt);
    onData(sortWorkProjects(projects));
  }, onError);
}

export function createWorkProjectFromQuote(quote, { thirdPartyName = "" } = {}) {
  const ownerUid = requireCurrentUid(auth);
  const quoteRef = doc(db, QUOTES, quote.id);
  const projectRef = doc(db, PROJECTS, quote.id);

  return runTransaction(db, async (transaction) => {
    const quoteSnapshot = await transaction.get(quoteRef);
    const projectSnapshot = await transaction.get(projectRef);
    if (!quoteSnapshot.exists()) throw new Error("Devis introuvable.");

    const currentQuote = { id: quoteSnapshot.id, ...quoteSnapshot.data() };
    if (currentQuote.ownerUid !== ownerUid) throw new Error("Accès au devis refusé.");
    if (currentQuote.status !== "accepted") throw new Error("Seul un devis accepté peut créer un dossier.");

    if (currentQuote.projectId) {
      return { id: currentQuote.projectId, created: false };
    }
    if (projectSnapshot.exists()) {
      if (projectSnapshot.data().ownerUid !== ownerUid) throw new Error("Accès au dossier refusé.");
      transaction.update(quoteRef, { projectId: projectRef.id, updatedAt: new Date() });
      return { id: projectRef.id, created: false };
    }

    const now = new Date();
    transaction.set(projectRef, buildWorkProjectPayload(currentQuote, { ownerUid, thirdPartyName, now }));
    transaction.update(quoteRef, { projectId: projectRef.id, updatedAt: now });
    return { id: projectRef.id, created: true };
  }).catch(async (error) => {
    const [quoteSnapshot, thirdPartySnapshot, activitySnapshot, legacyActivitySnapshot] = await Promise.all([
      getDoc(quoteRef), getDoc(doc(db, "thirdParties", quote.thirdPartyId)),
      getDoc(doc(db, "professionalActivities", quote.professionalActivityId)), getDoc(doc(db, "activities", quote.professionalActivityId)),
    ]);
    const storedQuote = quoteSnapshot.exists() ? { id: quoteSnapshot.id, ...quoteSnapshot.data() } : null;
    const payload = storedQuote ? buildWorkProjectPayload(storedQuote, { ownerUid, thirdPartyName, now: new Date() }) : null;
    console.error("work_project_create_from_quote_failed", {
      firebaseCode: error?.code || null, firebaseMessage: error?.message || String(error), payload,
      quoteId: quote.id, expectedProjectId: projectRef.id, quoteExists: quoteSnapshot.exists(),
      storedQuoteStatus: storedQuote?.status ?? null, ownerUid: storedQuote?.ownerUid ?? null,
      thirdPartyId: storedQuote?.thirdPartyId ?? null, professionalActivityId: storedQuote?.professionalActivityId ?? null,
      status: storedQuote?.status ?? null, plannedRevenue: payload?.plannedRevenue ?? null,
      quoteOwnerUid: storedQuote?.ownerUid ?? null, thirdPartyOwnerUid: thirdPartySnapshot.exists() ? thirdPartySnapshot.data().ownerUid ?? null : null,
      professionalActivityOwnerUid: activitySnapshot.exists() ? activitySnapshot.data().ownerUid ?? null : null,
      legacyActivityOwnerUid: legacyActivitySnapshot.exists() ? legacyActivitySnapshot.data().ownerUid ?? null : null,
    });
    throw new Error(`Création du dossier impossible${error?.code ? ` (${error.code})` : ""} : ${error?.message || "erreur Firestore inconnue"}`, { cause: error });
  });
}
export async function createWorkProjectFromInvoice(payload) {
  const ownerUid = requireCurrentUid(auth);
  const projectRef = doc(collection(db, PROJECTS));
  const project = buildImportedInvoiceProjectPayload(payload, { ownerUid });
  await runTransaction(db, async (transaction) => {
    const thirdParty = await transaction.get(doc(db, "thirdParties", project.thirdPartyId));
    const activity = await transaction.get(doc(db, "professionalActivities", project.professionalActivityId));
    if (!thirdParty.exists() || thirdParty.data().ownerUid !== ownerUid) throw new Error("Client introuvable.");
    if (!activity.exists() || activity.data().ownerUid !== ownerUid) throw new Error("Activité professionnelle introuvable.");
    transaction.set(projectRef, project);
  });
  return { id: projectRef.id, created: true };
}
export async function updateWorkProject(projectId, payload) {
  const ownerUid = requireCurrentUid(auth);
  const projectRef = doc(db, PROJECTS, projectId);
  const snapshot = await getDoc(projectRef);
  if (!snapshot.exists()) throw new Error("Dossier introuvable.");
  const project = { id: snapshot.id, ...snapshot.data() };
  if (project.ownerUid !== ownerUid) throw new Error("Accès au dossier refusé.");
  const allowedFields = normalizeWorkProjectUpdate(project, payload);
  await updateDoc(projectRef, { ...allowedFields, updatedAt: serverTimestamp() });
  return allowedFields;
}
