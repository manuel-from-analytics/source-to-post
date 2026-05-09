
CREATE TABLE public.agent_internal_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cron_secret text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.agent_internal_config (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.agent_internal_config ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anon/authenticated. Only service role can read.
