import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://source-to-post.lovable.app";

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
    const isInternalCall = token === SERVICE_ROLE && internalUserId;

    let supabase;
    let userEmail: string | undefined;
    if (isInternalCall) {
      supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data: u } = await supabase.auth.admin.getUserById(internalUserId!);
      userEmail = u.user?.email ?? undefined;
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
      userEmail = user.email ?? undefined;
    }

    const { post_ids, subject, summary, to } = await req.json();
    if (!Array.isArray(post_ids) || post_ids.length === 0) {
      return new Response(JSON.stringify({ error: "post_ids required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: posts } = await supabase
      .from("generated_posts")
      .select("id, title, content")
      .in("id", post_ids);

    const recipient = to || userEmail;
    if (!recipient) {
      return new Response(JSON.stringify({ error: "No recipient email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const items = (posts || []).map((p: any) => ({
      id: p.id,
      title: p.title || "Sin título",
      preview: (p.content || "").slice(0, 240),
      url: `${APP_BASE_URL}/history?post=${p.id}`,
    }));

    // Send via Lovable Emails (transactional). Use service role so the
    // send-transactional-email function (verify_jwt = true) accepts the call.
    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);
    const idempotencyKey = `agent-posts-${post_ids.slice().sort().join("-").slice(0, 80)}`;

    const { data: sendResult, error: sendErr } = await adminClient.functions.invoke(
      "send-transactional-email",
      {
        body: {
          templateName: "agent-posts-ready",
          recipientEmail: recipient,
          idempotencyKey,
          templateData: {
            summary: summary || undefined,
            count: items.length,
            posts: items,
          },
        },
      },
    );

    if (sendErr) {
      console.error("send-transactional-email failed:", sendErr);
      return new Response(JSON.stringify({ error: "Email send failed", details: String(sendErr) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, recipient, post_count: items.length, result: sendResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notify-review error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
