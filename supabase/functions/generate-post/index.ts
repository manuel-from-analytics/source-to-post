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
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const {
      input_ids,
      goal,
      tone,
      language,
      length,
      cta,
      target_audience,
      writing_style,
      iteration_prompt,
      previous_content,
    } = await req.json();

    // Fetch selected inputs
    let sourceTexts: string[] = [];
    if (input_ids && input_ids.length > 0) {
      const { data: inputs, error: inputsError } = await supabase
        .from("inputs")
        .select("title, raw_content, extracted_content, summary, original_url, type")
        .in("id", input_ids);
      if (inputsError) throw inputsError;

      sourceTexts = (inputs || []).map((inp: any) => {
        const content = inp.extracted_content || inp.raw_content || inp.summary || "";
        return `[${inp.type.toUpperCase()}] ${inp.title}\n${content}${inp.original_url ? `\nURL: ${inp.original_url}` : ""}`;
      });
    }

    const goalMap: Record<string, string> = {
      educate: "Educar a la audiencia",
      inspire: "Inspirar y motivar",
      promote: "Promocionar un producto o servicio",
      engage: "Generar engagement y conversación",
      storytelling: "Contar una historia",
    };

    const toneMap: Record<string, string> = {
      professional: "profesional",
      casual: "casual y cercano",
      inspirational: "inspiracional",
      direct: "directo y conciso",
      humorous: "con humor",
    };

    const lengthMap: Record<string, string> = {
      short: "corto (~100 palabras)",
      medium: "medio (~200 palabras)",
      long: "largo (~300 palabras)",
    };

    const ctaMap: Record<string, string> = {
      question: "una pregunta abierta al lector",
      share: "invitar a compartir",
      follow: "invitar a seguir",
      link: "invitar a visitar un enlace",
      none: "sin call to action",
    };

    const langMap: Record<string, string> = {
      es: "español",
      en: "inglés",
      pt: "portugués",
    };

    let systemPrompt = `Eres un experto creador de contenido para LinkedIn. 
Generas posts de alta calidad, optimizados para engagement.
Usa emojis con moderación, formato con saltos de línea y estructura visual clara.
NO uses markdown (ni asteriscos ni negritas), escribe en texto plano.`;

    let userPrompt = "";

    if (iteration_prompt && previous_content) {
      userPrompt = `Aquí está el post actual:\n\n${previous_content}\n\nEl usuario pide estos cambios: "${iteration_prompt}"\n\nDevuelve solo el post modificado, sin explicaciones.`;
    } else {
      userPrompt = "Genera un post para LinkedIn";

      if (sourceTexts.length > 0) {
        userPrompt += ` basándote en las siguientes fuentes de referencia:\n\n${sourceTexts.join("\n\n---\n\n")}`;
      }

      const specs: string[] = [];
      if (goal && goalMap[goal]) specs.push(`Objetivo: ${goalMap[goal]}`);
      if (tone && toneMap[tone]) specs.push(`Tono: ${toneMap[tone]}`);
      if (language && langMap[language]) specs.push(`Idioma: ${langMap[language]}`);
      if (length && lengthMap[length]) specs.push(`Longitud: ${lengthMap[length]}`);
      if (cta && ctaMap[cta]) specs.push(`CTA: ${ctaMap[cta]}`);
      if (target_audience) specs.push(`Audiencia objetivo: ${target_audience}`);
      if (writing_style) specs.push(`Estilo / voz: ${writing_style}`);

      if (specs.length > 0) {
        userPrompt += `\n\nEspecificaciones:\n${specs.join("\n")}`;
      }

      userPrompt += "\n\nDevuelve solo el post, sin explicaciones ni metadatos.";
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
        stream: true,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Límite de solicitudes excedido. Intenta de nuevo en unos minutos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA agotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("generate-post error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
