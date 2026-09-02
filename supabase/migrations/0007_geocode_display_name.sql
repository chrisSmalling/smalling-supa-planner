-- A bare street address ("17735 Pleasantview Blvd") is ambiguous — Nominatim
-- silently matched a same-named street in the wrong state instead of
-- erroring. Store what it actually resolved to so the app can show it back
-- for confirmation instead of trusting the first match blindly.
alter table geocode_cache add column display_name text;
