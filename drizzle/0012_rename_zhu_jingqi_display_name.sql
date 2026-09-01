-- Rename the member's login handle and UI label together.  The stable ID and
-- every relationship keyed by member-zhu-jingqi remain unchanged.  The unique
-- members.name index intentionally makes an existing `kiki` handle fail the
-- migration instead of creating an ambiguous login.
UPDATE `members`
SET `name` = 'kiki',
	`display_name` = 'kiki'
WHERE `id` = 'member-zhu-jingqi'
  AND (`name` <> 'kiki' OR `display_name` <> 'kiki');
--> statement-breakpoint
PRAGMA optimize;
