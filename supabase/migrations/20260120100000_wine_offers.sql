-- Create table for wine offers linked to wines via label hash
create table if not exists public.wine_offers (
  id uuid primary key default gen_random_uuid(),
  label_hash text not null,
  merchant_name text not null,
  url text not null,
  price numeric null,
  currency text null,
  country text null,
  source text not null default 'manual',
  created_at timestamptz default now()
);

-- Index for quick lookups by label hash
create index if not exists idx_wine_offers_label_hash on public.wine_offers(label_hash);

-- Enable RLS
alter table public.wine_offers enable row level security;

-- Allow anyone to read wine offers
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'wine_offers'
      and policyname = 'Anyone can read wine offers'
  ) then
    create policy "Anyone can read wine offers"
      on public.wine_offers
      for select
      using (true);
  end if;
end
$$;

-- Restrict writes to the service role
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'wine_offers'
      and policyname = 'Service role can manage wine offers'
  ) then
    create policy "Service role can manage wine offers"
      on public.wine_offers
      for all
      using (auth.role() = 'service_role')
      with check (auth.role() = 'service_role');
  end if;
end
$$;
