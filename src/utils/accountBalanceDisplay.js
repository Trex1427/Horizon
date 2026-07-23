function normalizeAccountText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getAccountBusinessKey(account) {
  return `${normalizeAccountText(account?.name)}::${normalizeAccountText(account?.type)}`;
}

function isDefaultSeedAccount(account) {
  return String(account?.id || "").startsWith("default-");
}

export function selectAccountsForBalanceDisplay(accounts = []) {
  const activeAccounts = (accounts || []).filter((account) => account?.isActive !== false);
  const canonicalKeys = new Set(
    activeAccounts
      .filter((account) => !isDefaultSeedAccount(account))
      .map(getAccountBusinessKey)
      .filter((key) => key !== "::")
  );
  const seenIds = new Set();

  return activeAccounts.filter((account) => {
    const id = String(account?.id || "");
    if (id && seenIds.has(id)) {
      return false;
    }
    if (id) {
      seenIds.add(id);
    }

    return !(isDefaultSeedAccount(account) && canonicalKeys.has(getAccountBusinessKey(account)));
  });
}
