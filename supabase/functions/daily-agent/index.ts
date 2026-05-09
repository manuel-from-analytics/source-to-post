// Daily agent: orchestrates newsletter generation, post drafting, and notification.
// Invoked by pg_cron hourly (matches schedules where run_hour == current UTC hour)
// or manually by users via "Run now" (with their JWT).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
// Cron secret is read from the agent_internal_config table at request time.

const goalMap: Record<string, string> = { educate: "Educar a la audiencia", inspire: "Inspirar y motivar", promote: "Promocionar un producto o servicio", engage: "Generar engagement y conversación", storytelling: "Contar una historia" };
const toneMap: Record<string, string> = { professional: "profesional", casual: "casual y cercano", inspirational: "inspiracional", direct: "directo y conciso", humorous: "con humor" };
const lengthMap: Record<string, string> = { short: "corto (~100 palabras)", medium: "medio (~200 palabras)", long: "largo (~300 palabras)" };
const ctaMap: Record<string, string> = { question: "una pregunta abierta al lector", share: "invitar a compartir", follow: "invitar a seguir", link: "invitar a visitar un enlace", none: "sin call to action" };
const langMap: Record<string, string> = { es: "español", en: "inglés", pt: "portugués" };

async function generateContent(supabase: SupabaseClient, params: any): Promise<string> {
  let sourceTexts: string[] = [];
  if (params.input_ids?.length) {
    const { data: inputs } = await supabase.from("inputs")
      .select("title, raw_content, extracted_content, summary, original_url, type")
      .in("id", params.input_ids);
    sourceTexts = (inputs || []).map((inp: any) => {
      const content = inp.extracted_content || inp.raw_content || inp.summary || "";
      return `[${inp.type.toUpperCase()}] ${inp.title}\n${content}${inp.original_url ? `\nURL: ${inp.original_url}` : ""}`;
    });
  }
  let voiceTexts: string[] = [];
  if (params.voice_id) {
    const { data: samples } = await supabase.from("voice_samples")
      .select("title, content").eq("voice_id", params.voice_id).limit(10);
    if (samples?.length) voiceTexts = samples.map((s: any) => `${s.title ? `[${s.title}] ` : ""}${s.content}`);
  }

  let systemPrompt = `Eres un experto creador de contenido para LinkedIn.\nGeneras posts de alta calidad, optimizados para engagement.\nUsa emojis con moderación, formato con saltos de línea y estructura visual clara.\nNO uses markdown (ni asteriscos ni negritas), escribe en texto plano.\nIMPORTANTE: NO empieces el post con texto entre corchetes.`;
  if (voiceTexts.length > 0) {
    systemPrompt += `\n\nESTILO DE ESCRITURA - Imita este estilo:\n${voiceTexts.map((t, i) => `--- Ejemplo ${i + 1} ---\n${t}`).join("\n\n")}\n--- Fin ---`;
  }

  let userPrompt = "Genera un post para LinkedIn";
  if (sourceTexts.length > 0) userPrompt += ` basándote en:\n\n${sourceTexts.join("\n\n---\n\n")}`;
  const specs: string[] = [];
  if (params.goal && goalMap[params.goal]) specs.push(`Objetivo: ${goalMap[params.goal]}`);
  if (params.tone && toneMap[params.tone]) specs.push(`Tono: ${toneMap[params.tone]}`);
  if (params.language && langMap[params.language]) specs.push(`Idioma: ${langMap[params.language]}`);
  if (params.length && lengthMap[params.length]) specs.push(`Longitud: ${lengthMap[params.length]}`);
  if (params.cta && ctaMap[params.cta]) specs.push(`CTA: ${ctaMap[params.cta]}`);
  if (params.target_audience) specs.push(`Audiencia objetivo: ${params.target_audience}`);
  if (specs.length) userPrompt += `\n\nEspecificaciones:\n${specs.join("\n")}`;
  if (params.content_focus) userPrompt += `\n\nENFOQUE:\n${params.content_focus}`;
  userPrompt += "\n\nDevuelve solo el post, sin explicaciones ni metadatos.";

  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");
  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
    }),
  });
  if (!aiResponse.ok) throw new Error(`AI error ${aiResponse.status}: ${await aiResponse.text()}`);
  const aiResult = await aiResponse.json();
  return (aiResult.choices?.[0]?.message?.content || "").replace(/^\s*\[.*?\]\s*/g, "");
}

async function runForUser(userId: string, opts: { triggered_by: "cron" | "manual" }): Promise<any> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Load schedule
  const { data: schedule } = await admin.from("agent_schedules").select("*").eq("user_id", userId).maybeSingle();
  if (!schedule) throw new Error("No agent schedule configured");
  if (opts.triggered_by === "cron" && !schedule.enabled) {
    return { skipped: true, reason: "schedule disabled" };
  }

  // Load profile defaults as fallback
  const { data: profile } = await admin.from("profiles").select("*").eq("id", userId).maybeSingle();

  // Open agent_run
  const { data: run } = await admin.from("agent_runs").insert({
    user_id: userId, status: "running", posts_created: 0,
  }).select().single();

  try {
    // 1) Generate newsletter (internal call)
    const topic = (schedule.topic && schedule.topic.trim()) || "AI and analytics latest insights";
    const nlResp = await fetch(`${SUPABASE_URL}/functions/v1/generate-newsletter`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        "x-internal-user-id": userId,
      },
      body: JSON.stringify({
        topic,
        profile_id: schedule.preference_profile_id || undefined,
      }),
    });
    if (!nlResp.ok) throw new Error(`generate-newsletter failed ${nlResp.status}: ${await nlResp.text()}`);
    const nlData = await nlResp.json();
    const newsletterId = nlData.id || nlData.newsletter_id;
    if (!newsletterId) throw new Error("No newsletter_id returned");

    await admin.from("agent_runs").update({ newsletter_id: newsletterId }).eq("id", run.id);

    // 2) Get items
    const { data: items } = await admin.from("newsletter_items")
      .select("*").eq("newsletter_id", newsletterId);

    const postIds: string[] = [];
    for (const item of items || []) {
      // Idempotency
      const { data: existing } = await admin.from("generated_posts")
        .select("id").eq("user_id", userId).eq("source_newsletter_item_id", item.id).maybeSingle();
      if (existing) { postIds.push(existing.id); continue; }

      // Ensure input
      let inputId = item.input_id;
      if (!inputId) {
        const isYoutube = (item.url || "").includes("youtube.com") || (item.url || "").includes("youtu.be");
        let extracted: string | null = null;
        if (schedule.extract_content) {
          try {
            const ex = await fetch(`${SUPABASE_URL}/functions/v1/extract-url`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${SERVICE_ROLE}`,
                "Content-Type": "application/json",
                apikey: SUPABASE_ANON_KEY,
                "x-internal-user-id": userId,
              },
              body: JSON.stringify({ url: item.url }),
            });
            if (ex.ok) { const d = await ex.json(); extracted = d.content || d.extracted_content || null; }
          } catch (_) { /* best-effort */ }
        }
        const { data: newInput, error: ie } = await admin.from("inputs").insert({
          user_id: userId, title: item.title, type: isYoutube ? "youtube" : "url",
          original_url: item.url, raw_content: extracted, summary: item.description || null,
        }).select().single();
        if (ie) { console.error("input insert failed", ie); continue; }
        inputId = newInput.id;
        await admin.from("newsletter_items").update({ imported_to_library: true, input_id: inputId }).eq("id", item.id);
      }

      try {
        const content = await generateContent(admin, {
          input_ids: [inputId],
          voice_id: schedule.voice_id || profile?.default_voice_id || undefined,
          tone: schedule.tone || undefined,
          length: schedule.length || profile?.default_length || undefined,
          cta: schedule.cta || profile?.default_cta || undefined,
          goal: schedule.goal || undefined,
          language: schedule.language || profile?.preferred_language || undefined,
          target_audience: schedule.target_audience || undefined,
          content_focus: schedule.content_focus || undefined,
        });
        const { data: post, error: pe } = await admin.from("generated_posts").insert({
          user_id: userId, content, title: item.title,
          input_id: inputId, input_ids: [inputId],
          tone: schedule.tone || null,
          length: schedule.length || profile?.default_length || null,
          cta: schedule.cta || profile?.default_cta || null,
          goal: schedule.goal || null,
          language: schedule.language || profile?.preferred_language || null,
          target_audience: schedule.target_audience || null,
          content_focus: schedule.content_focus || null,
          voice_id: schedule.voice_id || profile?.default_voice_id || null,
          status: "draft",
          source_newsletter_id: newsletterId,
          source_newsletter_item_id: item.id,
        }).select("id").single();
        if (pe) { console.error("post insert failed", pe); continue; }
        postIds.push(post.id);
      } catch (e: any) {
        console.error("generate failed for item", item.id, e.message);
      }
    }

    // 3) Notify
    let notified = false;
    if (postIds.length > 0) {
      try {
        const nr = await fetch(`${SUPABASE_URL}/functions/v1/notify-review`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${SERVICE_ROLE}`,
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            "x-internal-user-id": userId,
          },
          body: JSON.stringify({
            post_ids: postIds,
            to: schedule.notification_email || undefined,
            subject: `${postIds.length} posts listos para revisar`,
          }),
        });
        notified = nr.ok;
        if (!nr.ok) console.error("notify failed", await nr.text());
      } catch (e: any) { console.error("notify error", e.message); }
    }

    await admin.from("agent_runs").update({
      status: postIds.length > 0 ? "success" : "partial",
      posts_created: postIds.length,
      finished_at: new Date().toISOString(),
      notified_at: notified ? new Date().toISOString() : null,
    }).eq("id", run.id);

    await admin.from("agent_schedules").update({ last_run_at: new Date().toISOString() }).eq("user_id", userId);

    return { ok: true, run_id: run.id, newsletter_id: newsletterId, posts_created: postIds.length, post_ids: postIds, notified };
  } catch (e: any) {
    await admin.from("agent_runs").update({
      status: "error", error: e.message, finished_at: new Date().toISOString(),
    }).eq("id", run.id);
    throw e;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const cronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");
    const body = await req.json().catch(() => ({}));

    // CRON path: invoked by pg_cron with shared secret. Iterates all schedules whose run_hour == current UTC hour.
    if (cronSecret && cronSecret === CRON_SECRET) {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
      const currentHour = new Date().getUTCHours();
      const { data: schedules } = await admin.from("agent_schedules")
        .select("user_id").eq("enabled", true).eq("run_hour", currentHour);
      const results: any[] = [];
      for (const s of schedules || []) {
        try {
          const r = await runForUser(s.user_id, { triggered_by: "cron" });
          results.push({ user_id: s.user_id, ...r });
        } catch (e: any) {
          results.push({ user_id: s.user_id, error: e.message });
        }
      }
      return new Response(JSON.stringify({ ran: results.length, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // MANUAL path: invoked by user via "Run now" with their JWT
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: ce } = await userClient.auth.getClaims(token);
    if (ce || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;
    const result = await runForUser(userId, { triggered_by: "manual" });
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("daily-agent error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
