-- Free-text location/address for an item, e.g. "Magic Kingdom, Orlando, FL".
-- No geocoding — just a string good enough to hand to a Google Maps search
-- link and to a future travel-time feature.
alter table items add column location text;
