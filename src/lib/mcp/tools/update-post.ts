import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, jsonResult } from "../supabase-client";

export default defineTool({
  name: "update_post",
  title: "Update post",
  description: "Update an existing post by ID.",
  inputSchema: {
    id: z.string(),
    content: z.string().optional(),
    title: z.string().optional(),
    status: z.enum(["draft", "final", "published"]).optional(),
    goal: z.string().optional(),
    tone: z.string().optional(),
    language: z.string().optional(),
    length: z.string().optional(),
    cta: z.string().optional(),
    target_audience: z.string().optional(),
    content_focus: z.string().optional(),
    focus_angle: z.enum(["business", "technical", "strategic", "practical", "educational", "auto"]).optional(),
    voice_id: z.string().optional(),
    is_favorite: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async (params, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const { id, ...updates } = params;
    const cleanUpdates: Record<string, any> = {};
    for (const [k, v] of Object.entries(updates)) if (v !== undefined) cleanUpdates[k] = v;
    if (Object.keys(cleanUpdates).length === 0) throw new Error("No fields to update");
    const { data, error } = await supabase.from("generated_posts").update(cleanUpdates).eq("id", id).select().single();
    if (error) throw error;
    return jsonResult(data);
  },
});
