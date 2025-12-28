-- Seed data for wine_offers
-- Each row links a label_hash to a merchant with price and URL.
insert into public.wine_offers
  (id, label_hash, merchant_name, url, price, currency, country, source, created_at)
values
  (gen_random_uuid(), 'cabernet-sauvignon-2021', 'Vinoteket', 'https://example.com/cabernet-sauvignon-2021', 249.00, 'SEK', 'SE', 'manual', now()),
  (gen_random_uuid(), 'sangiovese-rosso-2020',    'WineDirect', 'https://example.com/sangiovese-rosso-2020',    199.00, 'SEK', 'SE', 'manual', now()),
  (gen_random_uuid(), 'sangiovese-rosso-2020',    'Bolaget',    'https://example.com/sangiovese-rosso-2020-bolaget', 189.00, 'SEK', 'SE', 'manual', now()),
  (gen_random_uuid(), 'chianti-classico-2019',    'Vinoteket', 'https://example.com/chianti-classico-2019',    229.00, 'SEK', 'SE', 'manual', now());

-- Note: use the same normalization as computeLabelHash() (lowercase, hyphens, and without diacritics)
-- so that the label text matches the label_hash stored in the database.
