import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://source-to-post.lovable.app";
const NOTIFY_URL = Deno.env.get("APPHUB_NOTIFY_URL") || "https://app-hub-alpha.vercel.app/api/notify";
const NOTIFY_TOKEN = Deno.env.get("APPHUB_NOTIFY_TOKEN");
const NOTIFY_SOURCE = Deno.env.get("APPHUB_NOTIFY_SOURCE") || "postflow";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const internalUserId = req.headers.get("x-internal-user-id");
    const isInternalCall = token === SERVICE_ROLE && !!internalUserId;

    let supabase;
    if (isInternalCall) {
      supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    } else {
      supabase = createClient(
        SUPABASE_URL,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
      if (userErr || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!NOTIFY_TOKEN) {
      return new Response(JSON.stringify({ error: "APPHUB_NOTIFY_TOKEN not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { post_ids, subject, summary, status } = await req.json();
    if (!Array.isArray(post_ids) || post_ids.length === 0) {
      return new Response(JSON.stringify({ error: "post_ids required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: posts } = await supabase
      .from("generated_posts")
      .select("id, title, content")
      .in("id", post_ids);

    const items = (posts || []).map((p: any) => ({
      id: p.id,
      title: p.title || "Sin título",
      preview: (p.content || "").slice(0, 240),
      url: `${APP_BASE_URL}/history?post=${p.id}`,
    }));

    // Build markdown body: one entry per post with title + link
    const bodyLines: string[] = [];
    if (summary) bodyLines.push(summary, "");
    for (const it of items) {
      bodyLines.push(`- [${it.title}](${it.url})`);
    }
    const bodyMd = bodyLines.join("\n").slice(0, 8000);

    const title = (subject || `${items.length} posts listos para revisar`).slice(0, 200);

    const payload: Record<string, unknown> = {
      source: NOTIFY_SOURCE,
      title,
      status: status || "ok",
      body: bodyMd,
      metadata: {
        post_count: items.length,
        post_ids: post_ids,
        app_url: `${APP_BASE_URL}/history`,
      },
    };

    const resp = await fetch(NOTIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${NOTIFY_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("apphub notify failed:", resp.status, result);
      return new Response(JSON.stringify({ error: "Notification failed", status: resp.status, details: result }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, post_count: items.length, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notify-review error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
