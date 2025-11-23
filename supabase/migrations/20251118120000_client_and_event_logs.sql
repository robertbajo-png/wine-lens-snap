create extension if not exists "pgcrypto";

create table if not exists public.client_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id),
  view text not null,
  action text not null,
  level text not null default 'error',
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.event_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid() references auth.users (id),
  event_name text not null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.client_logs enable row level security;
alter table public.event_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_logs'
      and policyname = 'client_logs_insert_authenticated'
  ) then
    create policy client_logs_insert_authenticated on public.client_logs
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_logs'
      and policyname = 'event_logs_insert_authenticated'
  ) then
    create policy event_logs_insert_authenticated on public.event_logs
      for insert
      to authenticated
      with check (user_id is null or user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_logs'
      and policyname = 'event_logs_insert_anon'
  ) then
    create policy event_logs_insert_anon on public.event_logs
      for insert
      to anon
      with check (user_id is null);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'client_logs'
      and policyname = 'client_logs_select_service_role'
  ) then
    create policy client_logs_select_service_role on public.client_logs
      for select
      using (auth.role() = 'service_role');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'event_logs'
      and policyname = 'event_logs_select_service_role'
  ) then
    create policy event_logs_select_service_role on public.event_logs
      for select
      using (auth.role() = 'service_role');
  end if;
end
$$;

create index if not exists client_logs_created_at_idx on public.client_logs (created_at desc);
create index if not exists client_logs_view_idx on public.client_logs (view);
create index if not exists event_logs_created_at_idx on public.event_logs (created_at desc);
create index if not exists event_logs_event_name_idx on public.event_logs (event_name);
