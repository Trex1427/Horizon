import process from "node:process";
import { runMigrationCli } from "./migrate-owner-uid.mjs";
import { runRollback } from "./rollback-owner-uid.mjs";

const OWNER_UID = "ownerUidFixture123";
const PROJECT_ID = "budget-alexandre";
const DATABASE_ID = "(default)";

async function main() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("FIRESTORE_EMULATOR_HOST is required.");
  }

  const migrationReport = await runMigrationCli([
    "--apply",
    "--seed-fixture",
    `--owner-uid=${OWNER_UID}`,
    `--project-id=${PROJECT_ID}`,
    `--database-id=${DATABASE_ID}`,
    "--fixture-path=tmp/owner-uid-emulator-backup",
    "--report-name=owner-uid-migration-emulator.json",
    "--markdown-name=OWNER_UID_MIGRATION_EMULATOR.md",
    "--batch-size=100",
  ]);

  if (migrationReport.verdict !== "EMULATOR_OWNERUID_MIGRATION_APPLIED") {
    throw new Error(`Migration did not apply cleanly: ${migrationReport.verdict}`);
  }

  const idempotenceReport = await runMigrationCli([
    "--apply",
    "--fixture-review-mode",
    `--owner-uid=${OWNER_UID}`,
    `--project-id=${PROJECT_ID}`,
    `--database-id=${DATABASE_ID}`,
    "--backup-path=tmp/owner-uid-emulator-backup",
    "--report-name=owner-uid-migration-emulator-idempotence.json",
    "--markdown-name=OWNER_UID_MIGRATION_EMULATOR_IDEMPOTENCE.md",
    "--batch-size=100",
  ]);

  if (idempotenceReport.emulatorWrites !== 0) {
    throw new Error(`Second migration pass should write 0 documents, wrote ${idempotenceReport.emulatorWrites}.`);
  }

  const rollbackReport = await runRollback({
    ownerUid: OWNER_UID,
    projectId: PROJECT_ID,
    databaseId: DATABASE_ID,
    reportPath: "artifacts/security/owner-uid-migration-emulator.json",
    reportDir: "artifacts/security",
    outputName: "owner-uid-rollback-emulator.json",
  });

  if (rollbackReport.verdict !== "EMULATOR_OWNERUID_ROLLBACK_APPLIED") {
    throw new Error(`Rollback did not apply cleanly: ${rollbackReport.verdict}`);
  }
  if (rollbackReport.emulatorWrites !== migrationReport.emulatorWrites) {
    throw new Error(`Rollback write count mismatch: ${rollbackReport.emulatorWrites} vs ${migrationReport.emulatorWrites}.`);
  }
}

main().catch((error) => {
  console.error(error?.message || String(error));
  process.exitCode = 1;
});
