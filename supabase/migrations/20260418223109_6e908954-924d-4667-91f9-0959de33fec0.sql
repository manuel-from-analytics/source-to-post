-- Table for multiple newsletter preference profiles per user
CREATE TABLE IF NOT EXISTS public.newsletter_preference_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  preferences text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_preference_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own newsletter preference profiles"
ON public.newsletter_preference_profiles
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_newsletter_pref_profiles_user ON public.newsletter_preference_profiles(user_id);

CREATE TRIGGER update_newsletter_pref_profiles_updated_at
BEFORE UPDATE ON public.newsletter_preference_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing profiles.newsletter_preferences into a default profile per user
INSERT INTO public.newsletter_preference_profiles (user_id, name, preferences, is_default)
SELECT id, 'Predeterminado', COALESCE(newsletter_preferences, ''), true
FROM public.profiles
WHERE newsletter_preferences IS NOT NULL
  AND length(trim(newsletter_preferences)) > 0;