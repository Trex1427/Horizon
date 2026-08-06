/* eslint-disable react-hooks/set-state-in-effect -- listener lifecycle owns loading/error state transitions */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { importWorkInvoice, inspectWorkInvoiceDeletion, markWorkInvoicePaid, markWorkInvoicePaidWithTransaction, markWorkInvoicePending, softDeleteWorkInvoice, subscribeToWorkInvoices } from "../services/workInvoicesService.js";
export function useWorkInvoices() {
	const { uid } = useAuth();
	const [invoices, setInvoices] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		setLoading(true);
		setError("");

		if (!uid) {
			setLoading(false);
			return undefined;
		}

		return subscribeToWorkInvoices(
			(items) => {
				setInvoices(items);
				setLoading(false);
				setError("");
			},
			(err) => {
				setError(err?.message || "Chargement des factures impossible.");
				setLoading(false);
			},
			{ ownerUid: uid }
		);
	}, [uid]);

	const run = useCallback(async (operation) => {
		try {
			return { success: true, value: await operation() };
		} catch (err) {
			const message = err?.message || "Opération impossible.";
			return { success: false, error: message };
		}
	}, []);

	return {
		invoices,
		loading,
		error,
		importInvoice: useCallback((payload, file) => run(() => importWorkInvoice(payload, file)), [run]),
		markPaid: useCallback((invoice) => run(() => markWorkInvoicePaid(invoice.id)), [run]),
		markPaidWithTransaction: useCallback((invoice, payload) => run(() => markWorkInvoicePaidWithTransaction(invoice.id, payload)), [run]),
		markPending: useCallback((invoice, options) => run(() => markWorkInvoicePending(invoice.id, options)), [run]),
		inspectDelete: useCallback((invoice) => run(() => inspectWorkInvoiceDeletion(invoice)), [run]),
		deleteInvoice: useCallback((invoice, options) => run(() => softDeleteWorkInvoice(invoice.id, options)), [run]),
	};
}
