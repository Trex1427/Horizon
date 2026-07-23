import process from "node:process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";

const SERVICE_ACCOUNT_PATH = resolve(process.cwd(), "scripts/maintenance/service-account.json");
const SCRIPT_PATH = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  const options = {
    reportPath: "artifacts/security/owner-uid-migration-emulator.json",
    reportDir: "artifacts/security",
    outputName: "owner-uid-rollback-emulator.json",
  };
  for (const arg of argv) {
    if (arg.startsWith("--owner-uid=")) {
      options.ownerUid = arg.slice("--owner-uid=".length);
    } else if (arg.startsWith("--project-id=")) {
      options.projectId = arg.slice("--project-id=".length);
    } else if (arg.startsWith("--database-id=")) {
      options.databaseId = arg.slice("--database-id=".length);
    } else if (arg.startsWith("--migration-report=")) {
      options.reportPath = arg.slice("--migration-report=".length);
    } else if (arg.startsWith("--report-dir=")) {
      options.reportDir = arg.slice("--report-dir=".length);
    } else if (arg.startsWith("--output-name=")) {
      options.outputName = arg.slice("--output-name=".length);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  options.ownerUid ||= process.env.MIGRATION_OWNER_UID;
  options.projectId ||= process.env.MIGRATION_PROJECT_ID;
  options.databaseId ||= process.env.MIGRATION_DATABASE_ID || "(default)";
  return options;
}

function validateOptions(options) {
  if (!options.ownerUid || /\s/.test(options.ownerUid) || !/^[A-Za-z0-9_-]{10,128}$/.test(options.ownerUid)) {
    throw new Error("A valid --owner-uid or MIGRATION_OWNER_UID is required.");
  }
  if (!options.projectId) {
    throw new Error("A project id is required.");
  }
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("Rollback is Emulator-only in this sprint. FIRESTORE_EMULATOR_HOST is required.");
  }
}

async function getDb(projectId) {
  if (!getApps().length) {
    let credential;
    try {
      const serviceAccount = JSON.parse(await readFile(SERVICE_ACCOUNT_PATH, "utf8"));
      credential = cert(serviceAccount);
    } catch {
      credential = undefined;
    }
    initializeApp({ projectId, ...(credential ? { credential } : {}) });
  }
  return getFirestore();
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function runRollback(rawOptions) {
  const options = { ...rawOptions };
  validateOptions(options);
  const report = await readJson(resolve(process.cwd(), options.reportPath));
  if (report.projectId !== options.projectId) {
    throw new Error(`Migration report projectId mismatch. Expected ${options.projectId}, got ${report.projectId}.`);
  }
  if (report.databaseId !== options.databaseId) {
    throw new Error(`Migration report databaseId mismatch. Expected ${options.databaseId}, got ${report.databaseId}.`);
  }
  if (report.ownerUidTarget !== options.ownerUid) {
    throw new Error("Migration report ownerUid does not match rollback ownerUid.");
  }
  if (!["EMULATOR_OWNERUID_MIGRATION_APPLIED", "EMULATOR_OWNERUID_MIGRATION_INTERRUPTED"].includes(report.verdict)) {
    throw new Error(`Rollback requires an Emulator migration report, got ${report.verdict}.`);
  }

  const rollbackPlan = buildRollbackPlan(report);
  const rollbackTargets = rollbackPlan.rollbackTargets;
  const db = await getDb(options.projectId);
  let deleted = 0;
  const skipped = [];

  for (const operation of rollbackTargets) {
    const ref = db.doc(operation.path);
    const snapshot = await ref.get();
    const data = snapshot.data() || {};
    if (data.ownerUid !== options.ownerUid) {
      skipped.push({ path: operation.path, reason: "ownerUid is absent or different" });
      continue;
    }
    await ref.update({ ownerUid: FieldValue.delete() });
    deleted += 1;
  }

  const rollbackReport = {
    generatedAt: new Date().toISOString(),
    projectId: options.projectId,
    databaseId: options.databaseId,
    migrationReport: resolve(process.cwd(), options.reportPath),
    ownerUidTarget: options.ownerUid,
    productionWrites: 0,
    emulatorWrites: deleted,
    rollbackTargets: rollbackTargets.map((operation) => operation.path),
    skipped,
    verdict: skipped.length === 0 ? "EMULATOR_OWNERUID_ROLLBACK_APPLIED" : "EMULATOR_OWNERUID_ROLLBACK_REVIEW_REQUIRED",
  };

  const reportDir = resolve(process.cwd(), options.reportDir);
  await mkdir(reportDir, { recursive: true });
  const outputPath = resolve(reportDir, options.outputName);
  await writeFile(outputPath, `${JSON.stringify(rollbackReport, null, 2)}\n`, "utf8");
  console.log(`OwnerUid rollback report written: ${outputPath}`);
  console.log(`Verdict: ${rollbackReport.verdict}`);
  return rollbackReport;
}

export function buildRollbackPlan(report) {
  const plannedOperations = report.appliedOperations || report.plannedOperations || [];
  const writeCount = Math.min(report.emulatorWrites || 0, plannedOperations.length);
  const rollbackTargets = plannedOperations.slice(0, writeCount);
  return {
    writeCount,
    rollbackTargets,
    secondRollbackWouldWrite: 0,
  };
}

export async function runRollbackCli(argv = process.argv.slice(2)) {
  return runRollback(parseArgs(argv));
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  runRollbackCli().catch((error) => {
    console.error(error?.message || String(error));
    process.exitCode = 1;
  });
}
