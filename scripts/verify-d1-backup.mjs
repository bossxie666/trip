import { prepareD1Restore } from "./prepare-d1-restore.mjs";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const quote = value => `"${value.replaceAll('"', '""')}"`;
const tables = db => db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all().map(row => row.name);
function foreignKeys(db, name) {
  return db.prepare(`PRAGMA foreign_key_list(${quote(name)})`).all().map(row => JSON.stringify([row.table, row.from, row.to, row.on_update, row.on_delete])).sort();
}
function currentSchema() {
  const db = new DatabaseSync(":memory:");
  try {
    const directory = fileURLToPath(new URL("../migrations/", import.meta.url));
    for (const name of readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) db.exec(readFileSync(resolve(directory, name), "utf8"));
    return tables(db).map(name => ({ name, columns: db.prepare(`PRAGMA table_info(${quote(name)})`).all().map(column => column.name),
      foreignKeys: foreignKeys(db, name), indexes: db.prepare(`PRAGMA index_list(${quote(name)})`).all().filter(index => !index.name.startsWith("sqlite_")).map(index => index.name) }));
  } finally { db.close(); }
}

/** Restore only to disposable local memory. Never connects to D1 or writes source data. */
export function verifyD1Backup(bytes, expected) {
  if (!bytes.length) throw new Error("BACKUP_EMPTY");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (expected && expected.sha256 !== sha256) throw new Error("BACKUP_CHECKSUM_MISMATCH");
  const db = new DatabaseSync(":memory:");
  try {
    // D1 exports can insert child rows before the parent TABLE is created.
    // SQLite cannot defer a missing table, so import locally with enforcement off,
    // then explicitly check every foreign key before accepting the backup.
    db.exec("PRAGMA foreign_keys=OFF; BEGIN;");
    db.exec(bytes.toString("utf8"));
    const actualTables = new Set(tables(db));
    for (const table of currentSchema()) {
      if (!actualTables.has(table.name)) throw new Error(`BACKUP_MISSING_TABLE:${table.name}`);
      const actualColumns = new Set(db.prepare(`PRAGMA table_info(${quote(table.name)})`).all().map(column => column.name));
      if (table.columns.some(column => !actualColumns.has(column))) throw new Error(`BACKUP_MISSING_COLUMN:${table.name}`);
      if (JSON.stringify(table.foreignKeys) !== JSON.stringify(foreignKeys(db, table.name))) throw new Error(`BACKUP_FOREIGN_KEY_SCHEMA:${table.name}`);
      const indexes = new Set(db.prepare(`PRAGMA index_list(${quote(table.name)})`).all().map(index => index.name));
      if (table.indexes.some(index => !indexes.has(index))) throw new Error(`BACKUP_MISSING_INDEX:${table.name}`);
    }
    if (db.prepare("PRAGMA foreign_key_check").all().length) throw new Error("BACKUP_FOREIGN_KEY_FAILURE");
    if (db.prepare("PRAGMA integrity_check").all().some(row => Object.values(row)[0] !== "ok")) throw new Error("BACKUP_INTEGRITY_FAILURE");
    const counts = Object.fromEntries([...actualTables].sort().map(name => [name, db.prepare(`SELECT count(*) AS count FROM ${quote(name)}`).get().count]));
    if (!counts.members) throw new Error("BACKUP_NO_MEMBERS");
    db.exec("COMMIT; PRAGMA foreign_keys=ON;");
    const result = { version: 1, sha256, byteSize: bytes.length, tables: counts };
    if (expected && JSON.stringify(expected.tables) !== JSON.stringify(counts)) throw new Error("BACKUP_COUNTS_MISMATCH");
    return result;
  } finally { db.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const restoreIndex = args.indexOf("--restore");
  const restorePath = restoreIndex < 0 ? undefined : args.splice(restoreIndex, 2)[1];
  const [input, output, expectedPath] = args;
  if (!input || !output) throw new Error("Usage: node scripts/verify-d1-backup.mjs input.sql report.json [expected-report.json] [--restore output.sql]");
  try {
    if (resolve(input) === resolve(output) || (expectedPath && resolve(expectedPath) === resolve(output))) throw new Error("BACKUP_OUTPUT_CONFLICT");
    const bytes = readFileSync(input);
    const report = verifyD1Backup(bytes, expectedPath ? JSON.parse(readFileSync(expectedPath, "utf8")) : undefined);
    if (restorePath) {
      if ([input, output, expectedPath].filter(Boolean).some(path => resolve(path) === resolve(restorePath))) throw new Error("BACKUP_OUTPUT_CONFLICT");
      const prepared = prepareD1Restore(bytes);
      const restored = verifyD1Backup(prepared);
      if (JSON.stringify(restored.tables) !== JSON.stringify(report.tables)) throw new Error("BACKUP_COUNTS_MISMATCH");
      writeFileSync(restorePath, prepared, { mode: 0o600 });
    }
    writeFileSync(output, JSON.stringify(report, null, 2) + "\n", { mode: 0o600 });
    console.log(`Backup restored and verified locally: ${Object.keys(report.tables).length} tables, ${report.byteSize} bytes.`);
  } catch (error) {
    // SQLite errors can quote SQL values. Keep private database content out of CI logs.
    const code = error instanceof Error && /^BACKUP_[A-Z_]+(?::[a-z_]+)?$/.test(error.message) ? error.message : "BACKUP_RESTORE_FAILED";
    console.error(code);
    process.exitCode = 1;
  }
}
