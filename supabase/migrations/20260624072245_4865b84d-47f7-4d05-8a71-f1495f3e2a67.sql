ALTER TABLE public.linkedin_post_metrics
  ADD COLUMN IF NOT EXISTS manually_unmatched boolean NOT NULL DEFAULT false;