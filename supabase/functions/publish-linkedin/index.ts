import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY = "https://connector-gateway.lovable.dev/linkedin";

interface PublishResult {
  ok: boolean;
  linkedin_url?: string;
  urn?: string;
  error?: string;
  status?: number;
}

/**
 * Publish a text post to LinkedIn (personal profile) using the linked connector.
 * Uses LOVABLE_API_KEY + LINKEDIN_API_KEY (gateway auto-refreshes the OAuth token).
 */
export async function publishTextToLinkedIn(content: string): Promise<PublishResult> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const liKey = Deno.env.get("LINKEDIN_API_KEY");
  if (!lovableKey) return { ok: false, error: "LOVABLE_API_KEY not configured" };
  if (!liKey) return { ok: false, error: "LINKEDIN_API_KEY not configured (LinkedIn connector not linked)" };

  const headers = {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": liKey,
    "Content-Type": "application/json",
    "X-Restli-Protocol-Version": "2.0.0",
  };

  // 1) Get author URN (sub)
  const userinfoRes = await fetch(`${GATEWAY}/v2/userinfo`, { headers });
  if (!userinfoRes.ok) {
    const txt = await userinfoRes.text();
    return { ok: false, status: userinfoRes.status, error: `userinfo failed: ${txt}` };
  }
  const userinfo = await userinfoRes.json();
  const sub = userinfo?.sub;
  if (!sub) return { ok: false, error: "no sub in userinfo response" };

  // 2) Publish ugcPost
  const body = {
    author: `urn:li:person:${sub}`,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: content },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };
  const postRes = await fetch(`${GATEWAY}/v2/ugcPosts`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!postRes.ok) {
    const txt = await postRes.text();
    return { ok: false, status: postRes.status, error: `ugcPosts failed: ${txt}` };
  }
  const data = await postRes.json().catch(() => ({}));
  const urn: string | undefined =
    data?.id ?? postRes.headers.get("x-restli-id") ?? undefined;
  if (!urn) return { ok: false, error: "no URN in ugcPosts response" };

  // Build feed URL — works for both share and ugcPost URNs.
  const activityId = urn.includes(":") ? urn.split(":").pop() : urn;
  const feedUrn = urn.startsWith("urn:li:share:")
    ? urn.replace("urn:li:share:", "urn:li:activity:")
    : urn.startsWith("urn:li:ugcPost:")
    ? `urn:li:activity:${activityId}`
    : urn;
  const linkedin_url = `https://www.linkedin.com/feed/update/${feedUrn}/`;

  return { ok: true, urn, linkedin_url };
}

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
