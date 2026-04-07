ALTER TABLE public.generated_posts
  ADD COLUMN language text,
  ADD COLUMN cta text,
  ADD COLUMN length text,
  ADD COLUMN content_focus text,
  ADD COLUMN voice_id uuid REFERENCES public.voices(id) ON DELETE SET NULL;