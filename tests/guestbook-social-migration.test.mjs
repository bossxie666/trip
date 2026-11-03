import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";

test("guestbook migration retains historic shared messages and cascades social records", () => {
  const db = new DatabaseSync(":memory:");
  try {
    db.exec("PRAGMA foreign_keys=ON;CREATE TABLE members(id TEXT PRIMARY KEY);CREATE TABLE guestbook_messages(id TEXT PRIMARY KEY,body TEXT);INSERT INTO members VALUES('owner'),('guest');INSERT INTO guestbook_messages VALUES('old','unchanged');");
    db.exec(readFileSync(new URL("../migrations/0016_guestbook_social.sql", import.meta.url), "utf8"));
    assert.deepEqual({ ...db.prepare("SELECT body,visibility FROM guestbook_messages").get() }, { body: "unchanged", visibility: "all" });
    db.exec("INSERT INTO guestbook_message_members VALUES('old','owner');INSERT INTO guestbook_likes VALUES('old','guest','now');INSERT INTO guestbook_replies VALUES('reply','old','guest','hello','now',NULL);");
    assert.throws(() => db.exec("INSERT INTO guestbook_likes VALUES('old','guest','again')"), /UNIQUE/);
    assert.throws(() => db.exec("INSERT INTO guestbook_message_members VALUES('old','missing')"), /FOREIGN KEY/);
    assert.throws(() => db.exec("UPDATE guestbook_messages SET visibility='invalid'"), /CHECK/);
    db.exec("DELETE FROM guestbook_messages WHERE id='old'");
    for (const table of ["guestbook_message_members", "guestbook_likes", "guestbook_replies"]) assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count, 0);
  } finally { db.close(); }
});
