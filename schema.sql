-- Run this against your Supabase project to enable "Shared" reminders and
-- (optionally) missed-task alerts. Safe to run on the same project you
-- already use for the Swear Jar app.

create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  task_id text not null,
  label text not null,
  emoji text,
  logged_at timestamptz not null default now()
);

create index if not exists logs_task_id_logged_at_idx
  on logs (task_id, logged_at desc);

alter table logs enable row level security;

create policy "anon can insert logs" on logs
  for insert to anon
  with check (true);

create policy "anon can read logs" on logs
  for select to anon
  using (true);

-- Server-side copy of "Shared" task definitions. Needed so the scheduled
-- reminder check (which runs with no phone involved) knows which tasks
-- exist, what time they're due, and whether it already alerted today.
create table if not exists tasks (
  id text primary key,
  label text not null,
  emoji text,
  alert_enabled boolean not null default false,
  alert_time time,              -- wall-clock time, e.g. '18:00', in the
                                 -- timezone the check-reminders function
                                 -- is configured for (see SUPABASE_SETUP.md)
  last_alerted_date date,       -- prevents re-sending the same alert
                                 -- multiple times in one day
  created_at timestamptz not null default now()
);

alter table tasks enable row level security;

create policy "anon can upsert tasks" on tasks
  for insert to anon
  with check (true);

create policy "anon can update tasks" on tasks
  for update to anon
  using (true);

create policy "anon can read tasks" on tasks
  for select to anon
  using (true);

-- One row per phone that's turned on notifications. Not tied to a specific
-- person or task — any device subscribed here gets pinged for every missed
-- "Shared" task that has alerts enabled.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "anon can insert subscriptions" on push_subscriptions
  for insert to anon
  with check (true);

create policy "anon can delete own subscription" on push_subscriptions
  for delete to anon
  using (true);
