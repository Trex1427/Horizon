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
    displayOrder: 1,
  },
  {
    id: "default-savings-a",
    name: "Livret A",
    type: "savings",
    icon: "🏦",
    color: "#2e7d32",
    initialBalance: 0,
    isActive: true,
    displayOrder: 2,
  },
  {
    id: "default-professional-account",
    name: "Compte professionnel",
    type: "business",
    icon: "💼",
    color: "#7b1fa2",
    initialBalance: 0,
    isActive: true,
    displayOrder: 3,
  },
  {
    id: "default-cash",
    name: "Espèces",
    type: "cash",
    icon: "💵",
    color: "#ef6c00",
    initialBalance: 0,
    isActive: true,
    displayOrder: 4,
  },
  {
    id: "default-paypal",
    name: "PayPal",
    type: "digital",
    icon: "🟣",
    color: "#6a1b9a",
    initialBalance: 0,
    isActive: true,
    displayOrder: 5,
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
