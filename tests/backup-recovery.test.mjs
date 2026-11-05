import test from "node:test";
import { prepareD1Restore } from "../scripts/prepare-d1-restore.mjs";
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { verifyD1Backup } from "../scripts/verify-d1-backup.mjs";

const directory = new URL("../migrations/", import.meta.url);
const migrations = readdirSync(directory).filter(name => name.endsWith(".sql")).sort().map(name => readFileSync(new URL(name, directory), "utf8")).join("\n");
const source = new DatabaseSync(":memory:");
source.exec(migrations);
const schema = source.prepare("SELECT sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type DESC,name").all().map(row => row.sql + ";").join("\n");
const memberTable = source.prepare("SELECT sql FROM sqlite_master WHERE name='members'").get().sql + ";";
const memberIndexes = source.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='members' AND sql IS NOT NULL").all().map(row => row.sql + ";");
source.close();
const member = "INSERT INTO members(id,name,display_name,created_at) VALUES('synthetic','synthetic','Synthetic','2026-01-01');";
const valid = Buffer.from(schema + "\n" + member);

test("backup recovery restores the full current schema and verifies downloaded bytes", () => {
  const report = verifyD1Backup(valid);
  assert.equal(report.tables.members, 1);
  for (const name of ["albums", "album_members", "guestbook_message_members", "member_credentials", "member_sessions", "audit_events", "media_deletion_queue"]) assert.ok(name in report.tables);
  assert.deepEqual(verifyD1Backup(valid, report), report);
  assert.throws(() => verifyD1Backup(Buffer.from(valid.toString() + "\n"), report), /BACKUP_CHECKSUM_MISMATCH/);
  assert.throws(() => verifyD1Backup(valid, { ...report, tables: { members: 99 } }), /BACKUP_COUNTS_MISMATCH/);
});

test("backup recovery rejects empty, partial, corrupt and schema-only exports", () => {
  assert.throws(() => verifyD1Backup(Buffer.alloc(0)), /BACKUP_EMPTY/);
  assert.throws(() => verifyD1Backup(Buffer.from(member)), /no such table/);
  assert.throws(() => verifyD1Backup(Buffer.from("CREATE TABLE members(id);")), /BACKUP_MISSING_TABLE|BACKUP_MISSING_COLUMN/);
  assert.throws(() => verifyD1Backup(Buffer.from(schema)), /BACKUP_NO_MEMBERS/);
  assert.throws(() => verifyD1Backup(Buffer.from(schema + "\n" + member + "\nINCOMPLETE SQL")));
});

test("backup recovery rejects broken member and album references", () => {
  const broken = Buffer.from(schema + "\n" + member + "\nINSERT INTO member_credentials VALUES('missing','pbkdf2',1,'salt','digest','2026-01-01');");
  assert.throws(() => verifyD1Backup(broken), /BACKUP_FOREIGN_KEY_FAILURE/);
});


test("backup recovery checks foreign key declarations and indexes, not just rows", () => {
  const missingIndex = schema.replace("idx_members_name", "idx_members_name_missing");
  assert.ok(missingIndex !== schema);
  assert.throws(() => verifyD1Backup(Buffer.from(missingIndex + "\n" + member)), /BACKUP_MISSING_INDEX:members/);
  const wrongForeignKey = schema.replace("REFERENCES albums(id)", "REFERENCES albums(title)");
  assert.ok(wrongForeignKey !== schema);
  assert.throws(() => verifyD1Backup(Buffer.from(wrongForeignKey + "\n" + member)), /BACKUP_FOREIGN_KEY_SCHEMA:album_members/);
});


test("backup recovery handles D1 exports with child data before parent table creation", () => {
  let childFirst = schema.replace(memberTable, "");
  for (const index of memberIndexes) childFirst = childFirst.replace(index, "");
  const dump = Buffer.from(childFirst + "\nINSERT INTO member_credentials VALUES('synthetic','pbkdf2',1,'salt','digest','2026-01-01');\n" + memberTable + member + memberIndexes.join("\n"));
  const report = verifyD1Backup(dump);
  assert.equal(report.tables.member_credentials, 1);
  assert.equal(report.tables.members, 1);
});


test("D1 restore preparation moves all schema before rows and preserves quoted content", () => {
  const raw = Buffer.from("PRAGMA defer_foreign_keys=TRUE; CREATE TABLE child(id,member_id REFERENCES members(id)); INSERT INTO child VALUES(1,1); CREATE TABLE members(id PRIMARY KEY,name); INSERT INTO members VALUES(1,'quote '' ; -- /* 中文\nend'); CREATE INDEX ix ON child(member_id);");
  const prepared = prepareD1Restore(raw).toString();
  assert.ok(prepared.indexOf("CREATE TABLE members") < prepared.indexOf("INSERT INTO child"));
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys=ON; BEGIN;");
    db.exec(prepared);
    db.exec("COMMIT;");
    assert.equal(db.prepare("SELECT name FROM members").get().name, "quote ' ; -- /* 中文\nend");
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
  } finally { db.close(); }
  assert.throws(() => prepareD1Restore(Buffer.from("CREATE TABLE x(id); INSERT INTO x VALUES('unfinished")), /BACKUP_SQL_INCOMPLETE/);
  assert.throws(() => prepareD1Restore(Buffer.from("DELETE FROM members;")), /BACKUP_SQL_UNSUPPORTED/);
});
