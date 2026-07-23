import process from "node:process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { initializeApp } from "firebase/app";
import { collection, getDocs, getFirestore, query } from "firebase/firestore";

const TRANSACTIONS_COLLECTION = "transactions";
const LEGACY_TRANSFER_TYPES = new Set(["virement", "transfer", "transfert"]);

function normalizeRawType(value) {
  return String(value || "").trim().toLowerCase();
}

function parseArgs(argv) {
  return {
    asJson: argv.includes("--json"),
  };
}

function loadDotEnvValue(filePath, key) {
  try {
    const content = readFileSync(filePath, "utf8");
    const line = content.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));

    if (!line) {
      return undefined;
    }

    return line.slice(key.length + 1).trim();
  } catch {
    return undefined;
  }
}

function loadFirebaseClientConfig(envFilePath) {
  return {
    apiKey: process.env.VITE_FIREBASE_API_KEY || loadDotEnvValue(envFilePath, "VITE_FIREBASE_API_KEY"),
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN || loadDotEnvValue(envFilePath, "VITE_FIREBASE_AUTH_DOMAIN"),
    projectId:
      process.env.FIREBASE_PROJECT_ID ||
      process.env.GCLOUD_PROJECT ||
      process.env.VITE_FIREBASE_PROJECT_ID ||
      loadDotEnvValue(envFilePath, "FIREBASE_PROJECT_ID") ||
      loadDotEnvValue(envFilePath, "VITE_FIREBASE_PROJECT_ID"),
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET || loadDotEnvValue(envFilePath, "VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId:
      process.env.VITE_FIREBASE_MESSAGING_SENDER_ID || loadDotEnvValue(envFilePath, "VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: process.env.VITE_FIREBASE_APP_ID || loadDotEnvValue(envFilePath, "VITE_FIREBASE_APP_ID"),
  };
}

async function main() {
  const { asJson } = parseArgs(process.argv.slice(2));
  const envFilePath = resolve(process.cwd(), ".env");
  const clientConfig = loadFirebaseClientConfig(envFilePath);

  if (!clientConfig.projectId || !clientConfig.apiKey || !clientConfig.appId) {
    console.error("Missing Firebase web config in environment/.env.");
    process.exit(1);
  }

  const app = initializeApp(clientConfig);
  const db = getFirestore(app);
  const snapshot = await getDocs(query(collection(db, TRANSACTIONS_COLLECTION)));

  const legacyTransactions = snapshot.docs
    .map((docSnapshot) => ({ id: docSnapshot.id, ...docSnapshot.data() }))
    .filter((transaction) => LEGACY_TRANSFER_TYPES.has(normalizeRawType(transaction.type)));

  const groupedByType = legacyTransactions.reduce((accumulator, transaction) => {
    const key = normalizeRawType(transaction.type);
    accumulator[key] = accumulator[key] || 0;
    accumulator[key] += 1;
    return accumulator;
  }, {});

  const report = {
    scannedCount: snapshot.docs.length,
    legacyTransferLikeCount: legacyTransactions.length,
    groupedByType,
    transactions: legacyTransactions.map((transaction) => ({
      id: transaction.id,
      date: transaction.date || null,
      montant: Number(transaction.montant || 0),
      type: transaction.type,
      accountId: transaction.accountId || null,
      destinationAccountId: transaction.destinationAccountId || null,
      description: transaction.description || "",
    })),
  };

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Transactions scanned: ${report.scannedCount}`);
  console.log(`Legacy transfer-like transactions found: ${report.legacyTransferLikeCount}`);
  Object.entries(report.groupedByType).forEach(([type, count]) => {
    console.log(`- ${type}: ${count}`);
  });

  if (report.transactions.length > 0) {
    console.log("\nReview list:");
    report.transactions.forEach((transaction) => {
      console.log(`${transaction.id} | ${transaction.date || "n/a"} | ${transaction.type} | ${transaction.montant}`);
    });
  }
}

main().catch((error) => {
  console.error("Legacy transfer audit failed", error);
  process.exit(1);
});
