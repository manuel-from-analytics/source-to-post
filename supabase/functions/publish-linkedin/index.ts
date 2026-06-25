import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { publishTextToLinkedIn } from "../_shared/linkedin-publish.ts";
import { recordLabelPublication, type LabelKind } from "../_shared/label-publication.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const post_id = typeof body?.post_id === "string" ? body.post_id : null;
    if (!post_id) {
      return new Response(JSON.stringify({ error: "post_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: post, error: postErr } = await supabase
      .from("generated_posts")
      .select("id, content, user_id")
      .eq("id", post_id)
      .maybeSingle();
    if (postErr || !post) {
      return new Response(JSON.stringify({ error: "post not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (post.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!post.content?.trim()) {
      return new Response(JSON.stringify({ error: "post has no content" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await publishTextToLinkedIn(post.content);
    if (!result.ok) {
      console.error("LinkedIn publish failed:", result);
      return new Response(JSON.stringify({ error: result.error ?? "publish failed" }), {
        status: result.status && result.status >= 400 ? result.status : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to bypass RLS for the linkedin_url update
    // (the user already passed the ownership check above).
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await admin
      .from("generated_posts")
      .update({
        linkedin_url: result.linkedin_url,
        linkedin_published_at: new Date().toISOString(),
        status: "published",
        published_at: new Date().toISOString(),
      } as any)
      .eq("id", post_id);

    return new Response(
      JSON.stringify({ ok: true, linkedin_url: result.linkedin_url, urn: result.urn }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("publish-linkedin error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
