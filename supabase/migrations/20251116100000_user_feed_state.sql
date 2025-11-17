create table if not exists public.user_feed_state (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_opened timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_feed_state enable row level security;

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
  execute function public.set_user_feed_state_updated_at();

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_feed_state'
      and policyname = 'user_feed_state_manage_own_rows'
  ) then
    create policy user_feed_state_manage_own_rows on public.user_feed_state
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

create or replace function public.touch_user_feed_state()
returns public.user_feed_state
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  result public.user_feed_state;
begin
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.user_feed_state as ufs (user_id, last_opened)
  values (current_user_id, now())
  on conflict (user_id) do update
    set last_opened = excluded.last_opened,
        updated_at = now()
  returning * into result;

  return result;
end;
$$;
