
-- Enable extensions for scheduled HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedules table: one row per user, controls the daily agent
CREATE TABLE public.agent_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  run_hour integer NOT NULL DEFAULT 7 CHECK (run_hour >= 0 AND run_hour <= 23),
  timezone text NOT NULL DEFAULT 'UTC',
  preference_profile_id uuid,
  voice_id uuid,
  tone text,
  length text,
  cta text,
  goal text,
  language text,
  target_audience text,
  content_focus text,
  notification_email text,
  extract_content boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own agent schedule"
  ON public.agent_schedules FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_agent_schedules_updated_at
  BEFORE UPDATE ON public.agent_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Allow agent_runs inserts so the daily-agent function (service role) is fine,
-- but also allow users to insert/update their own (for "Run now" button via edge function we still use service role).
CREATE POLICY "Users insert own agent runs"
  ON public.agent_runs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
