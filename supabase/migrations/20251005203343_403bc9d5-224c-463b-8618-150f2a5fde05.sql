-- Create cache table for wine analysis
CREATE TABLE IF NOT EXISTS public.winesnap_cache (
  key text PRIMARY KEY,
  data jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_winesnap_cache_created_at ON public.winesnap_cache(created_at);

-- Enable RLS
ALTER TABLE public.winesnap_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read cache
CREATE POLICY "Anyone can read cache"
ON public.winesnap_cache
FOR SELECT
USING (true);

-- Policy: Service role can insert/update cache
CREATE POLICY "Service role can manage cache"
ON public.winesnap_cache
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');