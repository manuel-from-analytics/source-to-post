import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { newsletter_id, force_regenerate } = await req.json();
    if (!newsletter_id) {
      return new Response(JSON.stringify({ error: "newsletter_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if podcast script already exists
    const { data: existing } = await supabase
      .from("newsletters")
      .select("podcast_script, language")
      .eq("id", newsletter_id)
      .single();
    if (existing?.podcast_script && !force_regenerate) {
      return new Response(JSON.stringify({ script: existing.podcast_script, language: existing.language || "es" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: newsletter, error: nlError } = await supabase
      .from("newsletters")
      .select("*")
      .eq("id", newsletter_id)
      .single();
    if (nlError || !newsletter) {
      return new Response(JSON.stringify({ error: "Newsletter not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: items } = await supabase
      .from("newsletter_items")
      .select("*")
      .eq("newsletter_id", newsletter_id)
      .order("created_at", { ascending: true });

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const itemsSummary = (items || []).map((item: any, i: number) => {
      return `${i + 1}. "${item.title}" (${item.source_type}) - ${item.description || ""}`;
    }).join("\n");

    const lang = newsletter.language || "es";
    const scriptPrompt = `You are a podcast host creating a brief, engaging audio briefing.
Convert this newsletter into a natural spoken script as if you're telling a friend about these news items.

Newsletter topic: "${newsletter.topic}"
Items:
${itemsSummary}

Rules:
- Write in ${lang === "es" ? "Spanish" : lang === "en" ? "English" : lang}
- Keep it conversational and engaging, like a morning briefing podcast
- Start with a brief intro ("Hoy te traigo..." or similar)
- Cover each item briefly (2-3 sentences each) highlighting why it matters
- End with a brief closing thought
- Total length: 300-500 words (about 2-3 minutes of audio)
- Do NOT include any formatting, headers, or bullet points - just flowing speech
- Do NOT mention URLs or links`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You write podcast scripts. Output ONLY the script text, nothing else." },
          { role: "user", content: scriptPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit. Intenta de nuevo en unos segundos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("Failed to generate podcast script");
    }

    const aiData = await aiResponse.json();
    const script = aiData.choices?.[0]?.message?.content;
    if (!script) throw new Error("No script generated");

    console.log("Podcast script generated, length:", script.length);

    // Save podcast script to newsletter
    await supabase
      .from("newsletters")
      .update({ podcast_script: script })
      .eq("id", newsletter_id);

    return new Response(JSON.stringify({ script, language: lang }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("newsletter-audio error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
