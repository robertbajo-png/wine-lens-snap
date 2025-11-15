create extension if not exists "pgcrypto";

create table if not exists public.explore_seed_cards (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  type text not null,
  payload_json jsonb not null
);

alter table public.explore_seed_cards enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'explore_seed_cards'
      and policyname = 'explore_seed_cards_public_read'
  ) then
    create policy explore_seed_cards_public_read on public.explore_seed_cards
      for select
      using (true);
  end if;
end
$$;

insert into public.explore_seed_cards (type, payload_json)
values
  (
    'quick_filter',
    jsonb_build_object(
      'id', 'furmint',
      'label', 'Furmint',
      'description', 'Tokaj & Somló',
      'field', 'grape',
      'value', 'Furmint'
    )
  ),
  (
    'quick_filter',
    jsonb_build_object(
      'id', 'orange',
      'label', 'Orangevin',
      'description', 'Lång skalkontakt',
      'field', 'style',
      'value', 'orange'
    )
  ),
  (
    'quick_filter',
    jsonb_build_object(
      'id', 'riesling',
      'label', 'Riesling',
      'description', 'Kyligt & mineraliskt',
      'field', 'grape',
      'value', 'Riesling'
    )
  ),
  (
    'quick_filter',
    jsonb_build_object(
      'id', 'nebbiolo',
      'label', 'Nebbiolo',
      'description', 'Piemontes röda',
      'field', 'grape',
      'value', 'Nebbiolo'
    )
  ),
  (
    'quick_filter',
    jsonb_build_object(
      'id', 'norra-rhone',
      'label', 'Nordrhône',
      'description', 'Pepprig Syrah',
      'field', 'region',
      'value', 'rhône'
    )
  ),
  (
    'trending_region',
    jsonb_build_object(
      'label', 'Furmint',
      'detail', 'Tokajs vulkaner',
      'count', 14
    )
  ),
  (
    'trending_region',
    jsonb_build_object(
      'label', 'Pinot Noir',
      'detail', 'Småsläpp från Bourgogne',
      'count', 11
    )
  ),
  (
    'trending_region',
    jsonb_build_object(
      'label', 'Orangevin',
      'detail', 'Macererat & matvänligt',
      'count', 9
    )
  ),
  (
    'popular_style',
    jsonb_build_object(
      'label', 'Mineraliskt vitt',
      'detail', 'Salt sten & citrus',
      'count', 12
    )
  ),
  (
    'popular_style',
    jsonb_build_object(
      'label', 'Nordisk cider',
      'detail', 'Bärnstensglöd',
      'count', 8
    )
  ),
  (
    'popular_style',
    jsonb_build_object(
      'label', 'Orangevin',
      'detail', 'Aprikos & teblad',
      'count', 7
    )
  ),
  (
    'popular_style',
    jsonb_build_object(
      'label', 'Svala röda',
      'detail', 'Syrliga bär',
      'count', 6
    )
  ),
  (
    'seed_scan',
    jsonb_build_object(
      'id', 'curated-furmint-barta',
      'title', 'Barta Öreg Király-dűlő',
      'producer', 'Barta Pince',
      'region', 'Tokaj, Ungern',
      'grapesRaw', 'Furmint',
      'style', 'Vitt stilla vin',
      'notes', 'Salt sten, bivax och aprikos från terrasserad vulkansluttning.',
      'createdAt', '2024-10-12T08:00:00Z'
    )
  ),
  (
    'seed_scan',
    jsonb_build_object(
      'id', 'curated-furmint-abbey',
      'title', 'Kreinbacher Brut Nature',
      'producer', 'Somló Abbey Wines',
      'region', 'Somló, Ungern',
      'grapesRaw', 'Furmint, Hárslevelű',
      'style', 'Traditionell metod',
      'notes', 'Rökig kalk, citruszest och stram mousse.',
      'createdAt', '2024-09-18T15:20:00Z'
    )
  ),
  (
    'seed_scan',
    jsonb_build_object(
      'id', 'curated-orange-georgia',
      'title', "Pheasant's Tears Rkatsiteli",
      'producer', "Pheasant's Tears",
      'region', 'Kakheti, Georgien',
      'grapesRaw', 'Rkatsiteli',
      'style', 'Orangevin',
      'notes', 'Bärnstenstoner, teblad och granatäppelskal.',
      'createdAt', '2024-08-01T11:00:00Z'
    )
  ),
  (
    'seed_scan',
    jsonb_build_object(
      'id', 'curated-riesling-mosel',
      'title', 'Clemens Busch Marienburg GG',
      'producer', 'Clemens Busch',
      'region', 'Mosel, Tyskland',
      'grapesRaw', 'Riesling',
      'style', 'Torr Riesling',
      'notes', 'Rökig skiffer, lime och vildörter.',
      'createdAt', '2024-07-22T18:00:00Z'
    )
  ),
  (
    'seed_scan',
    jsonb_build_object(
      'id', 'curated-nebbiolo-langhe',
      'title', 'Trediberri Langhe Nebbiolo',
      'producer', 'Trediberri',
      'region', 'La Morra, Piemonte',
      'grapesRaw', 'Nebbiolo',
      'style', 'Svalt rött',
      'notes', 'Rosenblad, granatäpple och finstämda tanniner.',
      'createdAt', '2024-06-30T12:30:00Z'
    )
  ),
  (
    'seed_scan',
    jsonb_build_object(
      'id', 'curated-syrah-rhone',
      'title', 'Domaine Jamet Côte-Rôtie',
      'producer', 'Domaine Jamet',
      'region', 'Côte-Rôtie, Frankrike',
      'grapesRaw', 'Syrah',
      'style', 'Nordrhône',
      'notes', 'Viol, svartpeppar och oliver från skifferterrasser.',
      'createdAt', '2024-06-12T10:10:00Z'
    )
  )
on conflict do nothing;
