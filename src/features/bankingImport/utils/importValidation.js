export function validateImportAccount(accountId = "") {
  return Boolean(String(accountId || "").trim());
}

export function validatePreviewableFile(file) {
  if (!file) {
    return "Aucun fichier selectionne.";
  }

  if (!file.name) {
    return "Nom de fichier indisponible.";
  }

  return "";
}

export function validateCsvPreview(preview = null) {
  if (!preview) {
    return "Previsualisation indisponible.";
  }

  if (!Array.isArray(preview.headers) || preview.headers.length === 0) {
    return "Le fichier CSV est vide ou ne contient aucun en-tete exploitable.";
  }

  return "";
}