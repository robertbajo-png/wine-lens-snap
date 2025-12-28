-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Service role can manage cache" ON public.winesnap_cache;

-- Create new permissive policy for service role (for all operations)
CREATE POLICY "Service role can manage cache" 
ON public.winesnap_cache
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);