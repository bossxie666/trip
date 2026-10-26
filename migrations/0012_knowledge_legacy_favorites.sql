-- Import existing personal favorites while both entry points stay compatible.
INSERT OR IGNORE INTO knowledge_favorites (entry_id,member_id,created_at)
SELECT k.id,s.member_id,s.updated_at
FROM recommendation_member_states s JOIN knowledge_entries k ON k.legacy_recommendation_id=s.recommendation_id
WHERE s.is_favorite=1 AND k.deleted_at IS NULL;
