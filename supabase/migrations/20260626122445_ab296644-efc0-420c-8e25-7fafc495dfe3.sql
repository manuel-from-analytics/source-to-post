CREATE TABLE public.auto_publish_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  days_of_week int[] NOT NULL DEFAULT ARRAY[1,3,5]::int[],
  hour int NOT NULL DEFAULT 11 CHECK (hour BETWEEN 0 AND 23),
  timezone text NOT NULL DEFAULT 'Europe/Madrid',
  target text NOT NULL DEFAULT 'personal' CHECK (target IN ('personal','company')),
  notification_email text,
  last_run_at timestamptz,
  last_run_status text,
  last_run_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.auto_publish_schedules TO authenticated;
GRANT ALL ON public.auto_publish_schedules TO service_role;

ALTER TABLE public.auto_publish_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own auto publish schedule"
ON public.auto_publish_schedules
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_auto_publish_schedules_updated_at
BEFORE UPDATE ON public.auto_publish_schedules
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();