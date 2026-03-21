-- Tighten event_logs INSERT policy: require authenticated user
DROP POLICY IF EXISTS "Anyone can insert event logs" ON public.event_logs;

CREATE POLICY "Authenticated users can insert event logs"
ON public.event_logs
FOR INSERT
TO authenticated
WITH CHECK (true);