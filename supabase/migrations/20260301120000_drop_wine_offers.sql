-- Remove wine_offers marketplace artifacts
DROP TRIGGER IF EXISTS update_wine_offers_updated_at ON public.wine_offers;
DROP POLICY IF EXISTS "Wine offers are viewable by everyone" ON public.wine_offers;
DROP POLICY IF EXISTS "Anyone can read wine offers" ON public.wine_offers;
DROP POLICY IF EXISTS "Service role can manage wine offers" ON public.wine_offers;
DROP INDEX IF EXISTS idx_wine_offers_label_hash;
DROP TABLE IF EXISTS public.wine_offers;
