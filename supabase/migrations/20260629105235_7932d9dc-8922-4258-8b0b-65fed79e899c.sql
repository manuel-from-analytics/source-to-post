
CREATE TABLE public.auto_publish_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES public.auto_publish_schedules(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL,
  message TEXT,
  post_id UUID,
  linkedin_url TEXT,
  target TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_publish_runs TO authenticated;
GRANT ALL ON public.auto_publish_runs TO service_role;
ALTER TABLE public.auto_publish_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own auto-publish runs" ON public.auto_publish_runs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_auto_publish_runs_user_started ON public.auto_publish_runs(user_id, started_at DESC);
