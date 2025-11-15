create extension if not exists "pgcrypto";

create table if not exists public.telemetry_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  occurred_at timestamptz not null default now(),
  event_name text not null,
  payload_json jsonb not null default '{}'::jsonb,
  session_id uuid,
  user_id uuid references auth.users (id)
);

alter table public.telemetry_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'telemetry_events'
      and policyname = 'telemetry_events_insert_anyone'
  ) then
    create policy telemetry_events_insert_anyone on public.telemetry_events
      for insert
      with check (true);
  end if;
end
$$;

create index if not exists telemetry_events_event_name_idx on public.telemetry_events (event_name);
create index if not exists telemetry_events_session_idx on public.telemetry_events (session_id);

create or replace view public.explore_filter_usage_top3 as
select field,
       value,
       usage_count
from (
  select
    coalesce(payload_json ->> 'field', 'unknown') as field,
    coalesce(payload_json ->> 'value', '') as value,
    count(*) as usage_count,
    row_number() over (order by count(*) desc) as usage_rank
  from public.telemetry_events
  where event_name = 'explore_filter_changed'
  group by 1, 2
) ranked
where usage_rank <= 3;

create or replace view public.explore_session_conversion as
with explore_sessions as (
  select distinct session_id
  from public.telemetry_events
  where event_name = 'explore_opened'
    and session_id is not null
),
explore_sessions_with_new_scan as (
  select distinct session_id
  from public.telemetry_events
  where event_name = 'explore_new_scan_cta_clicked'
    and session_id is not null
)
select
  (select count(*) from explore_sessions) as total_sessions,
  (select count(*) from explore_sessions_with_new_scan) as sessions_with_new_scan,
  case
    when (select count(*) from explore_sessions) = 0 then 0::numeric
    else round(
      (select count(*) from explore_sessions_with_new_scan)::numeric /
      nullif((select count(*) from explore_sessions)::numeric, 0),
      4
    )
  end as conversion_rate
;
