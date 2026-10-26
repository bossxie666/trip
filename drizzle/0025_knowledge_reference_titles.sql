-- Preserve deliberate itinerary names while following the shared source.
ALTER TABLE itinerary_items ADD COLUMN knowledge_title_override text;
UPDATE itinerary_items
SET knowledge_title_override=title
WHERE knowledge_entry_id IS NOT NULL
  AND title<>(SELECT title FROM knowledge_entries WHERE id=itinerary_items.knowledge_entry_id)
  AND (place_id IS NULL OR title<>(SELECT name FROM places WHERE id=itinerary_items.place_id));
