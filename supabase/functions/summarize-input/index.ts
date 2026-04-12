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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { input_id } = await req.json();
    if (!input_id) {
      return new Response(JSON.stringify({ error: "input_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = userData.user.id;

    // Fetch user's app_language
    let appLang = "es";
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("app_language")
        .eq("id", userId)
        .single();
      appLang = profile?.app_language || "es";
    }
    const langMap: Record<string, string> = { es: "español", en: "English", pt: "português" };
    const summaryLang = langMap[appLang] || "español";

    const promptsByLang: Record<string, { system: string; noContent: string; instruction: string }> = {
      es: {
        system: "Eres un asistente experto en resumir contenido. Produces resúmenes claros, concisos y bien estructurados en español.",
        noContent: "(Sin contenido textual disponible, resume basándote en el título y la URL)",
        instruction: "Resume el siguiente material de forma clara y concisa en 3-5 párrafos cortos. Destaca las ideas principales, datos clave y conclusiones relevantes. Devuelve solo el resumen, sin explicaciones ni metadatos.",
      },
      en: {
        system: "You are an expert content summarizer. You produce clear, concise, and well-structured summaries in English.",
        noContent: "(No text content available, summarize based on the title and URL)",
        instruction: "Summarize the following material clearly and concisely in 3-5 short paragraphs. Highlight the main ideas, key data, and relevant conclusions. Return only the summary, no explanations or metadata.",
      },
      pt: {
        system: "Você é um assistente especializado em resumir conteúdo. Produz resumos claros, concisos e bem estruturados em português.",
        noContent: "(Sem conteúdo textual disponível, resuma com base no título e URL)",
        instruction: "Resuma o seguinte material de forma clara e concisa em 3-5 parágrafos curtos. Destaque as ideias principais, dados-chave e conclusões relevantes. Retorne apenas o resumo, sem explicações ou metadados.",
      },
    };
    const prompts = promptsByLang[appLang] || promptsByLang.es;

    // Fetch the input
    const { data: input, error: inputError } = await supabase
      .from("inputs")
      .select("title, raw_content, extracted_content, original_url, type")
      .eq("id", input_id)
      .single();

    if (inputError || !input) {
      return new Response(JSON.stringify({ error: "Input not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = input.extracted_content || input.raw_content || "";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const userPrompt = `${prompts.instruction}

Title: ${input.title}
Type: ${input.type}
${input.original_url ? `URL: ${input.original_url}` : ""}

Content:
${content || prompts.noContent}`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: prompts.system },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido. Intenta de nuevo en unos minutos." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA agotados." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const summary = aiData.choices?.[0]?.message?.content || "";

    // Save summary to the input
    const { error: updateError } = await supabase
      .from("inputs")
      .update({ summary })
      .eq("id", input_id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("summarize-input error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
