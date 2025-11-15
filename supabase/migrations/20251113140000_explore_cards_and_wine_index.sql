create extension if not exists "pgcrypto";

create table if not exists public.explore_cards (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text not null,
  subtitle text,
  payload_json jsonb not null,
  rank integer not null default 100,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  constraint explore_cards_valid_window check (valid_to is null or valid_to >= valid_from)
);

alter table public.explore_cards enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'explore_cards'
      and policyname = 'explore_cards_public_read'
  ) then
    create policy explore_cards_public_read on public.explore_cards
      for select
      using (true);
  end if;
end
$$;

create index if not exists idx_explore_cards_rank on public.explore_cards(rank asc, created_at desc);
create index if not exists idx_explore_cards_validity on public.explore_cards(valid_from, valid_to);

insert into public.explore_cards (id, title, subtitle, payload_json, rank, valid_from, valid_to)
values
  (
    '00000000-0000-0000-0000-000000000101',
    'Furmint',
    'Tokaj & Somló',
    jsonb_build_object(
      'type', 'quick_filter',
      'id', 'furmint',
      'label', 'Furmint',
      'description', 'Tokaj & Somló',
      'field', 'grape',
      'value', 'Furmint'
    ),
    10,
    now() - interval '7 days',
    now() + interval '30 days'
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    'Orangevin',
    'Lång skalkontakt',
    jsonb_build_object(
      'type', 'quick_filter',
      'id', 'orange',
      'label', 'Orangevin',
      'description', 'Lång skalkontakt',
      'field', 'style',
      'value', 'orange'
    ),
    20,
    now() - interval '7 days',
    now() + interval '30 days'
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    'Riesling',
    'Kyligt & mineraliskt',
    jsonb_build_object(
      'type', 'quick_filter',
      'id', 'riesling',
      'label', 'Riesling',
      'description', 'Kyligt & mineraliskt',
      'field', 'grape',
      'value', 'Riesling'
    ),
    30,
    now() - interval '7 days',
    now() + interval '30 days'
  ),
  (
    '00000000-0000-0000-0000-000000000104',
    'Nebbiolo',
    'Piemontes röda',
    jsonb_build_object(
      'type', 'quick_filter',
      'id', 'nebbiolo',
      'label', 'Nebbiolo',
      'description', 'Piemontes röda',
      'field', 'grape',
      'value', 'Nebbiolo'
    ),
    40,
    now() - interval '7 days',
    now() + interval '30 days'
  ),
  (
    '00000000-0000-0000-0000-000000000105',
    'Nordrhône',
    'Pepprig Syrah',
    jsonb_build_object(
      'type', 'quick_filter',
      'id', 'norra-rhone',
      'label', 'Nordrhône',
      'description', 'Pepprig Syrah',
      'field', 'region',
      'value', 'rhône'
    ),
    50,
    now() - interval '7 days',
    now() + interval '30 days'
  ),
  (
    '00000000-0000-0000-0000-000000000201',
    'Trend: Furmint',
    'Tokajs vulkaner',
    jsonb_build_object(
      'type', 'trending_region',
      'label', 'Furmint',
      'detail', 'Tokajs vulkaner',
      'count', 14
    ),
    60,
    now() - interval '1 day',
    now() + interval '14 days'
  ),
  (
    '00000000-0000-0000-0000-000000000202',
    'Trend: Pinot Noir',
    'Småsläpp från Bourgogne',
    jsonb_build_object(
      'type', 'trending_region',
      'label', 'Pinot Noir',
      'detail', 'Småsläpp från Bourgogne',
      'count', 11
    ),
    70,
    now() - interval '1 day',
    now() + interval '14 days'
  ),
  (
    '00000000-0000-0000-0000-000000000203',
    'Trend: Orangevin',
    'Macererat & matvänligt',
    jsonb_build_object(
      'type', 'trending_region',
      'label', 'Orangevin',
      'detail', 'Macererat & matvänligt',
      'count', 9
    ),
    80,
    now() - interval '1 day',
    now() + interval '14 days'
  ),
  (
    '00000000-0000-0000-0000-000000000301',
    'Stil: mineraliskt vitt',
    'Salt sten & citrus',
    jsonb_build_object(
      'type', 'popular_style',
      'label', 'Mineraliskt vitt',
      'detail', 'Salt sten & citrus',
      'count', 12
    ),
    90,
    now() - interval '1 day',
    now() + interval '14 days'
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    'Stil: nordisk cider',
    'Bärnstensglöd',
    jsonb_build_object(
      'type', 'popular_style',
      'label', 'Nordisk cider',
      'detail', 'Bärnstensglöd',
      'count', 8
    ),
    100,
    now() - interval '1 day',
    now() + interval '14 days'
  ),
  (
    '00000000-0000-0000-0000-000000000303',
    'Stil: orangevin',
    'Aprikos & teblad',
    jsonb_build_object(
      'type', 'popular_style',
      'label', 'Orangevin',
      'detail', 'Aprikos & teblad',
      'count', 7
    ),
    110,
    now() - interval '1 day',
    now() + interval '14 days'
  ),
  (
    '00000000-0000-0000-0000-000000000304',
    'Stil: svala röda',
    'Syrliga bär',
    jsonb_build_object(
      'type', 'popular_style',
      'label', 'Svala röda',
      'detail', 'Syrliga bär',
      'count', 6
    ),
    120,
    now() - interval '1 day',
    now() + interval '14 days'
  ),
  (
    '00000000-0000-0000-0000-000000000401',
    'Kuraterad: Barta Öreg Király-dűlő',
    'Salt sten, bivax och aprikos',
    jsonb_build_object(
      'type', 'seed_scan',
      'id', 'curated-furmint-barta',
      'title', 'Barta Öreg Király-dűlő',
      'producer', 'Barta Pince',
      'region', 'Tokaj, Ungern',
      'grapesRaw', 'Furmint',
      'style', 'Vitt stilla vin',
      'notes', 'Salt sten, bivax och aprikos från terrasserad vulkansluttning.',
      'createdAt', '2024-10-12T08:00:00Z'
    ),
    130,
    now() - interval '30 days',
    now() + interval '60 days'
  ),
  (
    '00000000-0000-0000-0000-000000000402',
    'Kuraterad: Kreinbacher Brut Nature',
    'Rökig kalk & citrus',
    jsonb_build_object(
      'type', 'seed_scan',
      'id', 'curated-furmint-abbey',
      'title', 'Kreinbacher Brut Nature',
      'producer', 'Somló Abbey Wines',
      'region', 'Somló, Ungern',
      'grapesRaw', 'Furmint, Hárslevelű',
      'style', 'Traditionell metod',
      'notes', 'Rökig kalk, citruszest och stram mousse.',
      'createdAt', '2024-09-18T15:20:00Z'
    ),
    140,
    now() - interval '30 days',
    now() + interval '60 days'
  ),
  (
    '00000000-0000-0000-0000-000000000403',
    'Kuraterad: Pheasant''s Tears Rkatsiteli',
    'Bärnsten & teblad',
    jsonb_build_object(
      'type', 'seed_scan',
      'id', 'curated-orange-georgia',
      'title', 'Pheasant''s Tears Rkatsiteli',
      'producer', 'Pheasant''s Tears',
      'region', 'Kakheti, Georgien',
      'grapesRaw', 'Rkatsiteli',
      'style', 'Orangevin',
      'notes', 'Bärnstenstoner, teblad och granatäppelskal.',
      'createdAt', '2024-08-01T11:00:00Z'
    ),
    150,
    now() - interval '30 days',
    now() + interval '60 days'
  ),
  (
    '00000000-0000-0000-0000-000000000404',
    'Kuraterad: Clemens Busch Marienburg GG',
    'Rökig skiffer & lime',
    jsonb_build_object(
      'type', 'seed_scan',
      'id', 'curated-riesling-mosel',
      'title', 'Clemens Busch Marienburg GG',
      'producer', 'Clemens Busch',
      'region', 'Mosel, Tyskland',
      'grapesRaw', 'Riesling',
      'style', 'Torr Riesling',
      'notes', 'Rökig skiffer, lime och vildörter.',
      'createdAt', '2024-07-22T18:00:00Z'
    ),
    160,
    now() - interval '30 days',
    now() + interval '60 days'
  ),
  (
    '00000000-0000-0000-0000-000000000405',
    'Kuraterad: Trediberri Langhe Nebbiolo',
    'Rosenblad & granatäpple',
    jsonb_build_object(
      'type', 'seed_scan',
      'id', 'curated-nebbiolo-langhe',
      'title', 'Trediberri Langhe Nebbiolo',
      'producer', 'Trediberri',
      'region', 'La Morra, Piemonte',
      'grapesRaw', 'Nebbiolo',
      'style', 'Svalt rött',
      'notes', 'Rosenblad, granatäpple och finstämda tanniner.',
      'createdAt', '2024-06-30T12:30:00Z'
    ),
    170,
    now() - interval '30 days',
    now() + interval '60 days'
  ),
  (
    '00000000-0000-0000-0000-000000000406',
    'Kuraterad: Domaine Jamet Côte-Rôtie',
    'Viol & svartpeppar',
    jsonb_build_object(
      'type', 'seed_scan',
      'id', 'curated-syrah-rhone',
      'title', 'Domaine Jamet Côte-Rôtie',
      'producer', 'Domaine Jamet',
      'region', 'Côte-Rôtie, Frankrike',
      'grapesRaw', 'Syrah',
      'style', 'Nordrhône',
      'notes', 'Viol, svartpeppar och oliver från skifferterrasser.',
      'createdAt', '2024-06-12T10:10:00Z'
    ),
    180,
    now() - interval '30 days',
    now() + interval '60 days'
  )
on conflict (id) do nothing;

create table if not exists public.wine_index (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'curated',
  title text not null,
  producer text,
  region text,
  grapes_raw text,
  style text,
  color text,
  notes text,
  image_url text,
  rank integer not null default 100,
  payload_json jsonb default '{}'::jsonb,
  search_vector tsvector generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(producer, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(region, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(grapes_raw, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(style, '')), 'C') ||
    setweight(to_tsvector('simple', coalesce(notes, '')), 'D')
  ) stored
);

alter table public.wine_index enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'wine_index'
      and policyname = 'wine_index_public_read'
  ) then
    create policy wine_index_public_read on public.wine_index
      for select
      using (true);
  end if;
end
$$;

create index if not exists wine_index_rank_idx on public.wine_index(rank asc, created_at desc);
create index if not exists wine_index_search_idx on public.wine_index using gin(search_vector);

insert into public.wine_index (id, title, producer, region, grapes_raw, style, color, notes, image_url, rank, payload_json)
values
  (
    '10000000-0000-0000-0000-000000000001',
    'Barta Öreg Király-dűlő',
    'Barta Pince',
    'Tokaj, Ungern',
    'Furmint',
    'Vitt stilla vin',
    'Vitt',
    'Salt sten, bivax och aprikos från terrasserad vulkansluttning.',
    null,
    10,
    jsonb_build_object('seed_id', 'curated-furmint-barta', 'grapesList', array['Furmint']::text[])
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Kreinbacher Brut Nature',
    'Somló Abbey Wines',
    'Somló, Ungern',
    'Furmint, Hárslevelű',
    'Traditionell metod',
    'Mousserande',
    'Rökig kalk, citruszest och stram mousse.',
    null,
    20,
    jsonb_build_object(
      'seed_id', 'curated-furmint-abbey',
      'grapesList', array['Furmint','Hárslevelű']::text[]
    )
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'Pheasant''s Tears Rkatsiteli',
    'Pheasant''s Tears',
    'Kakheti, Georgien',
    'Rkatsiteli',
    'Orangevin',
    'Orange',
    'Bärnstenstoner, teblad och granatäppelskal.',
    null,
    30,
    jsonb_build_object('seed_id', 'curated-orange-georgia', 'grapesList', array['Rkatsiteli']::text[])
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    'Clemens Busch Marienburg GG',
    'Clemens Busch',
    'Mosel, Tyskland',
    'Riesling',
    'Torr Riesling',
    'Vitt',
    'Rökig skiffer, lime och vildörter.',
    null,
    40,
    jsonb_build_object('seed_id', 'curated-riesling-mosel', 'grapesList', array['Riesling']::text[])
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    'Trediberri Langhe Nebbiolo',
    'Trediberri',
    'La Morra, Piemonte',
    'Nebbiolo',
    'Svalt rött',
    'Rött',
    'Rosenblad, granatäpple och finstämda tanniner.',
    null,
    50,
    jsonb_build_object('seed_id', 'curated-nebbiolo-langhe', 'grapesList', array['Nebbiolo']::text[])
  ),
  (
    '10000000-0000-0000-0000-000000000006',
    'Domaine Jamet Côte-Rôtie',
    'Domaine Jamet',
    'Côte-Rôtie, Frankrike',
    'Syrah',
    'Nordrhône',
    'Rött',
    'Viol, svartpeppar och oliver från skifferterrasser.',
    null,
    60,
    jsonb_build_object('seed_id', 'curated-syrah-rhone', 'grapesList', array['Syrah']::text[])
  )
on conflict (id) do nothing;
