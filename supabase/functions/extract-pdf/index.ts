import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20MB

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

    const { input_id } = await req.json();
    if (!input_id) {
      return new Response(JSON.stringify({ error: "input_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: input, error: inputError } = await supabase
      .from("inputs")
      .select("id, file_path, type, title")
      .eq("id", input_id)
      .single();

    if (inputError || !input) {
      return new Response(JSON.stringify({ error: "Input not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (input.type !== "pdf" || !input.file_path) {
      return new Response(JSON.stringify({ error: "Not a PDF" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download PDF
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("inputs")
      .download(input.file_path);

    if (downloadError || !fileData) {
      console.error("Download error:", downloadError);
      return new Response(JSON.stringify({ error: "Could not download PDF" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pdfBytes = new Uint8Array(await fileData.arrayBuffer());

    if (pdfBytes.byteLength > MAX_PDF_SIZE) {
      return new Response(JSON.stringify({ error: "El PDF es demasiado grande para extracción con IA (máx. 10MB). Intenta con un archivo más pequeño." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use AI to extract text (pdfjs-dist doesn't work in Deno edge functions)
    const b64 = base64Encode(pdfBytes);
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "Eres un asistente especializado en extraer texto de documentos PDF. Extrae TODO el texto del documento de forma fiel y completa, manteniendo la estructura de párrafos y secciones. No añadas interpretaciones ni resúmenes, solo el texto tal como aparece.",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${b64}`,
                },
              },
              {
                type: "text",
                text: `Extrae todo el texto de este documento PDF titulado "${input.title}". Devuelve solo el contenido textual.`,
              },
            ],
          },
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
      throw new Error("Error al procesar el PDF con IA");
    }

    const aiData = await aiResponse.json();
    const extractedContent = (aiData.choices?.[0]?.message?.content || "").trim();

    if (!extractedContent) {
      return new Response(JSON.stringify({ error: "No se pudo extraer texto del PDF" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateError } = await supabase
      .from("inputs")
      .update({ extracted_content: extractedContent })
      .eq("id", input_id);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ success: true, length: extractedContent.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-pdf error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
