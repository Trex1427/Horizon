import { initializeApp } from "firebase/app";
import { connectFirestoreEmulator, getFirestore, query, collection, where, getDocs } from "firebase/firestore";
import { loadEnvFile } from "../safety/loadEnvFile.mjs";

const TEST_MARKER = "UX-EMULATOR-TEST-DATA";

function readRequiredEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) {
    throw new Error(`Missing required env variable: ${name}`);
  }

  return value;
}

async function main() {
  loadEnvFile(".env.test");

  const firebaseConfig = {
    apiKey: readRequiredEnv("VITE_FIREBASE_API_KEY"),
    authDomain: readRequiredEnv("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: readRequiredEnv("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: readRequiredEnv("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: readRequiredEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: readRequiredEnv("VITE_FIREBASE_APP_ID"),
  };

  const host = readRequiredEnv("VITE_FIRESTORE_EMULATOR_HOST");
  const port = Number(readRequiredEnv("VITE_FIRESTORE_EMULATOR_PORT"));

  const app = initializeApp(firebaseConfig, "local-app-read-emulator");
  const db = getFirestore(app);
  connectFirestoreEmulator(db, host, port);

  const accountsQuery = query(collection(db, "accounts"), where("testMarker", "==", TEST_MARKER));
  const categoriesQuery = query(collection(db, "categories"), where("testMarker", "==", TEST_MARKER));

  const [accountsSnap, categoriesSnap] = await Promise.all([
    getDocs(accountsQuery),
    getDocs(categoriesQuery),
  ]);

  if (accountsSnap.empty || categoriesSnap.empty) {
    throw new Error("Local app read check failed: expected seeded emulator documents were not found");
  }

  console.log(JSON.stringify({
    result: "success",
    mode: "emulator",
    projectId: firebaseConfig.projectId,
    accountsFound: accountsSnap.size,
    categoriesFound: categoriesSnap.size,
  }, null, 2));
}

main().catch((error) => {
  console.error("LOCAL_APP_READ_CHECK_FAILED");
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
