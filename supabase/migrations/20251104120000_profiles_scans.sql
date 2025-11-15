-- Create user profiles and scan history tables with RLS per user
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  label_hash text,
  image_thumb text,
  raw_ocr text,
  analysis_json jsonb,
  vintage int,
  created_at timestamptz not null default now()
);

alter table public.scans enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'scans' and policyname = 'select_own_scans'
  ) then
    create policy select_own_scans on public.scans
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'scans' and policyname = 'insert_own_scans'
  ) then
    create policy insert_own_scans on public.scans
      for insert with check (auth.uid() = user_id);
  end if;
end
$$;
