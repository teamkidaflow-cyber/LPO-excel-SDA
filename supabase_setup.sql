-- LPO Extraction System — Supabase table setup
-- Run this once in your Supabase project > SQL Editor

create table if not exists lpo_runs (
  id             bigserial primary key,
  processed_at   timestamptz not null default now(),
  filename       text        not null,
  lpo_numbers    text[]      default '{}',
  row_count      int,
  ok_count       int,
  review_count   int,
  flagged        boolean     default false,
  flag_reason    text,
  sheets_url     text,
  csv_data       text,        -- full CSV stored as text; fine for typical LPO sizes
  status         text        default 'done'   -- done | flagged | error
);

-- Index for fast search by filename and date
create index if not exists lpo_runs_filename_idx     on lpo_runs (filename);
create index if not exists lpo_runs_processed_at_idx on lpo_runs (processed_at desc);

-- Allow the anon key to read and insert (no delete/update — history is append-only)
alter table lpo_runs enable row level security;

create policy "Allow anon insert"
  on lpo_runs for insert
  to anon
  with check (true);

create policy "Allow anon select"
  on lpo_runs for select
  to anon
  using (true);
