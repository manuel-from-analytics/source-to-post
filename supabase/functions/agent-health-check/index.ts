// agent-health-check: detects agent_runs stuck in "running" for too long,
// marks them as errored, and notifies the user via email.
// Invoked by pg_cron every 15 minutes with x-cron-secret header.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { appHubNotify } from "../_shared/apphub-notify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// A run is considered "stuck" after this many minutes still in status=running.
// The whole orchestration normally completes in 1–3 min; 25m is a safe ceiling.
const STUCK_THRESHOLD_MIN = 25;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Auth: accept cron secret OR service role
    const cronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization") || "";
    let authorized = false;
    if (cronSecret) {
      const { data: cfg } = await admin.from("agent_internal_config").select("cron_secret").eq("id", 1).maybeSingle();
      if (cfg && cronSecret === cfg.cron_secret) authorized = true;
    }
    if (!authorized && authHeader === `Bearer ${SERVICE_ROLE}`) authorized = true;
    if (!authorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MIN * 60_000).toISOString();
    const { data: stuck, error } = await admin
      .from("agent_runs")
      .select("id, user_id, started_at")
      .eq("status", "running")
      .lt("started_at", cutoff);
    if (error) throw error;

    const alerts: any[] = [];
    for (const run of stuck || []) {
      const startedMs = new Date(run.started_at).getTime();
      const durationMinutes = Math.round((Date.now() - startedMs) / 60000);

      // Mark as error so it stops showing as running.
      await admin.from("agent_runs").update({
        status: "error",
        error: `Run stuck in 'running' for ${durationMinutes}m — marked by health-check`,
        finished_at: new Date().toISOString(),
      }).eq("id", run.id);

      // Get schedule topic for context
      const { data: sched } = await admin.from("agent_schedules")
        .select("topic").eq("user_id", run.user_id).maybeSingle();

      const ok = await appHubNotify({
        title: "Agente bloqueado",
        status: "error",
        body: [
          sched?.topic ? `**Tema:** ${sched.topic}` : null,
          `**Inicio:** ${run.started_at}`,
          `**Duración:** ${durationMinutes} min`,
          `\nLa ejecución ha estado bloqueada >${STUCK_THRESHOLD_MIN} minutos.`,
        ].filter(Boolean).join("\n"),
        metadata: {
          alert_type: "stuck",
          run_id: run.id,
          started_at: run.started_at,
          duration_minutes: durationMinutes,
          topic: sched?.topic || undefined,
        },
      });
      alerts.push({ run_id: run.id, durationMinutes, notified: ok });
    }

    return new Response(JSON.stringify({ checked: (stuck || []).length, alerts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("agent-health-check error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
