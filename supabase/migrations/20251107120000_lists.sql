-- Create personal wine lists and list items for saved scans
create table if not exists public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now()
);

create table if not exists public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.lists(id) on delete cascade,
  scan_id uuid not null references public.scans(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint list_items_unique_per_list unique (list_id, scan_id)
);

alter table public.lists enable row level security;
alter table public.list_items enable row level security;

create policy if not exists lists_select_own on public.lists
  for select
  using (auth.uid() = user_id);

create policy if not exists lists_insert_own on public.lists
  for insert
  with check (auth.uid() = user_id);

create policy if not exists lists_update_own on public.lists
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy if not exists lists_delete_own on public.lists
  for delete
  using (auth.uid() = user_id);

create policy if not exists list_items_select_own on public.list_items
  for select
  using (
    exists (
      select 1
      from public.lists
      where lists.id = list_items.list_id
        and lists.user_id = auth.uid()
    )
  );

create policy if not exists list_items_insert_own on public.list_items
  for insert
  with check (
    exists (
      select 1
      from public.lists
      where lists.id = list_items.list_id
        and lists.user_id = auth.uid()
    )
  );

create policy if not exists list_items_delete_own on public.list_items
  for delete
  using (
    exists (
      select 1
      from public.lists
      where lists.id = list_items.list_id
        and lists.user_id = auth.uid()
    )
  );
