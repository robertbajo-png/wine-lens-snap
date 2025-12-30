-- Drop the existing permissive INSERT policy that allows anyone
DROP POLICY IF EXISTS "Anyone can insert telemetry" ON public.telemetry_events;

-- Create a new policy that only allows authenticated users to insert telemetry
CREATE POLICY "Authenticated users can insert telemetry" 
ON public.telemetry_events 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);