create extension if not exists "uuid-ossp";

create table if not exists public.events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users (id),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'events'
      and policyname = 'events_select_own_user'
  ) then
    create policy events_select_own_user on public.events
      for select
      using (auth.uid() = user_id);
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'events'
      and policyname = 'events_insert_service_roles'
  ) then
    create policy events_insert_service_roles on public.events
      for insert
      with check (auth.role() in ('service_role', 'supabase_functions_admin'));
  end if;
end
$$;

create index if not exists events_user_id_idx on public.events (user_id);
create index if not exists events_event_type_idx on public.events (event_type);
