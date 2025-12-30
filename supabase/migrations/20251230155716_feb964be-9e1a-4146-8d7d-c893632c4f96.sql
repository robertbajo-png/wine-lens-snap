-- Drop the existing permissive INSERT policy that allows anyone
DROP POLICY IF EXISTS "Anyone can insert client logs" ON public.client_logs;

-- Create a new policy that only allows authenticated users to insert logs
CREATE POLICY "Authenticated users can insert client logs" 
ON public.client_logs 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);