import {
  collection, doc, onSnapshot, query, runTransaction, where,
} from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { requireCurrentUid } from "../auth/requireCurrentUid.js";
import { buildWorkProjectPayload, sortWorkProjects } from "../features/work/workProjectModel.js";

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
  });
}
