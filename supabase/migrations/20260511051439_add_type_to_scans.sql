alter table public.scans
  add column type text check (type in ('expense', 'mileage', 'unknown'));
