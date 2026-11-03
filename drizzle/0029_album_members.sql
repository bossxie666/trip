CREATE TABLE album_members (
  album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (album_id, member_id)
);
CREATE INDEX idx_album_members_member ON album_members(member_id, album_id);
INSERT OR IGNORE INTO album_members SELECT id, created_by_member_id FROM albums;
INSERT OR IGNORE INTO album_members SELECT a.id, tm.member_id FROM albums a JOIN trip_members tm ON tm.trip_id=a.trip_id;
