import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, realpathSync, rmSync } from "node:fs";
import { resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { verifyD1Backup } from "./verify-d1-backup.mjs";
import { prepareD1Restore } from "./prepare-d1-restore.mjs";

const project = fileURLToPath(new URL("../", import.meta.url));
const work = resolve(project, "work");
mkdirSync(work, { recursive: true });
const drill = mkdtempSync(resolve(work, "backup-recovery-"));
const cli = resolve(project, "node_modules/wrangler/bin/wrangler.js");
function run(directory, ...args) {
  const result = spawnSync(process.execPath, [cli, "--cwd", directory, ...args], {
    cwd: project, encoding: "utf8", timeout: 60_000,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_LOG_PATH: resolve(drill, "wrangler.log") },
  });
  if (result.error || result.status !== 0) throw new Error("LOCAL_D1_DRILL_COMMAND_FAILED");
}
try {
  const source = resolve(drill, "source"), target = resolve(drill, "target");
  for (const [directory, id] of [[source, "00000000-0000-0000-0000-000000000001"], [target, "00000000-0000-0000-0000-000000000002"]]) {
    mkdirSync(directory);
    writeFileSync(resolve(directory, "wrangler.json"), JSON.stringify({ name: "synthetic-backup-drill", compatibility_date: "2026-05-15", d1_databases: [{ binding: "DB", database_name: "synthetic-backup-drill", database_id: id }] }));
  }
  const migrations = resolve(project, "migrations");
  const seed = readdirSync(migrations).filter(name => name.endsWith(".sql")).sort().map(name => readFileSync(resolve(migrations, name), "utf8")).join("\n");
  writeFileSync(resolve(source, "seed.sql"), seed + "\nINSERT INTO members(id,name,display_name,created_at) VALUES('synthetic-backup','synthetic-backup','quote '' ; -- 中文','2026-01-01');");
  run(source, "d1", "execute", "DB", "--local", "--file", "seed.sql");
  run(source, "d1", "export", "DB", "--local", "--output", "export.sql");
  const original = readFileSync(resolve(source, "export.sql"));
  const before = verifyD1Backup(original);
  writeFileSync(resolve(target, "restore.sql"), prepareD1Restore(original));
  run(target, "d1", "execute", "DB", "--local", "--file", "restore.sql");
  run(target, "d1", "export", "DB", "--local", "--output", "restored.sql");
  const after = verifyD1Backup(readFileSync(resolve(target, "restored.sql")));
  assert.deepEqual(after, before, "Local D1 restore must reproduce every exported byte, schema and row count");
  console.log(`Isolated local D1 recovery passed: ${Object.keys(before.tables).length} tables, identical export checksum.`);
} finally {
  const checked = realpathSync(drill);
  if (dirname(checked) === realpathSync(work) && checked.startsWith(realpathSync(work) + sep)) rmSync(checked, { recursive: true, force: true });
  else { console.error("DRILL_CLEANUP_PATH_REJECTED"); process.exitCode = 1; }
}
