create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  lang text not null default 'sv-SE',
  push_opt_in boolean not null default false
);

alter table public.user_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_settings' and policyname = 'select_own_settings'
  ) then
    create policy select_own_settings on public.user_settings
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_settings' and policyname = 'insert_own_settings'
  ) then
    create policy insert_own_settings on public.user_settings
      for insert with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_settings' and policyname = 'update_own_settings'
  ) then
    create policy update_own_settings on public.user_settings
      for update using (auth.uid() = user_id);
  end if;
end
$$;
