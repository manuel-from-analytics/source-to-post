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
    const internalUserId = req.headers.get("x-internal-user-id");
    const isInternalCall = token === SERVICE_ROLE && internalUserId;

    let supabase;
    let userEmail: string | undefined;
    if (isInternalCall) {
      supabase = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_ROLE);
      const { data: u } = await supabase.auth.admin.getUserById(internalUserId!);
      userEmail = u.user?.email ?? undefined;
    } else {
      supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
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

    const itemsHtml = (posts || []).map((p: any) => {
      const preview = (p.content || "").slice(0, 240).replace(/\n/g, "<br>");
      const link = `${APP_BASE_URL}/history?post=${p.id}`;
      return `<div style="margin:0 0 24px;padding:16px;border:1px solid #e5e7eb;border-radius:8px">
        <h3 style="margin:0 0 8px;font-size:16px">${escapeHtml(p.title || "Sin título")}</h3>
        <p style="margin:0 0 12px;color:#475569;font-size:14px;line-height:1.5">${preview}…</p>
        <a href="${link}" style="display:inline-block;padding:8px 14px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;font-size:14px">Revisar y copiar</a>
      </div>`;
    }).join("");

    const subjectFinal = subject || `${(posts || []).length} posts listos para revisar`;
    const summaryHtml = summary ? `<p style="color:#475569">${escapeHtml(summary)}</p>` : "";
    const html = `<!doctype html><html><body style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <h2 style="margin:0 0 16px">Tus posts del día están listos</h2>
      ${summaryHtml}
      ${itemsHtml}
      <p style="color:#94a3b8;font-size:12px;margin-top:24px">Generado automáticamente por tu agente.</p>
    </body></html>`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "Resend connector not configured. Connect Resend in Connectors." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({
        from: "Postflow <onboarding@resend.dev>",
        to: [recipient],
        subject: subjectFinal,
        html,
      }),
    });
    const result = await resp.json();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: "Email send failed", details: result }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, recipient, post_count: (posts || []).length, message_id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("notify-review error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
