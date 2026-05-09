
ALTER TABLE public.generated_posts
  ADD COLUMN IF NOT EXISTS source_newsletter_id uuid,
  ADD COLUMN IF NOT EXISTS source_newsletter_item_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS generated_posts_user_newsletter_item_uniq
  ON public.generated_posts (user_id, source_newsletter_item_id)
  WHERE source_newsletter_item_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.agent_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.agent_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own agent api keys"
  ON public.agent_api_keys FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.agent_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  newsletter_id uuid,
  posts_created integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'running',
  error text,
  notified_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own agent runs"
  ON public.agent_runs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
