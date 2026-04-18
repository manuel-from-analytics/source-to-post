import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function firecrawlSearch(query: string, apiKey: string, limit = 10): Promise<any[]> {
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit,
        scrapeOptions: { formats: ["markdown"] },
      }),
    });
    if (!response.ok) {
      console.error("Firecrawl search error:", response.status);
      return [];
    }
    const data = await response.json();
    return data.data || [];
  } catch (e) {
    console.error("Firecrawl search failed:", e);
    return [];
  }
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
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { topic } = await req.json();
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Topic is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user profile: app_language + newsletter preferences
    const { data: profile } = await supabase
      .from("profiles")
      .select("app_language, newsletter_preferences, newsletter_preferences_enabled")
      .eq("id", userId)
      .single();
    const appLanguage = profile?.app_language || "es";
    const langNames: Record<string, string> = { es: "Spanish", en: "English", pt: "Portuguese" };
    const langName = langNames[appLanguage] || "Spanish";
    const userPreferences: string = (profile as any)?.newsletter_preferences || "";
    const preferencesEnabled: boolean = (profile as any)?.newsletter_preferences_enabled !== false;

    // Step 1: Collect ALL previously used URLs to avoid repetition
    const { data: allExistingItems } = await supabase
      .from("newsletter_items")
      .select("url, newsletter_id")
      .order("created_at", { ascending: false })
      .limit(500);
    const existingUrls: string[] = (allExistingItems || []).map((i: any) => i.url);

    // Step 2: Search for content using Firecrawl (neutral query)
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY is not configured");

    const searchResults = await firecrawlSearch(topic, FIRECRAWL_API_KEY, 12);
    console.log(`Search results: ${searchResults.length} for topic "${topic}"`);

    if (searchResults.length === 0) {
      return new Response(JSON.stringify({ error: "No search results found for this topic. Try a different query." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Use Lovable AI to generate structured newsletter
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const sourceSummaries = searchResults.slice(0, 15).map((r: any, i: number) => {
      const snippet = (r.markdown || r.description || "").slice(0, 800);
      return `[${i + 1}] Title: ${r.title || "Untitled"}\nURL: ${r.url}\nContent: ${snippet}`;
    }).join("\n\n---\n\n");

    const today = new Date().toISOString().split("T")[0];

    const systemPrompt = `Eres un curador experto de newsletters estilo Kloshletter: legibles, escaneables, accionables. Tu trabajo es entregar la mejor newsletter posible sobre el tema solicitado, aplicando juicio editorial riguroso (calidad de fuente, claridad, utilidad para el lector). Output MUST be valid JSON only, no markdown, no explanation outside JSON.`;

    const preferencesBlock = preferencesEnabled && userPreferences.trim().length > 0
      ? `\n\nUSER PREFERENCES (apply estas reglas editoriales además de tu juicio experto):\n${userPreferences.trim()}\n`
      : "";

    const userPrompt = `Create a newsletter about: "${topic}"
Today's date: ${today}
${preferencesBlock}
SEARCH RESULTS TO USE:
${sourceSummaries}

${existingUrls.length > 0 ? `ALREADY USED URLs (DO NOT repeat these):\n${existingUrls.join("\n")}` : ""}

GENERAL RULES:
1. Select exactly 5 items.
2. Each item must have exactly one working link.
3. No repeated links from the "already used URLs" list above.
4. Write the newsletter in ${langName} regardless of the topic language.

Return this exact JSON structure:
{
  "subject": "${today} - [subject ≤80 chars total including date]",
  "language": "[detected language code: es/en/pt/etc]",
  "items": [
    {
      "title": "Item headline",
      "url": "https://...",
      "description": "2-3 sentence summary: what it says, why it matters, what to do with it",
      "source_type": "independent|vendor|foundational|academic",
      "source_name": "Publication/org name",
      "pub_date": "YYYY-MM-DD"
    }
  ],
  "closing": "One actionable closing thought"
}

IMPORTANT: For pub_date, provide the actual or best-estimate publication date in YYYY-MM-DD format.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_newsletter",
            description: "Create a structured newsletter with 5 curated items",
            parameters: {
              type: "object",
              properties: {
                subject: { type: "string", description: "Subject line starting with YYYY-MM-DD, max 80 chars" },
                language: { type: "string", description: "Language code" },
                items: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      url: { type: "string" },
                      description: { type: "string" },
                      source_type: { type: "string", enum: ["independent", "vendor", "foundational", "academic"] },
                      source_name: { type: "string" },
                      pub_date: { type: "string", description: "Publication date in YYYY-MM-DD format, or approximate if exact date unknown" },
                    },
                    required: ["title", "url", "description", "source_type", "source_name", "pub_date"],
                  },
                },
                closing: { type: "string" },
              },
              required: ["subject", "language", "items", "closing"],
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_newsletter" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI generation failed");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured output from AI");

    const newsletter = JSON.parse(toolCall.function.arguments);
    console.log("Newsletter generated:", newsletter.subject, "items:", (newsletter.items || []).length);

    // Format readable content
    const formattedContent = formatNewsletter(newsletter);

    // Step 4: Save newsletter and items
    const { data: savedNewsletter, error: saveError } = await supabase
      .from("newsletters")
      .insert({
        user_id: userId,
        topic: topic.trim(),
        content: formattedContent,
        language: newsletter.language || "es",
      })
      .select()
      .single();

    if (saveError) throw saveError;

    const itemsToInsert = (newsletter.items || []).map((item: any) => ({
      newsletter_id: savedNewsletter.id,
      title: item.title,
      url: item.url,
      description: `[${item.source_name}] ${item.description}`,
      source_type: item.source_type,
      pub_date: item.pub_date || null,
    }));

    const { error: itemsError } = await supabase
      .from("newsletter_items")
      .insert(itemsToInsert);

    if (itemsError) console.error("Error saving items:", itemsError);

    return new Response(JSON.stringify({
      newsletter: {
        ...savedNewsletter,
        items: itemsToInsert.map((item: any, i: number) => ({
          ...item,
          id: `temp-${i}`,
          imported_to_library: false,
        })),
      },
      structured: newsletter,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (e) {
    console.error("generate-newsletter error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function formatNewsletter(data: any): string {
  let content = `${data.subject}\n\n`;
  
  (data.items || []).forEach((item: any, i: number) => {
    const badge = item.source_type === "vendor" ? "🏢" 
      : item.source_type === "foundational" ? "📚" 
      : item.source_type === "academic" ? "🎓"
      : "📰";
    content += `${i + 1}. ${badge} ${item.title}\n`;
    content += `   ${item.description}\n`;
    content += `   🔗 ${item.url}\n`;
    content += `   — ${item.source_name}\n\n`;
  });

  if (data.closing) {
    content += `💡 ${data.closing}`;
  }

  return content;
}
