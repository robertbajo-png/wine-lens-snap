
-- 1. Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- 2. Create scans table
CREATE TABLE public.scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  label_hash text,
  raw_ocr text,
  image_thumb text,
  analysis_json jsonb,
  vintage integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scans_label_hash ON public.scans(label_hash);
CREATE INDEX idx_scans_user_id ON public.scans(user_id);

ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scans" ON public.scans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scans" ON public.scans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own scans" ON public.scans FOR DELETE USING (auth.uid() = user_id);

-- 3. Create lists table
CREATE TABLE public.lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lists" ON public.lists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lists" ON public.lists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lists" ON public.lists FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lists" ON public.lists FOR DELETE USING (auth.uid() = user_id);

-- 4. Create list_items table
CREATE TABLE public.list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(list_id, scan_id)
);

ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own list items" ON public.list_items FOR SELECT 
  USING (EXISTS (SELECT 1 FROM public.lists WHERE lists.id = list_items.list_id AND lists.user_id = auth.uid()));
CREATE POLICY "Users can insert own list items" ON public.list_items FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.lists WHERE lists.id = list_items.list_id AND lists.user_id = auth.uid()));
CREATE POLICY "Users can delete own list items" ON public.list_items FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.lists WHERE lists.id = list_items.list_id AND lists.user_id = auth.uid()));

-- 5. Create explore_cards table
CREATE TABLE public.explore_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  producer text,
  region text,
  grapes_raw text,
  style text,
  color text,
  notes text,
  image_url text,
  rank integer,
  payload_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.explore_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Explore cards are viewable by everyone" ON public.explore_cards FOR SELECT USING (true);

-- 6. Create wine_index table
CREATE TABLE public.wine_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  producer text,
  region text,
  country text,
  grapes text,
  style text,
  color text,
  vintage integer,
  payload_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wine_index ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Wine index is viewable by everyone" ON public.wine_index FOR SELECT USING (true);

-- 7. Create telemetry_events table
CREATE TABLE public.telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  payload_json jsonb,
  session_id text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert telemetry" ON public.telemetry_events FOR INSERT WITH CHECK (true);

-- 8. Create event_logs table
CREATE TABLE public.event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_name text NOT NULL,
  properties jsonb DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert event logs" ON public.event_logs FOR INSERT WITH CHECK (true);

-- 9. Create client_logs table
CREATE TABLE public.client_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  view text NOT NULL,
  action text NOT NULL,
  level text NOT NULL DEFAULT 'error',
  message text NOT NULL,
  details jsonb DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert client logs" ON public.client_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 10. Create user_settings table
CREATE TABLE public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can upsert own settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);

-- 11. Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 12. Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
