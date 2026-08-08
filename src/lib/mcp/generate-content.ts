// Shared LinkedIn post generation logic used by generate_post and
// generate_posts_from_newsletter tools.
import type { SupabaseClient } from "@supabase/supabase-js";
import { focusAngleInstruction } from "./focus-angles";
import { NUMERIC_GROUNDING_RULE, enforceNumericGrounding } from "./numeric-guard";

const goalMap: Record<string, string> = { educate: "Educar a la audiencia", inspire: "Inspirar y motivar", promote: "Promocionar un producto o servicio", engage: "Generar engagement y conversación", storytelling: "Contar una historia" };
const toneMap: Record<string, string> = { professional: "profesional", casual: "casual y cercano", inspirational: "inspiracional", direct: "directo y conciso", humorous: "con humor" };
const lengthMap: Record<string, string> = { short: "corto (~100 palabras)", medium: "medio (~200 palabras)", long: "largo (~300 palabras)" };
const ctaMap: Record<string, string> = { question: "una pregunta abierta al lector", share: "invitar a compartir", follow: "invitar a seguir", link: "invitar a visitar un enlace", none: "sin call to action" };
const langMap: Record<string, string> = { es: "español", en: "inglés", pt: "portugués" };

export async function generateContent(supabase: SupabaseClient, params: any): Promise<string> {
  let sourceTexts: string[] = [];
  if (params.input_ids?.length) {
    const { data: inputs } = await supabase
      .from("inputs")
      .select("title, raw_content, extracted_content, summary, original_url, type")
      .in("id", params.input_ids);
    sourceTexts = (inputs || []).map((inp: any) => {
      const content = inp.extracted_content || inp.raw_content || inp.summary || "";
      return `[${inp.type.toUpperCase()}] ${inp.title}\n${content}${inp.original_url ? `\nURL: ${inp.original_url}` : ""}`;
    });
  }
  let voiceTexts: string[] = [];
  if (params.voice_id) {
    const { data: samples } = await supabase
      .from("voice_samples")
      .select("title, content")
      .eq("voice_id", params.voice_id)
      .limit(10);
    if (samples?.length) voiceTexts = samples.map((s: any) => `${s.title ? `[${s.title}] ` : ""}${s.content}`);
  }

  let systemPrompt = `Eres un experto creador de contenido para LinkedIn.\nGeneras posts de alta calidad, optimizados para engagement.\nUsa emojis con moderación, formato con saltos de línea y estructura visual clara.\nNO uses markdown (ni asteriscos ni negritas), escribe en texto plano.\nIMPORTANTE: NO empieces el post con texto entre corchetes.`;
  if (voiceTexts.length > 0) {
    systemPrompt += `\n\nESTILO DE ESCRITURA - Imita este estilo:\n${voiceTexts.map((t, i) => `--- Ejemplo ${i + 1} ---\n${t}`).join("\n\n")}\n--- Fin ---`;
  }

  let userPrompt = "Genera un post para LinkedIn";
  if (sourceTexts.length > 0) userPrompt += ` basándote en:\n\n${sourceTexts.join("\n\n---\n\n")}`;
  const specs: string[] = [];
  if (params.goal && goalMap[params.goal]) specs.push(`Objetivo: ${goalMap[params.goal]}`);
  if (params.tone && toneMap[params.tone]) specs.push(`Tono: ${toneMap[params.tone]}`);
  if (params.language && langMap[params.language]) specs.push(`Idioma: ${langMap[params.language]}`);
  if (params.length && lengthMap[params.length]) specs.push(`Longitud: ${lengthMap[params.length]}`);
  if (params.cta && ctaMap[params.cta]) specs.push(`CTA: ${ctaMap[params.cta]}`);
  if (params.target_audience) specs.push(`Audiencia objetivo: ${params.target_audience}`);
  if (specs.length) userPrompt += `\n\nEspecificaciones:\n${specs.join("\n")}`;
  const angleBlock = focusAngleInstruction(params.focus_angle, params.language);
  if (angleBlock) userPrompt += `\n\n${angleBlock}`;
  if (params.content_focus) userPrompt += `\n\nENFOQUE:\n${params.content_focus}`;
  userPrompt += "\n\nDevuelve solo el post, sin explicaciones ni metadatos.";

  const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });
  if (!aiResponse.ok) {
    const e = await aiResponse.text();
    throw new Error(`AI error ${aiResponse.status}: ${e}`);
  }
  const aiResult = await aiResponse.json();
  return (aiResult.choices?.[0]?.message?.content || "").replace(/^\s*\[.*?\]\s*/g, "");
}
