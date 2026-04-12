-- Drop old public-role policies
DROP POLICY IF EXISTS "Users can view their own voices" ON public.voices;
DROP POLICY IF EXISTS "Users can create their own voices" ON public.voices;
DROP POLICY IF EXISTS "Users can update their own voices" ON public.voices;
DROP POLICY IF EXISTS "Users can delete their own voices" ON public.voices;

-- Recreate with authenticated role
CREATE POLICY "Users can manage own voices"
ON public.voices
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);