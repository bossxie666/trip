import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
test("album member migration inherits old trip access once and keeps unlinked albums private",()=>{
  const db=new DatabaseSync(":memory:");
  try{
    db.exec("PRAGMA foreign_keys=ON; CREATE TABLE members(id TEXT PRIMARY KEY);CREATE TABLE albums(id TEXT PRIMARY KEY,created_by_member_id TEXT,trip_id TEXT);CREATE TABLE trip_members(trip_id TEXT,member_id TEXT);INSERT INTO members VALUES('owner'),('guest'),('other');INSERT INTO albums VALUES('linked','owner','trip'),('unlinked','other',NULL);INSERT INTO trip_members VALUES('trip','owner'),('trip','guest');");
    db.exec(readFileSync(new URL("../migrations/0015_album_members.sql",import.meta.url),"utf8"));
    const members=id=>db.prepare("SELECT member_id FROM album_members WHERE album_id=? ORDER BY member_id").all(id).map(row=>row.member_id);
    assert.deepEqual(members("linked"),["guest","owner"]);assert.deepEqual(members("unlinked"),["other"]);
    db.exec("DELETE FROM trip_members;INSERT INTO trip_members VALUES('trip','other');");
    assert.deepEqual(members("linked"),["guest","owner"]);
    assert.throws(()=>db.exec("INSERT INTO album_members VALUES('linked','missing');"),/FOREIGN KEY/);
    db.exec("DELETE FROM albums WHERE id='linked';");assert.deepEqual(members("linked"),[]);
  }finally{db.close();}
});
