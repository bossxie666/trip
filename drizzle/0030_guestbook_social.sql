ALTER TABLE guestbook_messages ADD COLUMN visibility TEXT NOT NULL DEFAULT 'all' CHECK (visibility IN ('all', 'selected'));
CREATE TABLE guestbook_message_members (
  message_id TEXT NOT NULL REFERENCES guestbook_messages(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, member_id)
);
CREATE INDEX idx_guestbook_members_member ON guestbook_message_members(member_id, message_id);
CREATE TABLE guestbook_likes (
  message_id TEXT NOT NULL REFERENCES guestbook_messages(id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (message_id, member_id)
);
CREATE TABLE guestbook_replies (
  id TEXT PRIMARY KEY NOT NULL,
  message_id TEXT NOT NULL REFERENCES guestbook_messages(id) ON DELETE CASCADE,
  author_member_id TEXT NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);
CREATE INDEX idx_guestbook_replies_message ON guestbook_replies(message_id, deleted_at, created_at);
