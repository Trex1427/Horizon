import { useCallback, useEffect, useState } from "react";
import {
  archiveWorkQuote, createWorkQuote, subscribeToWorkDocuments,
  softDeleteWorkQuote, subscribeToWorkQuotes, updateWorkQuote,
} from "../services/workQuotesService.js";

export function useWorkQuotes({ includeDocuments = true } = {}) {
  const [quotes, setQuotes] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let quotesReady = false;
    let documentsReady = !includeDocuments;
    const ready = () => setLoading(!(quotesReady && documentsReady));
    const unsubscribeQuotes = subscribeToWorkQuotes((data) => { quotesReady = true; setQuotes(data); ready(); }, (err) => { setError(err?.message || "Chargement des devis impossible."); setLoading(false); });
    const unsubscribeDocuments = includeDocuments
      ? subscribeToWorkDocuments((data) => { documentsReady = true; setDocuments(data); ready(); }, (err) => { setError(err?.message || "Chargement des documents impossible."); setLoading(false); })
      : () => {};
    return () => { unsubscribeQuotes(); unsubscribeDocuments(); };
  }, [includeDocuments]);
  const run = useCallback(async (operation) => {
    try { setError(""); return { success: true, value: await operation() }; }
    catch (err) { const message = err?.message || "Opération impossible."; setError(message); return { success: false, error: message }; }
  }, []);
  return {
    quotes, documents, loading, error,
    addQuote: useCallback((payload, file) => run(() => createWorkQuote(payload, file)), [run]),
    editQuote: useCallback((id, payload) => run(() => updateWorkQuote(id, payload)), [run]),
    archiveQuote: useCallback((id, documentId) => run(() => archiveWorkQuote(id, documentId)), [run]),
    deleteQuote: useCallback((id) => run(() => softDeleteWorkQuote(id)), [run]),
  };
}
