create extension if not exists "pgcrypto";

create or replace function public.is_admin()
returns boolean
language plpgsql
stable
as $$
declare
  claims jsonb := coalesce((auth.jwt())::jsonb, '{}'::jsonb);
begin
  if auth.role() = 'service_role' then
    return true;
  end if;

  if claims ? 'app_role' and claims ->> 'app_role' = 'admin' then
    return true;
  end if;

  if claims ? 'role' and claims ->> 'role' = 'admin' then
    return true;
  end if;

  if claims ? 'is_admin' and lower(claims ->> 'is_admin') in ('true', 't', '1') then
    return true;
  end if;

  return false;
exception
  when others then
    return false;
end;
$$;

do $$
begin
  execute format('grant execute on function public.is_admin() to %I', 'authenticated');
  execute format('grant execute on function public.is_admin() to %I', 'service_role');
  execute format('grant execute on function public.is_admin() to %I', 'anon');
exception
  when insufficient_privilege then
    null;
end;
$$;

create table if not exists public.creators (
  id uuid primary key default gen_random_uuid(),
  handle text not null unique,
  display_name text not null,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.creator_posts (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.creators(id) on delete cascade,
  type text not null check (type in ('longform', 'quick_take', 'listicle')),
  title text not null,
  body_json jsonb not null,
  created_at timestamptz not null default now(),
  constraint creator_posts_body_json_schema
    check (
      (type = 'longform' and coalesce(jsonb_typeof(body_json -> 'blocks'), '') = 'array') or
      (type = 'quick_take' and coalesce(jsonb_typeof(body_json -> 'text'), '') = 'string') or
      (type = 'listicle' and coalesce(jsonb_typeof(body_json -> 'items'), '') = 'array')
    )
);

create index if not exists idx_creator_posts_creator on public.creator_posts (creator_id);
create index if not exists idx_creator_posts_type on public.creator_posts (type);

alter table public.creators enable row level security;
alter table public.creator_posts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'creators'
      and policyname = 'creators_read_authenticated'
  ) then
    create policy creators_read_authenticated on public.creators
      for select
      using (auth.role() = 'authenticated' or public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'creators'
      and policyname = 'creators_admin_write'
  ) then
    create policy creators_admin_write on public.creators
      for insert
      with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'creators'
      and policyname = 'creators_admin_update'
  ) then
    create policy creators_admin_update on public.creators
      for update
      using (public.is_admin())
      with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'creators'
      and policyname = 'creators_admin_delete'
  ) then
    create policy creators_admin_delete on public.creators
      for delete
      using (public.is_admin());
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'creator_posts'
      and policyname = 'creator_posts_read_authenticated'
  ) then
    create policy creator_posts_read_authenticated on public.creator_posts
      for select
      using (auth.role() = 'authenticated' or public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'creator_posts'
      and policyname = 'creator_posts_admin_insert'
  ) then
    create policy creator_posts_admin_insert on public.creator_posts
      for insert
      with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'creator_posts'
      and policyname = 'creator_posts_admin_update'
  ) then
    create policy creator_posts_admin_update on public.creator_posts
      for update
      using (public.is_admin())
      with check (public.is_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'creator_posts'
      and policyname = 'creator_posts_admin_delete'
  ) then
    create policy creator_posts_admin_delete on public.creator_posts
      for delete
      using (public.is_admin());
  end if;
end
$$;

insert into public.creators (id, handle, display_name, bio, avatar_url)
values
  ('8e4f1613-625f-4a96-b19f-8fe5b555a0ff', 'fermentista', 'Fermentista Studio', 'Taktiska guider om maceration och amfora-fermentering.', 'https://cdn.winesnap.app/creators/fermentista.jpg'),
  ('5bf718fc-2d2d-4a53-897a-d6d19fc111a8', 'nordvin-clara', 'Clara Nordvin', 'Sommelier i Stockholm som lyfter småskaliga nordiska producenter.', 'https://cdn.winesnap.app/creators/clara.jpg'),
  ('61f6e0fe-7300-4bb5-8b54-4fce0c5f10c5', 'amaro-anders', 'Anders "Amaro" Lind', 'Skapare av Wine Lens kvällsbrev med fokus på bitters, orangevin och pet-nat.', 'https://cdn.winesnap.app/creators/anders.jpg')
on conflict (handle) do nothing;

insert into public.creator_posts (id, creator_id, type, title, body_json)
values
  (
    '7a246ab7-8f7f-4d3f-86ad-9a3221fbf893',
    (select id from public.creators where handle = 'fermentista'),
    'longform',
    'Manual: Så bygger du struktur i långa macerationer',
    jsonb_build_object(
      'summary', 'Grundrecept för orangevin på 40 dagar.',
      'blocks', jsonb_build_array(
        jsonb_build_object('type', 'intro', 'text', 'Varför fenoliskt djup kräver en staged maceration.'),
        jsonb_build_object('type', 'step', 'title', 'Dag 1–3', 'text', 'Avstjälka 60 %, håll 12 °C och blanda varsamt.'),
        jsonb_build_object('type', 'step', 'title', 'Dag 10', 'text', 'Öka kontakt genom punch-downs 2× per dag.')
      )
    )
  ),
  (
    '01f27a31-6b18-42f7-95eb-3298058bc1cd',
    (select id from public.creators where handle = 'fermentista'),
    'listicle',
    'Tre jäskärl som förändrar texturen',
    jsonb_build_object(
      'items', jsonb_build_array(
        jsonb_build_object('title', 'Amfora från Impruneta', 'detail', 'Ger mikrooxidation och varm krydda.'),
        jsonb_build_object('title', 'Betongägg 900L', 'detail', 'Jämn konvektion och bevarad frukt.'),
        jsonb_build_object('title', 'Acacia-fat', 'detail', 'Lätt tannin för orangeblends.')
      )
    )
  ),
  (
    '3ce95552-4b13-497a-85a7-7f9035972f78',
    (select id from public.creators where handle = 'nordvin-clara'),
    'quick_take',
    'Snabbprov: Svala Cab Franc från Loiredalen',
    jsonb_build_object(
      'text', 'Pepprig svartvinbär, kalkigt avslut och 11.5 % ABV – servera svalt.',
      'cta', 'Para med råbiff och syrad lök.'
    )
  ),
  (
    'b99f20ab-7f37-4a12-b9cf-d6b192287cfb',
    (select id from public.creators where handle = 'nordvin-clara'),
    'longform',
    'Ruttips: Cider- och vinrunda runt Åland',
    jsonb_build_object(
      'summary', '36 timmars schema med fokus på cidersider och lättpressat vitt.',
      'blocks', jsonb_build_array(
        jsonb_build_object('type', 'map', 'text', 'Start på Tjudö ciderbruk – nypon, melon och sälta.'),
        jsonb_build_object('type', 'stop', 'title', 'Kloster vineri', 'text', 'Testa skin-contact Solaris med låg svavel.'),
        jsonb_build_object('type', 'stop', 'title', 'Havsbadet', 'text', 'Avsluta med spontanjäst cider på äpple/aronia.')
      )
    )
  ),
  (
    'af18bbcb-140a-41f4-9cde-9a2cb3df73e3',
    (select id from public.creators where handle = 'amaro-anders'),
    'quick_take',
    'Kvällsnotis: Fernet som digestif till orange',
    jsonb_build_object(
      'text', 'Ett uns fernetaffinitet rensar paletten efter skalmacererat.' ,
      'cta', 'Servera över is med en twist av blodapelsin.'
    )
  )
on conflict (id) do nothing;
