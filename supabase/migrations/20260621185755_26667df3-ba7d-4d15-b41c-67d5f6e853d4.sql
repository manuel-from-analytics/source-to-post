
-- Add optional linkedin_url to generated_posts
ALTER TABLE public.generated_posts
  ADD COLUMN IF NOT EXISTS linkedin_url text;

-- Source enum
DO $$ BEGIN
  CREATE TYPE public.linkedin_post_source AS ENUM ('personal', 'company');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.linkedin_post_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.generated_posts(id) ON DELETE SET NULL,
  source public.linkedin_post_source NOT NULL,
  linkedin_url text,
  linkedin_urn text,
  post_title text,
  post_excerpt text,
  posted_at timestamptz,
  impressions integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  reactions integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  engagement_rate numeric(8,5) NOT NULL DEFAULT 0,
  raw jsonb,
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX linkedin_post_metrics_user_source_urn_uniq
  ON public.linkedin_post_metrics (user_id, source, linkedin_urn)
  WHERE linkedin_urn IS NOT NULL;

CREATE UNIQUE INDEX linkedin_post_metrics_user_source_url_uniq
  ON public.linkedin_post_metrics (user_id, source, linkedin_url)
  WHERE linkedin_urn IS NULL AND linkedin_url IS NOT NULL;

CREATE INDEX linkedin_post_metrics_user_idx ON public.linkedin_post_metrics(user_id);
CREATE INDEX linkedin_post_metrics_post_idx ON public.linkedin_post_metrics(post_id);
CREATE INDEX linkedin_post_metrics_posted_at_idx ON public.linkedin_post_metrics(posted_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_post_metrics TO authenticated;
GRANT ALL ON public.linkedin_post_metrics TO service_role;

ALTER TABLE public.linkedin_post_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own linkedin metrics"
  ON public.linkedin_post_metrics
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_linkedin_post_metrics_updated_at
  BEFORE UPDATE ON public.linkedin_post_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
