-- Drop premium checkout sessions artifacts if they exist
drop policy if exists premium_checkout_sessions_select_own on public.premium_checkout_sessions;

drop index if exists public.premium_checkout_sessions_user_idx;

drop table if exists public.premium_checkout_sessions;
