UPDATE `trips`
SET `start_date` = '2026-09-23',
	`end_date` = '2026-09-27',
	`timezone` = 'Asia/Shanghai',
	`updated_at` = '2026-09-01T00:00:00.000Z'
WHERE `id` = 'trip-shanghai-hangzhou-2026';
--> statement-breakpoint
INSERT OR IGNORE INTO `days` (`id`, `trip_id`, `day_number`, `date`, `title`, `updated_at`) VALUES
	('trip-shanghai-hangzhou-2026-day-3', 'trip-shanghai-hangzhou-2026', 3, '2026-09-25', '杭州 Day 1 · 灵隐寺 · 财神庙 · 西湖', '2026-09-01T00:00:00.000Z'),
	('trip-shanghai-hangzhou-2026-day-4', 'trip-shanghai-hangzhou-2026', 4, '2026-09-26', '杭州 Day 2 · 桐庐往返', '2026-09-01T00:00:00.000Z'),
	('trip-shanghai-hangzhou-2026-day-5', 'trip-shanghai-hangzhou-2026', 5, '2026-09-27', '杭州 Day 3 · 待定', '2026-09-01T00:00:00.000Z');
--> statement-breakpoint
INSERT OR IGNORE INTO `bookings` (`id`, `trip_id`, `type`, `status`, `title`, `provider`, `temporal_kind`, `start_at`, `end_at`, `start_date_local`, `end_date_local`, `timezone`, `place_id`, `origin_place_id`, `destination_place_id`, `total_amount_minor`, `currency`, `booking_reference`, `notes`, `protected`, `created_by_member_id`, `updated_by_member_id`, `created_at`, `updated_at`, `deleted_at`) VALUES
	('booking-shanghai-hangzhou-flight-szx-sha-20260923', 'trip-shanghai-hangzhou-2026', 'flight', 'confirmed', '深圳 → 上海航班', '金鹏航空', 'interval', '2026-09-22T22:35:00.000Z', '2026-09-23T00:55:00.000Z', '2026-09-23', '2026-09-23', 'Asia/Shanghai', NULL, NULL, NULL, 48000, 'CNY', NULL, '航班号：Y87578', 1, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL),
	('booking-shanghai-hangzhou-hotel-shanghai-20260923', 'trip-shanghai-hangzhou-2026', 'hotel', 'confirmed', '上海南附近酒店', NULL, 'date_range', NULL, NULL, '2026-09-23', '2026-09-24', 'Asia/Shanghai', NULL, NULL, NULL, 23066, 'CNY', NULL, '已确认；具体酒店 POI 暂未绑定', 1, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL),
	('booking-shanghai-hangzhou-hotel-hangzhou-20260924', 'trip-shanghai-hangzhou-2026', 'hotel', 'confirmed', '杭州东附近酒店', NULL, 'date_range', NULL, NULL, '2026-09-24', '2026-09-27', 'Asia/Shanghai', NULL, NULL, NULL, 75280, 'CNY', NULL, '已确认；具体酒店 POI 暂未绑定', 1, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL);
--> statement-breakpoint
INSERT OR IGNORE INTO `booking_cost_lines` (`id`, `booking_id`, `title`, `service_start_date`, `service_end_date`, `amount_minor`, `currency`, `allocation_mode`, `sort_order`, `notes`, `created_at`, `updated_at`) VALUES
	('costline-hangzhou-hotel-first-night', 'booking-shanghai-hangzhou-hotel-hangzhou-20260924', '第一晚', '2026-09-24', '2026-09-25', 17100, 'CNY', 'equal', 1, '朱婧琪不参与第一晚房费', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('costline-hangzhou-hotel-last-two-nights', 'booking-shanghai-hangzhou-hotel-hangzhou-20260924', '后两晚合计', '2026-09-25', '2026-09-27', 58180, 'CNY', 'equal', 2, '当前按5位成员均摊；未来可改为 custom allocation', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
--> statement-breakpoint
INSERT OR IGNORE INTO `booking_cost_allocations` (`id`, `cost_line_id`, `member_id`, `amount_minor`, `notes`, `created_at`, `updated_at`) VALUES
	('allocation-hangzhou-hotel-first-night-nini', 'costline-hangzhou-hotel-first-night', 'member-nini', 4275, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('allocation-hangzhou-hotel-first-night-wang-jingwen', 'costline-hangzhou-hotel-first-night', 'member-wang-jingwen', 4275, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('allocation-hangzhou-hotel-first-night-liu-xu', 'costline-hangzhou-hotel-first-night', 'member-liu-xu', 4275, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('allocation-hangzhou-hotel-first-night-sun-yan', 'costline-hangzhou-hotel-first-night', 'member-sun-yan', 4275, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('allocation-hangzhou-hotel-last-two-nights-nini', 'costline-hangzhou-hotel-last-two-nights', 'member-nini', 11636, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('allocation-hangzhou-hotel-last-two-nights-zhu-jingqi', 'costline-hangzhou-hotel-last-two-nights', 'member-zhu-jingqi', 11636, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('allocation-hangzhou-hotel-last-two-nights-wang-jingwen', 'costline-hangzhou-hotel-last-two-nights', 'member-wang-jingwen', 11636, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('allocation-hangzhou-hotel-last-two-nights-liu-xu', 'costline-hangzhou-hotel-last-two-nights', 'member-liu-xu', 11636, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('allocation-hangzhou-hotel-last-two-nights-sun-yan', 'costline-hangzhou-hotel-last-two-nights', 'member-sun-yan', 11636, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
--> statement-breakpoint
INSERT OR IGNORE INTO `recommendations` (`id`, `trip_id`, `kind`, `category`, `title`, `summary`, `area_label`, `area_key`, `is_core`, `created_by_member_id`, `updated_by_member_id`, `created_at`, `updated_at`, `deleted_at`) VALUES
	('recommendation-shanghai-disney', 'trip-shanghai-hangzhou-2026', 'place', 'attraction', '上海迪士尼', NULL, '上海', 'shanghai', 1, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL),
	('recommendation-wukang-building', 'trip-shanghai-hangzhou-2026', 'place', 'attraction', '武康大楼', NULL, '上海', 'shanghai', 1, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL),
	('recommendation-the-bund', 'trip-shanghai-hangzhou-2026', 'place', 'attraction', '外滩', NULL, '上海', 'shanghai', 1, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL),
	('recommendation-oriental-pearl', 'trip-shanghai-hangzhou-2026', 'place', 'attraction', '东方明珠', NULL, '上海', 'shanghai', 1, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL),
	('recommendation-lingyin-temple', 'trip-shanghai-hangzhou-2026', 'place', 'attraction', '灵隐寺', NULL, '杭州', 'hangzhou', 1, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL),
	('recommendation-caishen-temple', 'trip-shanghai-hangzhou-2026', 'place', 'attraction', '财神庙', NULL, '杭州', 'hangzhou', 1, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL),
	('recommendation-west-lake', 'trip-shanghai-hangzhou-2026', 'place', 'attraction', '西湖', NULL, '杭州', 'hangzhou', 1, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL),
	('recommendation-tonglu-day-guide', 'trip-shanghai-hangzhou-2026', 'guide', 'attraction', '桐庐一日攻略', NULL, '桐庐', 'tonglu', 1, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z', NULL);
--> statement-breakpoint
INSERT OR IGNORE INTO `recommendation_place_options` (`id`, `recommendation_id`, `place_id`, `relation_type`, `option_group_key`, `is_primary`, `sort_order`, `note`, `created_at`, `updated_at`) VALUES
	('rec-option-shanghai-disney-existing-place', 'recommendation-shanghai-disney', 'place-shanghai-disney', 'alternative', 'poi', 1, 1, '复用现有明确匹配地点', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('rec-option-the-bund-existing-place', 'recommendation-the-bund', 'place-the-bund', 'alternative', 'poi', 1, 1, '复用现有明确匹配地点', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('rec-option-oriental-pearl-existing-place', 'recommendation-oriental-pearl', 'place-oriental-pearl', 'alternative', 'poi', 1, 1, '复用现有明确匹配地点', '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
--> statement-breakpoint
INSERT OR IGNORE INTO `itinerary_items` (`id`, `trip_id`, `day_id`, `stage_id`, `recommendation_id`, `place_id`, `origin_place_id`, `destination_place_id`, `item_type`, `title`, `note`, `start_time_local`, `duration_minutes`, `sort_order`, `locked_at`, `created_by_member_id`, `updated_by_member_id`, `created_at`, `updated_at`) VALUES
	('itinerary-shanghai-hangzhou-day1-disney', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-1', 'trip-shanghai-hangzhou-2026-stage-shanghai', 'recommendation-shanghai-disney', 'place-shanghai-disney', NULL, NULL, 'place', '上海迪士尼', NULL, NULL, NULL, 1, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('itinerary-shanghai-hangzhou-day2-wukang-building', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-2', 'trip-shanghai-hangzhou-2026-stage-shanghai', 'recommendation-wukang-building', NULL, NULL, NULL, 'place', '武康大楼', NULL, NULL, NULL, 1, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('itinerary-shanghai-hangzhou-day2-the-bund', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-2', 'trip-shanghai-hangzhou-2026-stage-shanghai', 'recommendation-the-bund', 'place-the-bund', NULL, NULL, 'place', '外滩', NULL, NULL, NULL, 2, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('itinerary-shanghai-hangzhou-day2-oriental-pearl', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-2', 'trip-shanghai-hangzhou-2026-stage-shanghai', 'recommendation-oriental-pearl', 'place-oriental-pearl', NULL, NULL, 'place', '东方明珠', NULL, NULL, NULL, 3, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('itinerary-shanghai-hangzhou-day2-shanghai-to-hangzhou', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-2', NULL, NULL, NULL, NULL, NULL, 'transit', '上海 → 杭州', '交通方式和车次待确认', NULL, NULL, 4, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('itinerary-shanghai-hangzhou-day3-lingyin-temple', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-3', 'trip-shanghai-hangzhou-2026-stage-hangzhou', 'recommendation-lingyin-temple', NULL, NULL, NULL, 'place', '灵隐寺', NULL, NULL, NULL, 1, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('itinerary-shanghai-hangzhou-day3-caishen-temple', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-3', 'trip-shanghai-hangzhou-2026-stage-hangzhou', 'recommendation-caishen-temple', NULL, NULL, NULL, 'place', '财神庙', '具体 POI 待确认', NULL, NULL, 2, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('itinerary-shanghai-hangzhou-day3-west-lake', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-3', 'trip-shanghai-hangzhou-2026-stage-hangzhou', 'recommendation-west-lake', NULL, NULL, NULL, 'place', '西湖', NULL, NULL, NULL, 3, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z'),
	('itinerary-shanghai-hangzhou-day4-tonglu', 'trip-shanghai-hangzhou-2026', 'trip-shanghai-hangzhou-2026-day-4', 'trip-shanghai-hangzhou-2026-stage-hangzhou', 'recommendation-tonglu-day-guide', NULL, NULL, NULL, 'activity', '桐庐一日攻略 / 桐庐往返', '具体地点和交通待补充', NULL, NULL, 1, NULL, NULL, NULL, '2026-09-01T00:00:00.000Z', '2026-09-01T00:00:00.000Z');
--> statement-breakpoint
PRAGMA optimize;
