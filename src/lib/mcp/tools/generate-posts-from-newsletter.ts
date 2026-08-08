import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, jsonResult } from "../supabase-client";
import { generateContent } from "../generate-content";

export default defineTool({
  name: "generate_posts_from_newsletter",
  title: "Generate posts from newsletter",
  description: "Atomic daily-agent action: import all items from a newsletter, generate 1 draft post per item, and return the created posts. Idempotent per (user, newsletter_item).",
  inputSchema: {
    newsletter_id: z.string(),
    voice_id: z.string().optional(),
    goal: z.string().optional(),
    tone: z.string().optional(),
    language: z.string().optional(),
    length: z.string().optional(),
    cta: z.string().optional(),
    target_audience: z.string().optional(),
    content_focus: z.string().optional(),
    focus_angle: z.enum(["business", "technical", "strategic", "practical", "educational", "auto"]).optional(),
    extract_content: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: true },
  handler: async (params, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const userId = ctx.getUserId();
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;

    const { data: items, error } = await supabase.from("newsletter_items").select("*").eq("newsletter_id", params.newsletter_id);
    if (error) throw error;
    if (!items?.length) return jsonResult({ posts: [], skipped: 0, message: "No items in newsletter" });

    const results: any[] = [];
    let skipped = 0;

    for (const item of items) {
      const { data: existing } = await supabase.from("generated_posts")
        .select("id").eq("user_id", userId).eq("source_newsletter_item_id", item.id).maybeSingle();
      if (existing) { skipped++; continue; }

      let inputId = item.input_id;
      if (!inputId) {
        const isYoutube = (item.url || "").includes("youtube.com") || (item.url || "").includes("youtu.be");
        let extracted: string | null = null;
        if (params.extract_content) {
          try {
            const ex = await fetch(`${SUPABASE_URL}/functions/v1/extract-url`, {
              method: "POST",
              headers: { Authorization: `Bearer ${ctx.getToken()}`, "Content-Type": "application/json", apikey: ANON_KEY },
              body: JSON.stringify({ url: item.url }),
            });
            if (ex.ok) { const d = await ex.json(); extracted = d.content || d.extracted_content || null; }
          } catch { /* ignore */ }
        }
        const { data: newInput, error: ie } = await supabase.from("inputs").insert({
          user_id: userId,
          title: item.title,
          type: isYoutube ? "youtube" : "url",
          original_url: item.url,
          raw_content: extracted,
          summary: item.description || null,
        }).select().single();
        if (ie) { results.push({ item_id: item.id, error: ie.message }); continue; }
        inputId = newInput.id;
        await supabase.from("newsletter_items").update({ imported_to_library: true, input_id: inputId }).eq("id", item.id);
      }

      try {
        const content = await generateContent(supabase, { ...params, input_ids: [inputId] });
        const { data: post, error: pe } = await supabase.from("generated_posts").insert({
          user_id: userId,
          content,
          title: item.title,
          input_id: inputId,
          input_ids: [inputId],
          goal: params.goal ?? null,
          tone: params.tone ?? null,
          language: params.language ?? null,
          length: params.length ?? null,
          cta: params.cta ?? null,
          target_audience: params.target_audience ?? null,
          content_focus: params.content_focus ?? null,
          focus_angle: params.focus_angle ?? null,
          voice_id: params.voice_id ?? null,
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

    return jsonResult({ posts: results, skipped, total_items: items.length });
  },
});
