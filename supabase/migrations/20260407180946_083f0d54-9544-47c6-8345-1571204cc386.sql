ALTER TABLE public.profiles
  ADD COLUMN default_voice_id uuid DEFAULT NULL,
  ADD COLUMN default_length text DEFAULT NULL,
  ADD COLUMN default_cta text DEFAULT NULL;