import process from "node:process";

const PROTECTED_PROJECT_ID = "budget-alexandre";

function readBooleanEnv(name) {
  return String(process.env[name] || "").trim().toLowerCase() === "true";
}

function resolveProjectId(...candidates) {
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (value) {
      return value;
    }
  }

  return "";
}

export function isFirestoreEmulatorExplicitlyActive() {
  const emulatorHost = String(process.env.FIRESTORE_EMULATOR_HOST || "").trim();
  if (emulatorHost) {
    return true;
  }

  return readBooleanEnv("VITE_USE_FIRESTORE_EMULATOR") || readBooleanEnv("USE_FIRESTORE_EMULATOR");
}

export function resolveRuntimeProjectId(explicitProjectId = "") {
  return resolveProjectId(
    explicitProjectId,
    process.env.FIREBASE_PROJECT_ID,
    process.env.GCLOUD_PROJECT,
    process.env.VITE_FIREBASE_PROJECT_ID
  );
}

export function assertAutomatedWriteAllowed({ projectId = "", operationName = "operation" } = {}) {
  const runtimeProjectId = resolveRuntimeProjectId(projectId);
  const emulatorActive = isFirestoreEmulatorExplicitlyActive();

  if (runtimeProjectId === PROTECTED_PROJECT_ID && !emulatorActive) {
    const message = [
      "OPÉRATION AUTOMATISÉE REFUSÉE",
      "Le projet budget-alexandre est protégé.",
      "Utilisez Firestore Emulator.",
      `Operation: ${operationName}`,
    ].join("\n");

    const error = new Error(message);
    error.code = "AUTOMATED_WRITE_REFUSED";
    throw error;
  }
}

export function assertEmulatorWriteMode({ operationName = "operation" } = {}) {
  if (!isFirestoreEmulatorExplicitlyActive()) {
    const error = new Error(
      [
        "OPÉRATION AUTOMATISÉE REFUSÉE",
        "Le projet budget-alexandre est protégé.",
        "Utilisez Firestore Emulator.",
        `Operation: ${operationName}`,
      ].join("\n")
    );
    error.code = "EMULATOR_REQUIRED";
    throw error;
  }
}
