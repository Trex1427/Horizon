export const DEFAULT_ACCOUNT_NAME = "Compte courant";

export const DEFAULT_ACCOUNT_DEFINITIONS = [
  {
    id: "default-current-account",
    name: "Compte courant",
    type: "standard",
    icon: "💳",
    color: "#1976d2",
    initialBalance: 0,
    isActive: true,
    isDefault: true,
    displayOrder: 0,
  },
];

export function buildDefaultAccountDocuments({ now = () => new Date().toISOString() } = {}) {
  const timestamp = now();

  return DEFAULT_ACCOUNT_DEFINITIONS.map(({ id, ...account }) => ({
    id,
    data: {
      ...account,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  }));
}

export async function hasAnyAccountDocumentsWithReader(readFromServer) {
  if (typeof readFromServer !== "function") {
    throw new Error("A server-only account reader is required.");
  }

  const snapshot = await readFromServer();
  return !snapshot.empty;
}

export async function initializeDefaultAccountsIfEmptyWithAdapter(adapter, options = {}) {
  if (!adapter?.hasAnyAccountDocuments || !adapter?.commitDefaultAccounts) {
    throw new Error("A default account initializer adapter is required.");
  }

  const hasAnyDocuments = await adapter.hasAnyAccountDocuments();
  if (hasAnyDocuments) {
    return {
      created: false,
      createdCount: 0,
      skippedReason: "accounts-collection-not-empty",
    };
  }

  const documents = buildDefaultAccountDocuments(options);
  await adapter.commitDefaultAccounts(documents);

  return {
    created: true,
    createdCount: documents.length,
    ids: documents.map((document) => document.id),
  };
}
