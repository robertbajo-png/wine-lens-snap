-- Create analysis_feedback table for user feedback on analyses
create table if not exists public.analysis_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scan_id uuid not null references public.scans(id) on delete cascade,
  label_hash text not null,
  is_correct boolean not null,
  comment text,
  created_at timestamptz not null default now()
);

alter table public.analysis_feedback enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'analysis_feedback' and policyname = 'select_own_analysis_feedback'
  ) then
    create policy select_own_analysis_feedback on public.analysis_feedback
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'analysis_feedback' and policyname = 'insert_own_analysis_feedback'
  ) then
    create policy insert_own_analysis_feedback on public.analysis_feedback
      for insert with check (auth.uid() = user_id);
  end if;
end
$$;
