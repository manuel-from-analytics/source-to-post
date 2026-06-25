import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { publishTextToLinkedIn } from "../_shared/linkedin-publish.ts";
import { recordLabelPublication, type LabelKind } from "../_shared/label-publication.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const MAX_ATTEMPTS = 3;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Pull due, pending personal publications (small batch to avoid timeout).
    const { data: due, error } = await admin
      .from("scheduled_publications")
      .select("id, post_id, user_id, target, attempts")
      .eq("status", "pending")
      .eq("target", "personal")
      .lte("scheduled_at", new Date().toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(10);
    if (error) throw error;

    const results: any[] = [];
    for (const row of due ?? []) {
      // Claim the row (optimistic lock).
      const { data: claimed } = await admin
        .from("scheduled_publications")
        .update({ status: "publishing", attempts: (row.attempts ?? 0) + 1 } as any)
        .eq("id", row.id)
        .eq("status", "pending")
        .select("id")
        .maybeSingle();
      if (!claimed) continue;

      // Load post + verify still belongs to user.
      const { data: post } = await admin
        .from("generated_posts")
        .select("id, content, user_id")
        .eq("id", row.post_id)
        .maybeSingle();

      if (!post || post.user_id !== row.user_id || !post.content?.trim()) {
        await admin
          .from("scheduled_publications")
          .update({ status: "failed", error: "post missing or empty" } as any)
          .eq("id", row.id);
        results.push({ id: row.id, ok: false, error: "post missing" });
        continue;
      }

      const r = await publishTextToLinkedIn(post.content);
      if (r.ok) {
        const nowIso = new Date().toISOString();
        await admin
          .from("scheduled_publications")
          .update({
            status: "done",
            linkedin_url: r.linkedin_url,
            error: null,
          } as any)
          .eq("id", row.id);
        await admin
          .from("generated_posts")
          .update({
            linkedin_url: r.linkedin_url,
            linkedin_published_at: nowIso,
            status: "published",
            published_at: nowIso,
          } as any)
          .eq("id", row.post_id);
        const kind: LabelKind = row.target === "company" ? "company" : "personal";
        await recordLabelPublication(admin, row.user_id, row.post_id, kind, nowIso);
        results.push({ id: row.id, ok: true });
      } else {
        const finalStatus =
          (row.attempts ?? 0) + 1 >= MAX_ATTEMPTS ? "failed" : "pending";
        await admin
          .from("scheduled_publications")
          .update({ status: finalStatus, error: r.error ?? "unknown" } as any)
          .eq("id", row.id);
        results.push({ id: row.id, ok: false, error: r.error, retry: finalStatus === "pending" });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("publish-linkedin-cron error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
