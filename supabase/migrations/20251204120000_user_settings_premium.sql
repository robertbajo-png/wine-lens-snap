-- Add premium flags to user_settings
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS is_premium boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_since timestamptz;
