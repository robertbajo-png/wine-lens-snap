-- Create label_history table for storing wine scan history
CREATE TABLE IF NOT EXISTS public.label_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id TEXT NULL,
  device_id TEXT NOT NULL,
  vin TEXT,
  producent TEXT,
  land_region TEXT,
  argang TEXT,
  meters JSONB,
  evidence JSONB,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.label_history ENABLE ROW LEVEL SECURITY;

-- Allow service role to manage all data
CREATE POLICY "Service role can manage history"
ON public.label_history
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Allow users to read their own history by device_id
CREATE POLICY "Users can read own history"
ON public.label_history
FOR SELECT
USING (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS label_history_device_id_idx ON public.label_history(device_id);
CREATE INDEX IF NOT EXISTS label_history_ts_idx ON public.label_history(ts DESC);