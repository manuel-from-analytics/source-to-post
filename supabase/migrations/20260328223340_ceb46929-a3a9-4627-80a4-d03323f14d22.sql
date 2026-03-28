
CREATE TABLE public.voice_samples (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.voice_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own voice_samples"
  ON public.voice_samples
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
