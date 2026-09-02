-- Route planning via free/open services (Nominatim geocoding + OSRM driving
-- times) instead of a paid Google Maps API: a home base to measure from, a
-- cached lat/lng per item location, and a shared geocode cache so repeated
-- addresses don't re-hit Nominatim (its usage policy asks for this).
alter table households
  add column home_address text,
  add column home_lat double precision,
  add column home_lng double precision;

alter table items
  add column location_lat double precision,
  add column location_lng double precision;

create table geocode_cache (
  query text primary key,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);

alter table geocode_cache enable row level security;
create policy "open access" on geocode_cache for all using (true) with check (true);
