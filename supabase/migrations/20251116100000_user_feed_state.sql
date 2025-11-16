create table if not exists public.user_feed_state (
  user_id uuid not null primary key references public.profiles(id) on delete cascade,
  last_opened timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_user_feed_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_feed_state_set_updated_at on public.user_feed_state;
create trigger user_feed_state_set_updated_at
  before update on public.user_feed_state
  for each row
  execute procedure public.set_user_feed_state_updated_at();

alter table public.user_feed_state enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_feed_state'
      and policyname = 'manage_own_feed_state'
  ) then
    create policy manage_own_feed_state on public.user_feed_state
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;
