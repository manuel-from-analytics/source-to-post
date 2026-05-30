DO $$
DECLARE
  v_secret text;
BEGIN
  SELECT cron_secret INTO v_secret FROM public.agent_internal_config WHERE id = 1;

  -- remove any existing job with same name
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'agent-health-check-quarterhour';

  PERFORM cron.schedule(
    'agent-health-check-quarterhour',
    '*/15 * * * *',
    format($cron$
      SELECT net.http_post(
        url := 'https://ofpnsqvcagowvaavzzxh.supabase.co/functions/v1/agent-health-check',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := '{}'::jsonb
      );
    $cron$, v_secret)
  );
END$$;