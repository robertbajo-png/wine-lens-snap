-- Create table for premium checkout sessions
create table if not exists public.premium_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  provider_session_id text,
  success_url text,
  cancel_url text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.premium_checkout_sessions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'premium_checkout_sessions'
      and policyname = 'premium_checkout_sessions_select_own'
  ) then
    create policy premium_checkout_sessions_select_own
      on public.premium_checkout_sessions
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

create index if not exists premium_checkout_sessions_user_idx on public.premium_checkout_sessions(user_id);
