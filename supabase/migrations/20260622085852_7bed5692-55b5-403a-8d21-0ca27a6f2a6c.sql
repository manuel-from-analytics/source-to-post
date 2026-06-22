CREATE UNIQUE INDEX IF NOT EXISTS linkedin_post_metrics_user_source_urn_key
  ON public.linkedin_post_metrics (user_id, source, linkedin_urn);

ALTER TABLE public.linkedin_post_metrics
  ADD CONSTRAINT linkedin_post_metrics_user_source_urn_unique
  UNIQUE USING INDEX linkedin_post_metrics_user_source_urn_key;