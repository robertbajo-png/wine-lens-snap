create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  bio text,
  avatar_url text,
  followers_count integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists accounts_display_name_key on public.accounts (lower(display_name));

create table if not exists public.follows (
  follower_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id)
);

alter table public.follows enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'follows' and policyname = 'users_manage_own_follows'
  ) then
    create policy users_manage_own_follows on public.follows
      for all
      using (auth.uid() = follower_id)
      with check (auth.uid() = follower_id);
  end if;
end
$$;

create or replace function public.update_followers_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.accounts
      set followers_count = followers_count + 1
      where id = new.followee_id;
  elsif tg_op = 'DELETE' then
    update public.accounts
      set followers_count = greatest(followers_count - 1, 0)
      where id = old.followee_id;
  end if;
  return null;
end;
$$;

drop trigger if exists follows_update_followers_count on public.follows;
create trigger follows_update_followers_count
  after insert or delete on public.follows
  for each row
  execute procedure public.update_followers_count();

insert into public.accounts (id, display_name, bio, avatar_url)
values
  (
    'c77e5446-0b4c-4d69-8c5c-19cb76e66922',
    'Sommelierstudion',
    'Direktsända provningar och masterclasser varje vecka. Fokus på nordiska terroirer och hållbara producenter.',
    null
  ),
  (
    'ff9ca7d4-a358-41d8-9aef-97a04ded2a72',
    'Vinoteket 45',
    'Butikslistor och rariteter från kontinenten. Uppdateras fredag morgon med färska tips från hyllorna.',
    null
  ),
  (
    '0c2a8d72-576c-4b09-9a87-3b3b6200fc62',
    'Studio Nebbiolo',
    'Kuraterade Piemonte-paket, direkt från gårdarna. Följ för verticals och nörderi kring klassiska årgångar.',
    null
  )
on conflict (id) do nothing;
