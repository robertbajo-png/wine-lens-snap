-- Expand allowed creator post types to support new curated content
alter table public.creator_posts
  drop constraint if exists creator_posts_type_check;

alter table public.creator_posts
  add constraint creator_posts_type_check
  check (type in ('longform', 'quick_take', 'listicle', 'tip', 'article', 'pairing'));

alter table public.creator_posts
  drop constraint if exists creator_posts_body_json_schema;

alter table public.creator_posts
  add constraint creator_posts_body_json_schema
  check (
    (type = 'longform' and coalesce(jsonb_typeof(body_json -> 'blocks'), '') = 'array') or
    (type = 'quick_take' and coalesce(jsonb_typeof(body_json -> 'text'), '') = 'string') or
    (type = 'listicle' and coalesce(jsonb_typeof(body_json -> 'items'), '') = 'array') or
    (type in ('tip', 'article', 'pairing') and coalesce(jsonb_typeof(body_json), '') = 'object')
  );

with upserted_creators as (
  insert into public.creators (handle, display_name, bio, avatar_url)
  values
    ('nordicsomm', 'The Nordic Somm', 'Sommelier utbildad i Köpenhamn, specialiserad på biodynamiska viner och nordiskt mat–vin-tänk. Skriver om rena smaker, friskhet och syradrivna kombinationer.', 'https://winesnap-assets.example.com/creators/nordicsomm.png'),
    ('wineminimalist', 'Wine Minimalist', 'Enkel, rak och okomplicerad vinkunskap. Min mission: förklara vin utan fluff. Mindre snobberi, mer nöje.', 'https://winesnap-assets.example.com/creators/wineminimalist.png'),
    ('terroirdame', 'La Dame du Terroir', 'Fransyska i Stockholm. Brinner för Bourgogne, Loire och små terroir-drivna gårdar.', 'https://winesnap-assets.example.com/creators/terroirdame.png'),
    ('cellargeek', 'The Cellar Geek', 'Nörd, samlare och arkiverare. Tipsar om lagringspotential, metadata och smarta sätt att bygga en budgetkällare.', 'https://winesnap-assets.example.com/creators/cellargeek.png'),
    ('foodwineeveryday', 'Everyday Food & Wine', 'Journalist och hemmakock. Fokus på vardagsmat och prisvärda viner som funkar till riktig mat, inte bara fine dining.', 'https://winesnap-assets.example.com/creators/foodwineeveryday.png'),
    ('winesnap_team', 'WineSnap Team', 'Officiella tips och nyheter från WineSnap. Kuraterade flaskor, trending styles och utbildning från vårt team.', 'https://winesnap-assets.example.com/creators/winesnap_team.png')
  on conflict (handle) do update
    set display_name = excluded.display_name,
        bio = excluded.bio,
        avatar_url = excluded.avatar_url
  returning id, handle
),
posts as (
  select *
  from (
    values
      (
        'nordicsomm',
        'tip',
        'Bästa druvorna för nordiskt kök',
        '{"summary":"Tre druvor som funkar extra bra till nordiskt kök.","grapes":["Riesling","Sauvignon Blanc","Blaufränkisch"],"note":"Fokus på syra, renhet och fräschör som möter sälta och syra i maten."}'::jsonb
      ),
      (
        'nordicsomm',
        'article',
        '3 biodynamiska producenter att hålla koll på',
        '{"producers":["Gut Oggau (Österrike)","Domaine Tempier (Frankrike)","Frank Cornelissen (Sicilien)"],"comment":"Bra ingång till biodynamisk stil utan att bli för extremt."}'::jsonb
      ),
      (
        'nordicsomm',
        'pairing',
        'Matchning: Röding + Riesling Kabinett',
        '{"dish":"Stekt eller ugnsbakad röding med smörsås","wine":"Riesling Kabinett, gärna halvtorrrt","why":"Lätt sötma och hög syra i vinet möter fiskens fetma och sälta."}'::jsonb
      ),
      (
        'wineminimalist',
        'tip',
        'Så läser du en etikett på 10 sekunder',
        '{"steps":["1. Titta först på producenten.","2. Sedan regionen.","3. Sen årgång.","4. Sist druvan (om den står)."],"note":"Producent och region säger ofta mer än marknadsföringstexten."}'::jsonb
      ),
      (
        'wineminimalist',
        'article',
        '3 viner för nybörjaren',
        '{"wines":["Pinot Noir – lätt, saftig, snälla tanniner.","Verdejo – krispigt, citrus, lätt att gilla.","Côtes-du-Rhône – prisvärd blend som funkar till mycket."]}'::jsonb
      ),
      (
        'wineminimalist',
        'article',
        'Billigt men bra: 100–150 kr som levererar',
        '{"hint":"Fokusera på regioner där efterfrågan inte är maxad.","examples":["En enkel Malbec från Argentina","Picpoul de Pinet från Languedoc","Prosecco Brut från mindre producenter"]}'::jsonb
      ),
      (
        'terroirdame',
        'article',
        'Varför terroir fortfarande betyder allt',
        '{"pillars":["Jordmån","Mikroklimat","Exponering","Vinmakarens filosofi"],"note":"Terroir är summan av plats och människa, inte bara jordarten."}'::jsonb
      ),
      (
        'terroirdame',
        'article',
        'Loire: de mest underskattade chenins',
        '{"regions":["Savennières","Anjou Noir","Jasnières"],"comment":"Stor komplexitet och lagringspotential till vettiga priser."}'::jsonb
      ),
      (
        'terroirdame',
        'tip',
        'Bourgogne-bluffen — vad du betalar för egentligen',
        '{"points":["Klassifikation och läge styr priset mer än kvalitet ibland.","Producentens stil är avgörande.","Hög hype = sällan bäst värde."]}'::jsonb
      ),
      (
        'cellargeek',
        'tip',
        '5 druvor som nästan alltid vinner på 5 års lagring',
        '{"grapes":["Nebbiolo","Cabernet Sauvignon","Syrah","Riesling","Chenin Blanc"],"note":"Gemensamt: hög syra, tydlig struktur och koncentration."}'::jsonb
      ),
      (
        'cellargeek',
        'article',
        'Bygg en vinkällare för under 3 000 kr',
        '{"sections":["Hitta sval plats (kall garderob/källare).","Köp 12-flaskors metall- eller träställ.","Välj 6 flaskor att dricka ungt, 6 att spara 3–5 år."]}'::jsonb
      ),
      (
        'cellargeek',
        'article',
        'Metadata: därför är etikettbilden viktigare än du tror',
        '{"topics":["OCR","Streckkod","Label-hash","Vintage-precision"],"note":"Bra bild ger bättre identifiering och färre felmatchningar."}'::jsonb
      ),
      (
        'foodwineeveryday',
        'pairing',
        'Vardagsmatchning: Bolognese + Montepulciano',
        '{"dish":"Spaghetti bolognese","wine":"Montepulciano d\'Abruzzo","why":"Syran i vinet möter tomatsåsen, tanninerna klarar köttfärsen."}'::jsonb
      ),
      (
        'foodwineeveryday',
        'tip',
        '3 vita viner under 120 kr till fiskpinnar',
        '{"wines":["En enkel Albariño","En frisk Grüner Veltliner","En lätt Colombard från sydvästra Frankrike"],"note":"Fokus på citron, fräschör och låg ek."}'::jsonb
      ),
      (
        'foodwineeveryday',
        'pairing',
        'Billig helglyx: kyckling + rosé',
        '{"dish":"Grillad kyckling med citron och örter","wine":"Lätt, bärig rosé från Provence eller liknande stil","why":"Roséns bärighet och syra lyfter både citron och örter."}'::jsonb
      ),
      (
        'winesnap_team',
        'article',
        'Trendrapport: vad WineSnap-användare skannar just nu',
        '{"note":"Exempeldata – kan bytas mot riktiga aggregeringar senare.","trends":["Prosecco","Rioja Crianza","Marlborough Sauvignon Blanc"]}'::jsonb
      ),
      (
        'winesnap_team',
        'tip',
        'Lär dig 5 druvor på 2 minuter',
        '{"grapes":["Pinot Noir – röd frukt, hög syra.","Chardonnay – neutral druva, speglar platsen.","Tempranillo – ryggraden i Rioja.","Riesling – hög syra, ofta lite petroleum med ålder.","Syrah – mörk frukt, peppar, struktur."]}'::jsonb
      ),
      (
        'winesnap_team',
        'tip',
        'Så får du bäst etikettkvalitet i kameran',
        '{"tips":["Använd dagsljus eller mjuk inomhusbelysning.","Undvik starka reflexer och blixt rakt mot etiketten.","Håll telefonen rakt mot flaskan.","Låt etiketten fylla ramen på skärmen."]}'::jsonb
      )
  ) as payload(handle, type, title, body_json)
)
insert into public.creator_posts (id, creator_id, type, title, body_json)
select gen_random_uuid(), c.id, p.type, p.title, p.body_json
from posts p
join upserted_creators c on c.handle = p.handle
on conflict (id) do nothing;
