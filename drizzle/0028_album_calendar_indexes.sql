CREATE INDEX IF NOT EXISTS `idx_album_media_calendar` ON `album_media` (`album_id`,substr(coalesce(`captured_at`,`created_at`),1,10) DESC,`sort_order`,`media_asset_id`);
CREATE INDEX IF NOT EXISTS `idx_album_media_favorite_calendar` ON `album_media` (`album_id`,`is_favorite`,substr(coalesce(`captured_at`,`created_at`),1,10) DESC,`sort_order`,`media_asset_id`);
