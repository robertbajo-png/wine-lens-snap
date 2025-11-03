-- Drop existing policies
DROP POLICY IF EXISTS "Service role can manage history" ON public.label_history;
DROP POLICY IF EXISTS "Users can read own history" ON public.label_history;

-- Create new policies with proper user_id filtering
CREATE POLICY "Users can view own history"
  ON public.label_history
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can insert own history"
  ON public.label_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can update own history"
  ON public.label_history
  FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can delete own history"
  ON public.label_history
  FOR DELETE
  TO authenticated
  USING (auth.uid()::text = user_id);

CREATE POLICY "Service role full access"
  ON public.label_history
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);