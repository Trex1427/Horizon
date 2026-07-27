import { useEffect, useState } from "react";
import { subscribeToLinkedWorkProjectTransactions } from "../services/workProjectTransactionsService.js";

export function useWorkProjectTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => subscribeToLinkedWorkProjectTransactions(
    (data) => { setTransactions(data); setLoading(false); setError(""); },
    (err) => { setError(err?.message || "Chargement des transactions liées impossible."); setLoading(false); },
  ), []);
  return { transactions, loading, error };
}