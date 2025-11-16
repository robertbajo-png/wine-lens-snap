alter table if exists public.creators
  add column if not exists followers_count integer not null default 0;

create table if not exists public.user_follows (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  creator_id uuid not null references public.creators(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_follows_pkey primary key (user_id, creator_id)
);

alter table public.user_follows enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_follows'
      and policyname = 'user_follows_manage_own_rows'
  ) then
    create policy user_follows_manage_own_rows on public.user_follows
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end
$$;

create or replace function public.sync_creator_followers_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.creators
      set followers_count = followers_count + 1
      where id = new.creator_id;
  elsif tg_op = 'DELETE' then
    update public.creators
      set followers_count = greatest(followers_count - 1, 0)
      where id = old.creator_id;
  end if;
  return null;
end;
$$;

drop trigger if exists user_follows_sync_followers_count on public.user_follows;
create trigger user_follows_sync_followers_count
  after insert or delete on public.user_follows
  for each row
  execute procedure public.sync_creator_followers_count();
