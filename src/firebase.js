import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  GoogleAuthProvider,
  setPersistence,
} from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

function readBooleanEnv(value) {
  return String(value || "").trim().toLowerCase() === "true";
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account",
});

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("AUTH PERSISTENCE ERROR", { code: error?.code || "unknown" });
});

const emulatorEnabled =
  String(import.meta.env.MODE || "") === "test"
  || readBooleanEnv(import.meta.env.VITE_USE_FIRESTORE_EMULATOR);

if (emulatorEnabled) {
  const host = String(import.meta.env.VITE_FIRESTORE_EMULATOR_HOST || "").trim();
  const port = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT || 8080);

  if (!host) {
    throw new Error("VITE_FIRESTORE_EMULATOR_HOST is required when emulator mode is enabled");
  }

  const globalKey = "__horizon_firestore_emulator_connected__";
  if (!globalThis[globalKey]) {
    connectFirestoreEmulator(db, host, port);
    globalThis[globalKey] = true;
  }

  console.info("FIRESTORE MODE: EMULATOR", { host, port, projectId: firebaseConfig.projectId });
} else {
  console.info("FIRESTORE MODE: REMOTE", { projectId: firebaseConfig.projectId });
}

export { db };
export { auth, googleProvider };
export const storage = getStorage(app);
