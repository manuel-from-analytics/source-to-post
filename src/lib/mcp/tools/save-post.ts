import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, jsonResult } from "../supabase-client";

export default defineTool({
  name: "save_post",
  title: "Save post",
  description: "Save a previously generated post to the database.",
  inputSchema: {
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
    source_newsletter_id: z.string().optional(),
    source_newsletter_item_id: z.string().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async (params, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.from("generated_posts").insert({
      user_id: ctx.getUserId(),
      content: params.content,
      title: params.title ?? null,
      input_id: params.input_ids?.[0] ?? null,
      input_ids: params.input_ids ?? [],
      goal: params.goal ?? null,
      tone: params.tone ?? null,
      language: params.language ?? null,
      length: params.length ?? null,
      cta: params.cta ?? null,
      target_audience: params.target_audience ?? null,
      content_focus: params.content_focus ?? null,
      voice_id: params.voice_id ?? null,
      status: params.status ?? "draft",
      source_newsletter_id: params.source_newsletter_id ?? null,
      source_newsletter_item_id: params.source_newsletter_item_id ?? null,
    }).select().single();
    if (error) throw error;
    return jsonResult(data);
  },
});
