import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map months to Firecrawl tbs (Google-style time filter).
// qdr:m = last month, qdr:m6 = last 6 months, qdr:y = last year, qdr:y2 = last 2 years.
function monthsToTbs(months: number | null | undefined): string | undefined {
  if (!months || months <= 0) return undefined;
  if (months <= 1) return "qdr:m";
  if (months <= 12) return `qdr:m${months}`;
  const years = Math.ceil(months / 12);
  return years <= 1 ? "qdr:y" : `qdr:y${years}`;
}

function cutoffDateFromMonths(months: number | null | undefined): string | null {
  if (!months || months <= 0) return null;
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().split("T")[0];
}

// ---------- Dedup helpers ----------
const TRACKING_PARAMS_PREFIX = ["utm_", "mc_"];
const TRACKING_PARAMS_EXACT = new Set([
  "gclid", "fbclid", "ref", "ref_src", "igshid", "yclid", "msclkid", "_hsenc", "_hsmi",
]);

function normalizeUrl(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  try {
    const u = new URL(raw.trim());
    u.hash = "";
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    const keep: [string, string][] = [];
    u.searchParams.forEach((v, k) => {
      const lk = k.toLowerCase();
      if (TRACKING_PARAMS_EXACT.has(lk)) return;
      if (TRACKING_PARAMS_PREFIX.some((p) => lk.startsWith(p))) return;
      keep.push([k, v]);
    });
    u.search = "";
    keep.sort(([a], [b]) => a.localeCompare(b)).forEach(([k, v]) => u.searchParams.append(k, v));
    let s = u.toString();
    // strip trailing slash unless it's the root
    if (u.pathname !== "/" && s.endsWith("/")) s = s.slice(0, -1);
    return s.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

const STOPWORDS = new Set([
  "el","la","los","las","de","del","y","o","u","un","una","unos","unas","en","para","por","con","sin","al","lo","es","son","que","como","más","mas","sobre","ante","tras","entre","muy","ya","si","no",
  "the","a","an","of","and","or","to","in","for","on","with","at","by","from","is","are","was","were","be","been","being","this","that","these","those","as","it","its","but","if","into","than","then","so","up","out",
]);

function tokenizeTitle(title: string): Set<string> {
  if (!title) return new Set();
  const cleaned = title.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ");
  const tokens = cleaned.split(/\s+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

async function firecrawlSearch(query: string, apiKey: string, limit = 10, tbs?: string): Promise<any[]> {
  try {
    const body: Record<string, unknown> = {
      query,
      limit,
      scrapeOptions: { formats: ["markdown"] },
    };
    if (tbs) body.tbs = tbs;
    const response = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
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

    const token = authHeader.replace("Bearer ", "");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const internalUserId = req.headers.get("x-internal-user-id");
    const isInternalCall = token === SERVICE_ROLE && internalUserId;

    let supabase;
    let userId: string;
    if (isInternalCall) {
      // Internal call from daily-agent (cron): use service role and trust x-internal-user-id
      supabase = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_ROLE);
      userId = internalUserId!;
    } else {
      supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claimsData.claims.sub;
    }

    const { topic, profile_id } = await req.json();
    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Topic is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user profile: app_language + legacy newsletter preferences toggle
    const { data: profile } = await supabase
      .from("profiles")
      .select("app_language, newsletter_preferences, newsletter_preferences_enabled")
      .eq("id", userId)
      .single();
    const appLanguage = profile?.app_language || "es";
    const langNames: Record<string, string> = { es: "Spanish", en: "English", pt: "Portuguese" };
    const langName = langNames[appLanguage] || "Spanish";
    const preferencesEnabled: boolean = (profile as any)?.newsletter_preferences_enabled !== false;

    // Resolve which preference profile to use:
    // - If profile_id provided → use that profile
    // - Else → use the user's default profile from newsletter_preference_profiles
    // - Else fallback → legacy profiles.newsletter_preferences text
    let userPreferences: string = "";
    let freshnessMonths: number | null = null;
    if (preferencesEnabled) {
      if (profile_id) {
        const { data: prof } = await supabase
          .from("newsletter_preference_profiles")
          .select("preferences, freshness_months")
          .eq("id", profile_id)
          .eq("user_id", userId)
          .maybeSingle();
        userPreferences = (prof as any)?.preferences || "";
        freshnessMonths = (prof as any)?.freshness_months ?? null;
      } else {
        const { data: defaultProf } = await supabase
          .from("newsletter_preference_profiles")
          .select("preferences, freshness_months")
          .eq("user_id", userId)
          .eq("is_default", true)
          .maybeSingle();
        userPreferences = (defaultProf as any)?.preferences || (profile as any)?.newsletter_preferences || "";
        freshnessMonths = (defaultProf as any)?.freshness_months ?? null;
      }
    }

    // Step 1: Collect previously used URLs+titles for this user (last 90 days) to avoid repetition.
    const lookbackDays = 90;
    const recentTitleDays = 30;
    const lookbackIso = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();
    const recentTitleIso = new Date(Date.now() - recentTitleDays * 24 * 60 * 60 * 1000).toISOString();
    const { data: allExistingItems } = await supabase
      .from("newsletter_items")
      .select("url, title, created_at, newsletters!inner(user_id)")
      .eq("newsletters.user_id", userId)
      .gte("created_at", lookbackIso)
      .order("created_at", { ascending: false });
    const recentUrlsNorm = new Set<string>();
    const recentTitleTokens: Set<string>[] = [];
    const recentTitlesForPrompt: string[] = [];
    for (const it of (allExistingItems || []) as any[]) {
      if (it.url) recentUrlsNorm.add(normalizeUrl(it.url));
      if (it.created_at >= recentTitleIso && it.title) {
        recentTitleTokens.push(tokenizeTitle(it.title));
        recentTitlesForPrompt.push(it.title);
      }
    }
    const existingUrls: string[] = Array.from(recentUrlsNorm);

    // Step 2: Search for content using Firecrawl with time filter from profile
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY is not configured");

    const tbs = monthsToTbs(freshnessMonths);
    const cutoffDate = cutoffDateFromMonths(freshnessMonths);
    console.log(`Freshness: ${freshnessMonths} months → tbs=${tbs ?? "none"} cutoff=${cutoffDate ?? "none"}`);

    // Pull a wider candidate pool when filtering, so we still have enough after dropping stale items.
    const searchLimit = freshnessMonths ? 20 : 12;
    const searchResults = await firecrawlSearch(topic, FIRECRAWL_API_KEY, searchLimit, tbs);
    console.log(`Search results: ${searchResults.length} for topic "${topic}"`);

    if (searchResults.length === 0) {
      return new Response(JSON.stringify({ error: "No search results found for this topic. Try a different query or relax the freshness filter." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Use Lovable AI to generate structured newsletter
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const sourceSummaries = searchResults.slice(0, 20).map((r: any, i: number) => {
      const snippet = (r.markdown || r.description || "").slice(0, 800);
      return `[${i + 1}] Title: ${r.title || "Untitled"}\nURL: ${r.url}\nContent: ${snippet}`;
    }).join("\n\n---\n\n");

    const today = new Date().toISOString().split("T")[0];

    const systemPrompt = `Eres un curador experto de newsletters estilo Kloshletter: legibles, escaneables, accionables. Tu trabajo es entregar la mejor newsletter posible sobre el tema solicitado, aplicando juicio editorial riguroso (calidad de fuente, claridad, utilidad para el lector). Output MUST be valid JSON only, no markdown, no explanation outside JSON.`;

    const preferencesBlock = preferencesEnabled && userPreferences.trim().length > 0
      ? `\n\nUSER PREFERENCES (apply estas reglas editoriales además de tu juicio experto):\n${userPreferences.trim()}\n`
      : "";

    const freshnessBlock = cutoffDate
      ? `\n\nSTRICT FRESHNESS RULE (non-negotiable):\n- Today is ${today}. The cutoff date is ${cutoffDate}.\n- Every item's pub_date MUST be >= ${cutoffDate}. REJECT any source older than that, even if it's a great article.\n- If a result has no clear publication date, treat it as too old and skip it.\n- Prefer items dated within the last few weeks when available.\n`
      : "";

    const userPrompt = `Create a newsletter about: "${topic}"
Today's date: ${today}
${preferencesBlock}${freshnessBlock}
SEARCH RESULTS TO USE:
${sourceSummaries}

${existingUrls.length > 0 ? `ALREADY USED URLs (DO NOT repeat these, neither exact nor with different tracking params):\n${existingUrls.slice(0, 200).join("\n")}` : ""}

${recentTitlesForPrompt.length > 0 ? `RECENTLY COVERED TOPICS (last ${recentTitleDays} days — DO NOT repeat the same news/topic, even from a different source):\n${recentTitlesForPrompt.slice(0, 80).map((t) => `- ${t}`).join("\n")}` : ""}

GENERAL RULES:
1. Select exactly 5 items.
2. Each item must have exactly one working link.
3. No repeated links from the "already used URLs" list above.
4. Write the newsletter in ${langName} regardless of the topic language.
${cutoffDate ? `5. Every pub_date MUST be on or after ${cutoffDate}. This is the most important rule.` : ""}

RECENCY PRIORITY (very important):
- Prefer the MOST RECENT publications available. Among sources of comparable quality and relevance, ALWAYS choose the newer one.
- Order the final "items" array by pub_date in DESCENDING order (newest first).
- Treat recency as a primary editorial criterion, not a tiebreaker. An item from this week beats a solid item from 3 months ago unless the older one is clearly superior in substance.
- If two items cover the same news, keep only the most recent / most authoritative version.

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

    // Step 3.5: Server-side freshness validation as a safety net
    if (cutoffDate && Array.isArray(newsletter.items)) {
      const before = newsletter.items.length;
      newsletter.items = newsletter.items.filter((it: any) => {
        if (!it?.pub_date) return false;
        // Accept anything that parses to a date >= cutoff. Compare as YYYY-MM-DD strings (lexicographic == chronological).
        const d = String(it.pub_date).slice(0, 10);
        return d >= cutoffDate;
      });
      const dropped = before - newsletter.items.length;
      if (dropped > 0) {
        console.log(`Freshness filter dropped ${dropped} stale item(s) (cutoff ${cutoffDate}).`);
      }
      if (newsletter.items.length === 0) {
        return new Response(JSON.stringify({
          error: `All sources were older than ${freshnessMonths} months. Try a broader topic or increase the freshness window in your profile.`,
        }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

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
