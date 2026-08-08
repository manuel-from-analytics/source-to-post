import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, jsonResult, textResult } from "../supabase-client";
import { generateContent } from "../generate-content";

export default defineTool({
  name: "generate_post",
  title: "Generate LinkedIn post",
  description: "Generate a LinkedIn post from selected sources. If save=true, also persists it to the database in one call.",
  inputSchema: {
    input_ids: z.array(z.string()).optional(),
    goal: z.enum(["educate", "inspire", "promote", "engage", "storytelling"]).optional(),
    tone: z.enum(["professional", "casual", "inspirational", "direct", "humorous"]).optional(),
    language: z.enum(["es", "en", "pt"]).optional(),
    length: z.enum(["short", "medium", "long"]).optional(),
    cta: z.enum(["question", "share", "follow", "link", "none"]).optional(),
    target_audience: z.string().optional(),
    content_focus: z.string().optional(),
    focus_angle: z.enum(["business", "technical", "strategic", "practical", "educational", "auto"]).optional().describe("Angle of the post: business impact, technical depth, market strategy, actionable, or explanatory."),
    voice_id: z.string().optional(),
    save: z.boolean().optional(),
    status: z.enum(["draft", "final", "published"]).optional(),
    title: z.string().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: true },
  handler: async (params, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const content = await generateContent(supabase, params);
    if (!params.save) return textResult(content);
    const { data, error } = await supabase.from("generated_posts").insert({
      user_id: ctx.getUserId(),
      content,
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
    }).select().single();
    if (error) throw error;
    return jsonResult(data);
  },
});
