-- Application-level rate-limit counters for login, AMap and media upload endpoints.
-- Keys are one-way digests; no raw IP/member identifiers are stored.
CREATE TABLE IF NOT EXISTS `rate_limits` (
  `key` text PRIMARY KEY NOT NULL,
  `window_started_at` integer NOT NULL,
  `count` integer NOT NULL
);
CREATE INDEX IF NOT EXISTS `idx_rate_limits_window` ON `rate_limits` (`window_started_at`);
