ALTER TABLE public.generated_posts
ADD COLUMN published_at timestamp with time zone;

UPDATE public.generated_posts
SET published_at = updated_at
WHERE status = 'published' AND published_at IS NULL;