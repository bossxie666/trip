-- Recommendation V2: additive only. Existing rows and stable IDs are untouched.
ALTER TABLE recommendations ADD COLUMN guide_type TEXT;
CREATE TABLE recommendation_references (
  id TEXT PRIMARY KEY NOT NULL,
  recommendation_id TEXT NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  author_label TEXT,
  title TEXT,
  source_url TEXT NOT NULL,
  image_urls_json TEXT,
  note TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_recommendation_references_order ON recommendation_references(recommendation_id, sort_order);
