-- Create analysis_Feedback table for user Feedback on analyses
create table if not exists public.analysis_Feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  scan_id uuid not null references public.scans(id) on delete cascade,
  label_hash text not null,
  is_correct boolean not null,
  comment text,
  created_at timestamptz not null default now()
);

alter table public.analysis_Feedback enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'analysis_Feedback' and policyname = 'select_own_analysis_Feedback'
  ) then
    create policy select_own_analysis_Feedback on public.analysis_Feedback
      for select using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'analysis_Feedback' and policyname = 'insert_own_analysis_Feedback'
  ) then
    create policy insert_own_analysis_Feedback on public.analysis_Feedback
      for insert with check (auth.uid() = user_id);
  end if;
end
$$;
