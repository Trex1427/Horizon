import { useTransactionsContext } from "../context/TransactionsContext";

export function useTransactions() {
  return useTransactionsContext();
}
