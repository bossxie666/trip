-- R1 endpoint labels preserve a user's city/station text independently of a
-- concrete Place binding. This is additive and leaves all existing rows intact.
ALTER TABLE bookings ADD COLUMN origin_label text;
ALTER TABLE bookings ADD COLUMN destination_label text;
