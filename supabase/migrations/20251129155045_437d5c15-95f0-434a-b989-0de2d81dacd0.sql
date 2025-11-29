
-- Fix client_logs to allow anonymous logging (for error tracking)
DROP POLICY IF EXISTS "Authenticated users can insert client logs" ON public.client_logs;
CREATE POLICY "Anyone can insert client logs" ON public.client_logs 
  FOR INSERT WITH CHECK (true);

-- Make telemetry_events work for anonymous users too
DROP POLICY IF EXISTS "Users can insert telemetry" ON public.telemetry_events;
CREATE POLICY "Anyone can insert telemetry" ON public.telemetry_events 
  FOR INSERT WITH CHECK (true);

-- Make event_logs work for anonymous users
DROP POLICY IF EXISTS "Users can insert event logs" ON public.event_logs;
CREATE POLICY "Anyone can insert event logs" ON public.event_logs 
  FOR INSERT WITH CHECK (true);

-- Add policy for scans to allow public SELECT for explore feature (wine catalog)
CREATE POLICY "Public can view public scans" ON public.scans 
  FOR SELECT USING (user_id IS NULL);

-- Fix label_history policies to be PERMISSIVE (change from RESTRICTIVE)
-- First drop the restrictive policies
DROP POLICY IF EXISTS "Service role full access" ON public.label_history;
DROP POLICY IF EXISTS "Users can delete own history" ON public.label_history;
DROP POLICY IF EXISTS "Users can insert own history" ON public.label_history;
DROP POLICY IF EXISTS "Users can update own history" ON public.label_history;
DROP POLICY IF EXISTS "Users can view own history" ON public.label_history;

-- Recreate as PERMISSIVE policies (default)
CREATE POLICY "Users can view own history" ON public.label_history
  FOR SELECT USING ((auth.uid())::text = user_id);

CREATE POLICY "Users can insert own history" ON public.label_history
  FOR INSERT WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Users can update own history" ON public.label_history
  FOR UPDATE USING ((auth.uid())::text = user_id)
  WITH CHECK ((auth.uid())::text = user_id);

CREATE POLICY "Users can delete own history" ON public.label_history
  FOR DELETE USING ((auth.uid())::text = user_id);
