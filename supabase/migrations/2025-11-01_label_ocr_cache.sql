-- Server-side OCR cache for preprocessed label images
create table if not exists public.label_ocr_cache (
  image_hash text primary key,
  ocr_text   text not null,
  ts         timestamptz not null default now()
);
-- Minimal RLS: allow read for anon if you want (optional). We’ll write via service role from Edge.
alter table public.label_ocr_cache enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='label_ocr_cache' and policyname='read_public_ocr_cache'
  ) then
    create policy read_public_ocr_cache on public.label_ocr_cache
      for select using (true);
  end if;
end $$;
