-- V2.4-R1: retain unresolved city/station text independently from concrete
-- endpoint Place bindings. This is additive and leaves existing rows intact.
ALTER TABLE bookings ADD COLUMN origin_label TEXT;
ALTER TABLE bookings ADD COLUMN destination_label TEXT;
