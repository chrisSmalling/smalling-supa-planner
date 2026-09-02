-- Nominatim often lacks exact house-number data for a specific address
-- (common for newer or rural addresses) even though the surrounding area
-- geocodes fine. Rather than reporting "not found," the geocode function now
-- falls back to the city/state/zip portion and flags the result as
-- approximate, so the app can say so instead of silently pretending it's
-- precise.
alter table geocode_cache add column approximate boolean not null default false;
