export function parseAllowedFirebaseUids(value = "") {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function isPopupRedirectError(error) {
  const code = String(error?.code || "");
  return [
    "auth/popup-blocked",
    "auth/popup-closed-by-user",
    "auth/cancelled-popup-request",
    "auth/operation-not-supported-in-this-environment",
  ].includes(code);
}

export function mapAuthError(error) {
  const code = String(error?.code || "");

  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
    return "Connexion interrompue. Vous pouvez réessayer.";
  }

  if (code === "auth/popup-blocked") {
    return "La fenêtre de connexion a été bloquée. Horizon va utiliser une redirection sécurisée.";
  }

  if (code === "auth/unauthorized-domain") {
    return "Ce domaine n'est pas autorisé pour la connexion Google.";
  }

  if (code === "auth/account-exists-with-different-credential") {
    return "Ce compte existe déjà avec une autre méthode de connexion.";
  }

  return "Connexion impossible pour le moment. Réessayez dans quelques instants.";
}

export function getAuthorizationState({ uid = "", allowedUids = [], isDevelopment = false } = {}) {
  const normalizedUid = String(uid || "").trim();

  if (!normalizedUid) {
    return {
      isAuthorized: false,
      reason: "missing-user",
      shouldShowLocalDiagnostic: false,
    };
  }

  if (!allowedUids.length) {
    return {
      isAuthorized: Boolean(isDevelopment),
      reason: isDevelopment ? "development-allowlist-empty" : "allowlist-empty",
      shouldShowLocalDiagnostic: Boolean(isDevelopment),
    };
  }

  const isAuthorized = allowedUids.includes(normalizedUid);

  return {
    isAuthorized,
    reason: isAuthorized ? "allowed" : "not-allowed",
    shouldShowLocalDiagnostic: false,
  };
}
