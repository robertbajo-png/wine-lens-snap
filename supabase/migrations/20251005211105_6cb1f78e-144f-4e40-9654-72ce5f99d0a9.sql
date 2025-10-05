-- Security fix: Remove public read access to cache table
-- Edge function will continue to work using service role key which bypasses RLS
DROP POLICY IF EXISTS "Anyone can read cache" ON public.winesnap_cache;