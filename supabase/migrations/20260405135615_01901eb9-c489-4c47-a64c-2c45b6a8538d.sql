
-- Create voices table
CREATE TABLE public.voices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own voices" ON public.voices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own voices" ON public.voices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own voices" ON public.voices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own voices" ON public.voices FOR DELETE USING (auth.uid() = user_id);

-- Add voice_id to voice_samples
ALTER TABLE public.voice_samples ADD COLUMN voice_id UUID REFERENCES public.voices(id) ON DELETE CASCADE;

-- Create a default voice for existing samples
DO $$
DECLARE
  v_user_id UUID;
  v_voice_id UUID;
BEGIN
  FOR v_user_id IN SELECT DISTINCT user_id FROM public.voice_samples
  LOOP
    INSERT INTO public.voices (user_id, name) VALUES (v_user_id, 'Mi Voz') RETURNING id INTO v_voice_id;
    UPDATE public.voice_samples SET voice_id = v_voice_id WHERE user_id = v_user_id AND voice_id IS NULL;
  END LOOP;
END $$;

-- Make voice_id NOT NULL after migration
ALTER TABLE public.voice_samples ALTER COLUMN voice_id SET NOT NULL;
