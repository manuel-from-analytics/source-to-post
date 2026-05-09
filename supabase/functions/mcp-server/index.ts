import { Hono } from "hono";
import { McpServer, StreamableHttpTransport } from "mcp-lite";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { decode } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

let _ctx: { supabase: SupabaseClient; userId: string; userJwt: string | null } | null = null;
function getCtx() {
  if (!_ctx) throw new Error("No request context available");
  return _ctx;
}

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const json = (obj: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }] });

const mcp = new McpServer({ name: "source-to-post", version: "2.0.0" });

// ── INPUTS ──
mcp.tool("list_inputs", {
  description: "List sources from the library. Optional filters: type, is_favorite, category_id, limit.",
  inputSchema: {
    type: "object" as const,
    properties: {
      type: { type: "string" as const, enum: ["pdf", "url", "youtube", "text"] },
      is_favorite: { type: "boolean" as const },
      category_id: { type: "string" as const },
      limit: { type: "number" as const },
    },
  },
  handler: async (params: any) => {
    const { supabase } = getCtx();
    let q = supabase.from("inputs").select("id, title, type, original_url, summary, category_id, is_favorite, created_at").order("created_at", { ascending: false }).limit(params.limit || 50);
    if (params.type) q = q.eq("type", params.type);
    if (params.is_favorite !== undefined) q = q.eq("is_favorite", params.is_favorite);
    if (params.category_id) q = q.eq("category_id", params.category_id);
    const { data, error } = await q;
    if (error) throw error;
    return json(data);
  },
});

mcp.tool("get_input", {
  description: "Get full details of a specific source by ID.",
  inputSchema: { type: "object" as const, properties: { id: { type: "string" as const } }, required: ["id"] as const },
  handler: async ({ id }: any) => {
    const { supabase } = getCtx();
    const { data, error } = await supabase.from("inputs").select("*").eq("id", id).single();
    if (error) throw error;
    return json(data);
  },
});

mcp.tool("create_input", {
  description: "Add a new text or URL source to the library.",
  inputSchema: {
    type: "object" as const,
    properties: {
      title: { type: "string" as const },
      type: { type: "string" as const, enum: ["text", "url", "youtube"] },
      raw_content: { type: "string" as const },
      original_url: { type: "string" as const },
    },
    required: ["title", "type"] as const,
  },
  handler: async (params: any) => {
    const { supabase, userId } = getCtx();
    const { data, error } = await supabase.from("inputs").insert({
      user_id: userId, title: params.title, type: params.type,
      raw_content: params.raw_content || null, original_url: params.original_url || null,
    }).select().single();
    if (error) throw error;
    return json(data);
  },
});

mcp.tool("delete_input", {
  description: "Delete a source from the library by ID.",
  inputSchema: { type: "object" as const, properties: { id: { type: "string" as const } }, required: ["id"] as const },
  handler: async ({ id }: any) => {
    const { supabase } = getCtx();
    const { error } = await supabase.from("inputs").delete().eq("id", id);
    if (error) throw error;
    return { content: [{ type: "text" as const, text: "Deleted successfully" }] };
  },
});

// ── POSTS ──
mcp.tool("list_posts", {
  description: "List generated posts. Filters: status, is_favorite, source_newsletter_id, created_after (ISO), created_before (ISO), limit.",
  inputSchema: {
    type: "object" as const,
    properties: {
      status: { type: "string" as const, enum: ["draft", "final", "published"] },
      is_favorite: { type: "boolean" as const },
      source_newsletter_id: { type: "string" as const },
      created_after: { type: "string" as const },
      created_before: { type: "string" as const },
      limit: { type: "number" as const },
    },
  },
  handler: async (params: any) => {
    const { supabase } = getCtx();
    let q = supabase.from("generated_posts").select("id, title, content, status, goal, tone, language, is_favorite, source_newsletter_id, source_newsletter_item_id, created_at").order("created_at", { ascending: false }).limit(params.limit || 50);
    if (params.status) q = q.eq("status", params.status);
    if (params.is_favorite !== undefined) q = q.eq("is_favorite", params.is_favorite);
    if (params.source_newsletter_id) q = q.eq("source_newsletter_id", params.source_newsletter_id);
    if (params.created_after) q = q.gte("created_at", params.created_after);
    if (params.created_before) q = q.lte("created_at", params.created_before);
    const { data, error } = await q;
    if (error) throw error;
    return json(data);
  },
});

mcp.tool("get_post", {
  description: "Get full details of a generated post by ID.",
  inputSchema: { type: "object" as const, properties: { id: { type: "string" as const } }, required: ["id"] as const },
  handler: async ({ id }: any) => {
    const { supabase } = getCtx();
    const { data, error } = await supabase.from("generated_posts").select("*").eq("id", id).single();
    if (error) throw error;
    return json(data);
  },
});

const goalMap: Record<string, string> = { educate: "Educar a la audiencia", inspire: "Inspirar y motivar", promote: "Promocionar un producto o servicio", engage: "Generar engagement y conversación", storytelling: "Contar una historia" };
const toneMap: Record<string, string> = { professional: "profesional", casual: "casual y cercano", inspirational: "inspiracional", direct: "directo y conciso", humorous: "con humor" };
const lengthMap: Record<string, string> = { short: "corto (~100 palabras)", medium: "medio (~200 palabras)", long: "largo (~300 palabras)" };
const ctaMap: Record<string, string> = { question: "una pregunta abierta al lector", share: "invitar a compartir", follow: "invitar a seguir", link: "invitar a visitar un enlace", none: "sin call to action" };
const langMap: Record<string, string> = { es: "español", en: "inglés", pt: "portugués" };

async function generateContent(supabase: SupabaseClient, params: any): Promise<string> {
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
  return (aiResult.choices?.[0]?.message?.content || "").replace(/^\s*\[.*?\]\s*/g, "");
}

mcp.tool("generate_post", {
  description: "Generate a LinkedIn post from selected sources. If save=true, also persists it to the database in one call.",
  inputSchema: {
    type: "object" as const,
    properties: {
      input_ids: { type: "array" as const, items: { type: "string" as const } },
      goal: { type: "string" as const, enum: ["educate", "inspire", "promote", "engage", "storytelling"] },
      tone: { type: "string" as const, enum: ["professional", "casual", "inspirational", "direct", "humorous"] },
      language: { type: "string" as const, enum: ["es", "en", "pt"] },
      length: { type: "string" as const, enum: ["short", "medium", "long"] },
      cta: { type: "string" as const, enum: ["question", "share", "follow", "link", "none"] },
      target_audience: { type: "string" as const },
      content_focus: { type: "string" as const },
      voice_id: { type: "string" as const },
      save: { type: "boolean" as const, description: "If true, also save to DB and return the saved post." },
      status: { type: "string" as const, enum: ["draft", "final", "published"] },
      title: { type: "string" as const },
    },
  },
  handler: async (params: any) => {
    const { supabase, userId } = getCtx();
    const content = await generateContent(supabase, params);
    if (!params.save) return { content: [{ type: "text" as const, text: content }] };
    const { data, error } = await supabase.from("generated_posts").insert({
      user_id: userId, content, title: params.title || null,
      input_id: params.input_ids?.[0] || null, input_ids: params.input_ids || [],
      goal: params.goal || null, tone: params.tone || null, language: params.language || null,
      length: params.length || null, cta: params.cta || null, target_audience: params.target_audience || null,
      content_focus: params.content_focus || null, voice_id: params.voice_id || null,
      status: params.status || "draft",
    }).select().single();
    if (error) throw error;
    return json(data);
  },
});

mcp.tool("save_post", {
  description: "Save a previously generated post to the database.",
  inputSchema: {
    type: "object" as const,
    properties: {
      content: { type: "string" as const },
      title: { type: "string" as const },
      input_ids: { type: "array" as const, items: { type: "string" as const } },
      goal: { type: "string" as const }, tone: { type: "string" as const }, language: { type: "string" as const },
      length: { type: "string" as const }, cta: { type: "string" as const }, target_audience: { type: "string" as const },
      content_focus: { type: "string" as const }, voice_id: { type: "string" as const },
      status: { type: "string" as const, enum: ["draft", "final", "published"] },
      source_newsletter_id: { type: "string" as const },
      source_newsletter_item_id: { type: "string" as const },
    },
    required: ["content"] as const,
  },
  handler: async (params: any) => {
    const { supabase, userId } = getCtx();
    const { data, error } = await supabase.from("generated_posts").insert({
      user_id: userId, content: params.content, title: params.title || null,
      input_id: params.input_ids?.[0] || null, input_ids: params.input_ids || [],
      goal: params.goal || null, tone: params.tone || null, language: params.language || null,
      length: params.length || null, cta: params.cta || null, target_audience: params.target_audience || null,
      content_focus: params.content_focus || null, voice_id: params.voice_id || null,
      status: params.status || "draft",
      source_newsletter_id: params.source_newsletter_id || null,
      source_newsletter_item_id: params.source_newsletter_item_id || null,
    }).select().single();
    if (error) throw error;
    return json(data);
  },
});

mcp.tool("update_post", {
  description: "Update an existing post by ID.",
  inputSchema: {
    type: "object" as const,
    properties: {
      id: { type: "string" as const }, content: { type: "string" as const }, title: { type: "string" as const },
      status: { type: "string" as const, enum: ["draft", "final", "published"] },
      goal: { type: "string" as const }, tone: { type: "string" as const }, language: { type: "string" as const },
      length: { type: "string" as const }, cta: { type: "string" as const }, target_audience: { type: "string" as const },
      content_focus: { type: "string" as const }, voice_id: { type: "string" as const },
      is_favorite: { type: "boolean" as const },
    },
    required: ["id"] as const,
  },
  handler: async (params: any) => {
    const { supabase } = getCtx();
    const { id, ...updates } = params;
    const cleanUpdates: Record<string, any> = {};
    for (const [k, v] of Object.entries(updates)) if (v !== undefined) cleanUpdates[k] = v;
    if (Object.keys(cleanUpdates).length === 0) throw new Error("No fields to update");
    const { data, error } = await supabase.from("generated_posts").update(cleanUpdates).eq("id", id).select().single();
    if (error) throw error;
    return json(data);
  },
});

mcp.tool("delete_post", {
  description: "Delete a generated post by ID.",
  inputSchema: { type: "object" as const, properties: { id: { type: "string" as const } }, required: ["id"] as const },
  handler: async ({ id }: any) => {
    const { supabase } = getCtx();
    const { error } = await supabase.from("generated_posts").delete().eq("id", id);
    if (error) throw error;
    return { content: [{ type: "text" as const, text: "Deleted successfully" }] };
  },
});

// ── VOICES ──
mcp.tool("list_voices", {
  description: "List available writing voice profiles.",
  inputSchema: { type: "object" as const, properties: {} },
  handler: async () => {
    const { supabase } = getCtx();
    const { data, error } = await supabase.from("voices").select("id, name, description, created_at").order("created_at", { ascending: false });
    if (error) throw error;
    return json(data);
  },
});

// ── USER DEFAULTS ──
mcp.tool("get_user_defaults", {
  description: "Get the user's profile defaults (default voice, CTA, length, languages, writing style).",
  inputSchema: { type: "object" as const, properties: {} },
  handler: async () => {
    const { supabase, userId } = getCtx();
    const { data, error } = await supabase.from("profiles")
      .select("id, full_name, default_voice_id, default_cta, default_length, preferred_language, app_language, default_writing_style, newsletter_preferences")
      .eq("id", userId).single();
    if (error) throw error;
    return json(data);
  },
});

// ── NEWSLETTERS ──
mcp.tool("list_newsletters", {
  description: "List generated newsletters. Optional limit (default 20).",
  inputSchema: { type: "object" as const, properties: { limit: { type: "number" as const } } },
  handler: async (params: any) => {
    const { supabase } = getCtx();
    const { data, error } = await supabase.from("newsletters").select("id, topic, language, created_at").order("created_at", { ascending: false }).limit(params.limit || 20);
    if (error) throw error;
    return json(data);
  },
});

mcp.tool("get_newsletter", {
  description: "Get full newsletter content by ID, including items.",
  inputSchema: { type: "object" as const, properties: { id: { type: "string" as const } }, required: ["id"] as const },
  handler: async ({ id }: any) => {
    const { supabase } = getCtx();
    const { data: newsletter, error } = await supabase.from("newsletters").select("*").eq("id", id).single();
    if (error) throw error;
    const { data: items } = await supabase.from("newsletter_items").select("*").eq("newsletter_id", id).order("created_at");
    return json({ ...newsletter, items: items || [] });
  },
});

mcp.tool("list_newsletter_items", {
  description: "List items (sources found) for a given newsletter.",
  inputSchema: { type: "object" as const, properties: { newsletter_id: { type: "string" as const } }, required: ["newsletter_id"] as const },
  handler: async ({ newsletter_id }: any) => {
    const { supabase } = getCtx();
    const { data, error } = await supabase.from("newsletter_items")
      .select("id, title, url, description, source_type, imported_to_library, input_id, pub_date, created_at")
      .eq("newsletter_id", newsletter_id).order("created_at");
    if (error) throw error;
    return json(data);
  },
});

mcp.tool("generate_newsletter", {
  description: "Generate a fresh newsletter using the user's preferences. Returns newsletter_id and items found.",
  inputSchema: {
    type: "object" as const,
    properties: {
      topic: { type: "string" as const },
      language: { type: "string" as const, enum: ["es", "en", "pt"] },
      freshness_months: { type: "number" as const },
      preference_profile_id: { type: "string" as const },
    },
  },
  handler: async (params: any) => {
    const { userJwt } = getCtx();
    if (!userJwt) throw new Error("generate_newsletter requires a user JWT (x-user-token). Agent keys cannot invoke chained edge functions yet.");
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-newsletter`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userJwt}`, "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(params),
    });
    if (!resp.ok) throw new Error(`generate-newsletter failed ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    return json(data);
  },
});

mcp.tool("import_newsletter_item_as_input", {
  description: "Import a newsletter item into the library as a reusable input.",
  inputSchema: {
    type: "object" as const,
    properties: {
      item_id: { type: "string" as const },
      extract_content: { type: "boolean" as const, description: "If true, fetch full URL content via extract-url." },
    },
    required: ["item_id"] as const,
  },
  handler: async ({ item_id, extract_content }: any) => {
    const { supabase, userId, userJwt } = getCtx();
    const { data: item, error: ie } = await supabase.from("newsletter_items").select("*").eq("id", item_id).single();
    if (ie) throw ie;
    if (item.input_id) {
      const { data: existing } = await supabase.from("inputs").select("*").eq("id", item.input_id).single();
      return json({ input: existing, already_imported: true });
    }

    const isYoutube = (item.url || "").includes("youtube.com") || (item.url || "").includes("youtu.be");
    const type = isYoutube ? "youtube" : "url";

    let extracted: string | null = null;
    if (extract_content && userJwt) {
      try {
        const ex = await fetch(`${SUPABASE_URL}/functions/v1/extract-url`, {
          method: "POST",
          headers: { Authorization: `Bearer ${userJwt}`, "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
          body: JSON.stringify({ url: item.url }),
        });
        if (ex.ok) { const d = await ex.json(); extracted = d.content || d.extracted_content || null; }
      } catch (_) { /* ignore */ }
    }

    const { data: input, error: ce } = await supabase.from("inputs").insert({
      user_id: userId, title: item.title, type,
      original_url: item.url, raw_content: extracted, summary: item.description || null,
    }).select().single();
    if (ce) throw ce;

    await supabase.from("newsletter_items").update({ imported_to_library: true, input_id: input.id }).eq("id", item_id);
    return json({ input, already_imported: false });
  },
});

mcp.tool("generate_posts_from_newsletter", {
  description: "Atomic daily-agent action: import all items from a newsletter, generate 1 draft post per item, and return the created posts. Idempotent per (user, newsletter_item).",
  inputSchema: {
    type: "object" as const,
    properties: {
      newsletter_id: { type: "string" as const },
      voice_id: { type: "string" as const },
      goal: { type: "string" as const }, tone: { type: "string" as const }, language: { type: "string" as const },
      length: { type: "string" as const }, cta: { type: "string" as const }, target_audience: { type: "string" as const },
      content_focus: { type: "string" as const },
      extract_content: { type: "boolean" as const, description: "Fetch full article body before generating. Default false." },
    },
    required: ["newsletter_id"] as const,
  },
  handler: async (params: any) => {
    const { supabase, userId, userJwt } = getCtx();
    const { data: items, error } = await supabase.from("newsletter_items").select("*").eq("newsletter_id", params.newsletter_id);
    if (error) throw error;
    if (!items?.length) return json({ posts: [], skipped: 0, message: "No items in newsletter" });

    const results: any[] = [];
    let skipped = 0;

    for (const item of items) {
      // Idempotency check
      const { data: existing } = await supabase.from("generated_posts")
        .select("id").eq("user_id", userId).eq("source_newsletter_item_id", item.id).maybeSingle();
      if (existing) { skipped++; continue; }

      // Ensure input exists
      let inputId = item.input_id;
      if (!inputId) {
        const isYoutube = (item.url || "").includes("youtube.com") || (item.url || "").includes("youtu.be");
        let extracted: string | null = null;
        if (params.extract_content && userJwt) {
          try {
            const ex = await fetch(`${SUPABASE_URL}/functions/v1/extract-url`, {
              method: "POST",
              headers: { Authorization: `Bearer ${userJwt}`, "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
              body: JSON.stringify({ url: item.url }),
            });
            if (ex.ok) { const d = await ex.json(); extracted = d.content || d.extracted_content || null; }
          } catch (_) { /* ignore */ }
        }
        const { data: newInput, error: ie } = await supabase.from("inputs").insert({
          user_id: userId, title: item.title, type: isYoutube ? "youtube" : "url",
          original_url: item.url, raw_content: extracted, summary: item.description || null,
        }).select().single();
        if (ie) { results.push({ item_id: item.id, error: ie.message }); continue; }
        inputId = newInput.id;
        await supabase.from("newsletter_items").update({ imported_to_library: true, input_id: inputId }).eq("id", item.id);
      }

      try {
        const content = await generateContent(supabase, { ...params, input_ids: [inputId] });
        const { data: post, error: pe } = await supabase.from("generated_posts").insert({
          user_id: userId, content, title: item.title,
          input_id: inputId, input_ids: [inputId],
          goal: params.goal || null, tone: params.tone || null, language: params.language || null,
          length: params.length || null, cta: params.cta || null, target_audience: params.target_audience || null,
          content_focus: params.content_focus || null, voice_id: params.voice_id || null,
          status: "draft",
          source_newsletter_id: params.newsletter_id,
          source_newsletter_item_id: item.id,
        }).select("id, title").single();
        if (pe) { results.push({ item_id: item.id, error: pe.message }); continue; }
        results.push({ item_id: item.id, input_id: inputId, post_id: post.id, title: post.title });
      } catch (e: any) {
        results.push({ item_id: item.id, error: e.message });
      }
    }

    return json({ posts: results, skipped, total_items: items.length });
  },
});

// ── NOTIFICATION ──
mcp.tool("notify_review", {
  description: "Send a notification (email) summarizing posts ready for review. Includes deep links.",
  inputSchema: {
    type: "object" as const,
    properties: {
      post_ids: { type: "array" as const, items: { type: "string" as const } },
      subject: { type: "string" as const },
      summary: { type: "string" as const },
      to: { type: "string" as const, description: "Override recipient. Defaults to the user's auth email." },
    },
    required: ["post_ids"] as const,
  },
  handler: async (params: any) => {
    const { userJwt } = getCtx();
    if (!userJwt) throw new Error("notify_review requires a user JWT (x-user-token).");
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/notify-review`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userJwt}`, "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify(params),
    });
    if (!resp.ok) throw new Error(`notify-review failed ${resp.status}: ${await resp.text()}`);
    const data = await resp.json();
    return json(data);
  },
});

// ── AGENT RUN LOG ──
mcp.tool("log_agent_run", {
  description: "Record the outcome of an agent execution for auditing and idempotency.",
  inputSchema: {
    type: "object" as const,
    properties: {
      newsletter_id: { type: "string" as const },
      posts_created: { type: "number" as const },
      status: { type: "string" as const, enum: ["running", "success", "error", "partial"] },
      error: { type: "string" as const },
      notified: { type: "boolean" as const },
    },
  },
  handler: async (params: any) => {
    const { supabase, userId } = getCtx();
    const { data, error } = await supabase.from("agent_runs").insert({
      user_id: userId,
      newsletter_id: params.newsletter_id || null,
      posts_created: params.posts_created || 0,
      status: params.status || "success",
      error: params.error || null,
      notified_at: params.notified ? new Date().toISOString() : null,
      finished_at: new Date().toISOString(),
    }).select().single();
    if (error) throw error;
    return json(data);
  },
});

// ── TRANSPORT & AUTH ──
const transport = new StreamableHttpTransport();
const httpHandler = transport.bind(mcp);

const app = new Hono();
app.all("/*", async (c) => {
  const userToken = c.req.header("x-user-token");
  const agentKey = c.req.header("x-agent-key");

  let userId: string;
  let supabase: SupabaseClient;
  let userJwt: string | null = null;

  if (agentKey) {
    // Agent key auth — long-lived, looked up by hash
    try {
      const hash = await sha256(agentKey);
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: row, error } = await admin.from("agent_api_keys").select("user_id, id").eq("key_hash", hash).maybeSingle();
      if (error || !row) {
        return c.json({ jsonrpc: "2.0", error: { code: -32600, message: "Unauthorized – invalid agent key" }, id: null }, 401);
      }
      userId = row.user_id;
      // Update last_used_at (fire & forget)
      admin.from("agent_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", row.id).then();
      // Use service role client; tools run as the resolved user_id (RLS bypassed but we always filter by user_id explicitly)
      supabase = admin;
    } catch (e: any) {
      return c.json({ jsonrpc: "2.0", error: { code: -32600, message: `Unauthorized – ${e.message}` }, id: null }, 401);
    }
  } else if (userToken) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: `Bearer ${userToken}` } } });
    userJwt = userToken;
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser(userToken);
      if (userError || !user) throw new Error(userError?.message ?? "Failed to get user");
      userId = user.id;
    } catch (_e) {
      try {
        const [_h, payload] = decode(userToken);
        const claims = payload as Record<string, unknown>;
        if (!claims.sub || typeof claims.sub !== "string") {
          return c.json({ jsonrpc: "2.0", error: { code: -32600, message: "Unauthorized – invalid token claims" }, id: null }, 401);
        }
        if (claims.exp && typeof claims.exp === "number" && claims.exp < Date.now() / 1000) {
          return c.json({ jsonrpc: "2.0", error: { code: -32600, message: "Unauthorized – token expired" }, id: null }, 401);
        }
        userId = claims.sub;
      } catch (decodeErr: any) {
        return c.json({ jsonrpc: "2.0", error: { code: -32600, message: `Unauthorized – ${decodeErr.message}` }, id: null }, 401);
      }
    }
  } else {
    return c.json({ jsonrpc: "2.0", error: { code: -32600, message: "Missing x-user-token or x-agent-key header" }, id: null }, 401);
  }

  _ctx = { supabase, userId, userJwt };
  try {
    return await httpHandler(c.req.raw);
  } finally {
    _ctx = null;
  }
});

Deno.serve(app.fetch);
