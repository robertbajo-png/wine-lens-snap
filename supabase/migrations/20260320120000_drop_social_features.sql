-- Drop social features: creators, follows, posts, and feed state

-- Drop routines first to avoid lingering dependencies
drop function if exists public.touch_user_feed_state() cascade;
drop function if exists public.set_user_feed_state_updated_at() cascade;
drop function if exists public.sync_creator_followers_count() cascade;
drop function if exists public.update_followers_count() cascade;
drop function if exists public.is_admin() cascade;

-- Drop tables and related objects
drop table if exists public.user_feed_state cascade;
drop table if exists public.user_follows cascade;
drop table if exists public.creator_posts cascade;
drop table if exists public.creators cascade;
drop table if exists public.follows cascade;
drop table if exists public.accounts cascade;
