import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function getSupabase(authHeader: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
}

async function authenticate(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const supabase = getSupabase(authHeader);
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) throw new Error("Unauthorized");
  return { supabase, userId: data.claims.sub as string };
}

const mcp = new McpServer({
  name: "source-to-post",
  version: "1.0.0",
  schemaAdapter: (schema: any) => z.toJSONSchema(schema as z.ZodType),
});

// ── INPUTS ──

mcp.tool("list_inputs", {
  description: "List sources from the library. Optional filters: type, is_favorite, category_id, limit.",
  inputSchema: z.object({
    type: z.enum(["pdf", "url", "youtube", "text"]).optional(),
    is_favorite: z.boolean().optional(),
    category_id: z.string().optional(),
    limit: z.number().optional(),
  }),
  handler: async (params: any, { request }: any) => {
    const { supabase } = await authenticate(request);
    let q = supabase.from("inputs").select("id, title, type, original_url, summary, category_id, is_favorite, created_at").order("created_at", { ascending: false }).limit(params.limit || 50);
    if (params.type) q = q.eq("type", params.type);
    if (params.is_favorite !== undefined) q = q.eq("is_favorite", params.is_favorite);
    if (params.category_id) q = q.eq("category_id", params.category_id);
    const { data, error } = await q;
    if (error) throw error;
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcp.tool("get_input", {
  description: "Get full details of a specific source by ID.",
  inputSchema: z.object({ id: z.string() }),
  handler: async ({ id }: any, { request }: any) => {
    const { supabase } = await authenticate(request);
    const { data, error } = await supabase.from("inputs").select("*").eq("id", id).single();
    if (error) throw error;
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcp.tool("create_input", {
  description: "Add a new text or URL source to the library.",
  inputSchema: z.object({
    title: z.string(),
    type: z.enum(["text", "url", "youtube"]),
    raw_content: z.string().optional(),
    original_url: z.string().optional(),
  }),
  handler: async (params: any, { request }: any) => {
    const { supabase, userId } = await authenticate(request);
    const { data, error } = await supabase.from("inputs").insert({
      user_id: userId, title: params.title, type: params.type,
      raw_content: params.raw_content || null, original_url: params.original_url || null,
    }).select().single();
    if (error) throw error;
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcp.tool("delete_input", {
  description: "Delete a source from the library by ID.",
  inputSchema: z.object({ id: z.string() }),
  handler: async ({ id }: any, { request }: any) => {
    const { supabase } = await authenticate(request);
    const { error } = await supabase.from("inputs").delete().eq("id", id);
    if (error) throw error;
    return { content: [{ type: "text" as const, text: "Deleted successfully" }] };
  },
});

// ── POSTS ──

mcp.tool("list_posts", {
  description: "List generated posts. Optional filters: status, is_favorite, limit.",
  inputSchema: z.object({
    status: z.enum(["draft", "final", "published"]).optional(),
    is_favorite: z.boolean().optional(),
    limit: z.number().optional(),
  }),
  handler: async (params: any, { request }: any) => {
    const { supabase } = await authenticate(request);
    let q = supabase.from("generated_posts").select("id, title, content, status, goal, tone, language, is_favorite, created_at").order("created_at", { ascending: false }).limit(params.limit || 50);
    if (params.status) q = q.eq("status", params.status);
    if (params.is_favorite !== undefined) q = q.eq("is_favorite", params.is_favorite);
    const { data, error } = await q;
    if (error) throw error;
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcp.tool("get_post", {
  description: "Get full details of a generated post by ID.",
  inputSchema: z.object({ id: z.string() }),
  handler: async ({ id }: any, { request }: any) => {
    const { supabase } = await authenticate(request);
    const { data, error } = await supabase.from("generated_posts").select("*").eq("id", id).single();
    if (error) throw error;
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcp.tool("generate_post", {
  description: "Generate a new LinkedIn post from selected sources. Returns the generated content (non-streaming).",
  inputSchema: z.object({
    input_ids: z.array(z.string()).optional(),
    goal: z.enum(["educate", "inspire", "promote", "engage", "storytelling"]).optional(),
    tone: z.enum(["professional", "casual", "inspirational", "direct", "humorous"]).optional(),
    language: z.enum(["es", "en", "pt"]).optional(),
    length: z.enum(["short", "medium", "long"]).optional(),
    cta: z.enum(["question", "share", "follow", "link", "none"]).optional(),
    target_audience: z.string().optional(),
    content_focus: z.string().optional(),
    voice_id: z.string().optional(),
  }),
  handler: async (params: any, { request }: any) => {
    const { supabase } = await authenticate(request);

    let sourceTexts: string[] = [];
    if (params.input_ids?.length) {
      const { data: inputs } = await supabase.from("inputs").select("title, raw_content, extracted_content, summary, original_url, type").in("id", params.input_ids);
      sourceTexts = (inputs || []).map((inp: any) => {
        const content = inp.extracted_content || inp.raw_content || inp.summary || "";
        return `[${inp.type.toUpperCase()}] ${inp.title}\n${content}${inp.original_url ? `\nURL: ${inp.original_url}` : ""}`;
      });
    }

    let voiceTexts: string[] = [];
    if (params.voice_id) {
      const { data: samples } = await supabase.from("voice_samples").select("title, content").eq("voice_id", params.voice_id).limit(10);
      if (samples?.length) voiceTexts = samples.map((s: any) => `${s.title ? `[${s.title}] ` : ""}${s.content}`);
    }

    const goalMap: Record<string, string> = { educate: "Educar a la audiencia", inspire: "Inspirar y motivar", promote: "Promocionar un producto o servicio", engage: "Generar engagement y conversación", storytelling: "Contar una historia" };
    const toneMap: Record<string, string> = { professional: "profesional", casual: "casual y cercano", inspirational: "inspiracional", direct: "directo y conciso", humorous: "con humor" };
    const lengthMap: Record<string, string> = { short: "corto (~100 palabras)", medium: "medio (~200 palabras)", long: "largo (~300 palabras)" };
    const ctaMap: Record<string, string> = { question: "una pregunta abierta al lector", share: "invitar a compartir", follow: "invitar a seguir", link: "invitar a visitar un enlace", none: "sin call to action" };
    const langMap: Record<string, string> = { es: "español", en: "inglés", pt: "portugués" };

    let systemPrompt = `Eres un experto creador de contenido para LinkedIn.\nGeneras posts de alta calidad, optimizados para engagement.\nUsa emojis con moderación, formato con saltos de línea y estructura visual clara.\nNO uses markdown (ni asteriscos ni negritas), escribe en texto plano.\nIMPORTANTE: NO empieces el post con texto entre corchetes como [Título] o [Hook]. Empieza directamente con el contenido del post.`;
    if (voiceTexts.length > 0) {
      systemPrompt += `\n\nIMPORTANTE - ESTILO DE ESCRITURA:\nAnaliza estos posts de referencia e imita el estilo fielmente.\n\nEJEMPLOS:\n${voiceTexts.map((t, i) => `--- Ejemplo ${i + 1} ---\n${t}`).join("\n\n")}\n--- Fin ---`;
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
    if (params.content_focus) userPrompt += `\n\nENFOQUE:\n${params.content_focus}`;
    userPrompt += "\n\nDevuelve solo el post, sin explicaciones ni metadatos.";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      }),
    });
    if (!aiResponse.ok) { const e = await aiResponse.text(); throw new Error(`AI error ${aiResponse.status}: ${e}`); }
    const aiResult = await aiResponse.json();
    const generatedContent = aiResult.choices?.[0]?.message?.content || "";
    return { content: [{ type: "text" as const, text: generatedContent }] };
  },
});

mcp.tool("save_post", {
  description: "Save a generated post to the database.",
  inputSchema: z.object({
    content: z.string(),
    title: z.string().optional(),
    input_ids: z.array(z.string()).optional(),
    goal: z.string().optional(),
    tone: z.string().optional(),
    language: z.string().optional(),
    length: z.string().optional(),
    cta: z.string().optional(),
    target_audience: z.string().optional(),
    content_focus: z.string().optional(),
    voice_id: z.string().optional(),
    status: z.enum(["draft", "final", "published"]).optional(),
  }),
  handler: async (params: any, { request }: any) => {
    const { supabase, userId } = await authenticate(request);
    const { data, error } = await supabase.from("generated_posts").insert({
      user_id: userId, content: params.content, title: params.title || null,
      input_id: params.input_ids?.[0] || null, input_ids: params.input_ids || [],
      goal: params.goal || null, tone: params.tone || null, language: params.language || null,
      length: params.length || null, cta: params.cta || null, target_audience: params.target_audience || null,
      content_focus: params.content_focus || null, voice_id: params.voice_id || null,
      status: params.status || "draft",
    }).select().single();
    if (error) throw error;
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcp.tool("delete_post", {
  description: "Delete a generated post by ID.",
  inputSchema: z.object({ id: z.string() }),
  handler: async ({ id }: any, { request }: any) => {
    const { supabase } = await authenticate(request);
    const { error } = await supabase.from("generated_posts").delete().eq("id", id);
    if (error) throw error;
    return { content: [{ type: "text" as const, text: "Deleted successfully" }] };
  },
});

// ── VOICES ──

mcp.tool("list_voices", {
  description: "List available writing voice profiles.",
  inputSchema: z.object({}),
  handler: async (_params: any, { request }: any) => {
    const { supabase } = await authenticate(request);
    const { data, error } = await supabase.from("voices").select("id, name, description, created_at").order("created_at", { ascending: false });
    if (error) throw error;
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

// ── NEWSLETTERS ──

mcp.tool("list_newsletters", {
  description: "List generated newsletters. Optional limit (default 20).",
  inputSchema: z.object({ limit: z.number().optional() }),
  handler: async (params: any, { request }: any) => {
    const { supabase } = await authenticate(request);
    const { data, error } = await supabase.from("newsletters").select("id, topic, language, created_at").order("created_at", { ascending: false }).limit(params.limit || 20);
    if (error) throw error;
    return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
  },
});

mcp.tool("get_newsletter", {
  description: "Get full newsletter content by ID, including items.",
  inputSchema: z.object({ id: z.string() }),
  handler: async ({ id }: any, { request }: any) => {
    const { supabase } = await authenticate(request);
    const { data: newsletter, error } = await supabase.from("newsletters").select("*").eq("id", id).single();
    if (error) throw error;
    const { data: items } = await supabase.from("newsletter_items").select("*").eq("newsletter_id", id).order("created_at");
    return { content: [{ type: "text" as const, text: JSON.stringify({ ...newsletter, items: items || [] }, null, 2) }] };
  },
});

// ── TRANSPORT ──

const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcp);

const app = new Hono();
app.all("/mcp-server", async (c) => {
  const response = await httpHandler(c.req.raw);
  return response;
});
app.all("/mcp-server/*", async (c) => {
  const response = await httpHandler(c.req.raw);
  return response;
});
app.all("/*", async (c) => {
  const response = await httpHandler(c.req.raw);
  return response;
});

Deno.serve(app.fetch);
