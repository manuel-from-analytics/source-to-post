import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, jsonResult } from "../supabase-client";

export default defineTool({
  name: "create_input",
  title: "Create input",
  description: "Add a new text, url or youtube source to the library.",
  inputSchema: {
    title: z.string(),
    type: z.enum(["text", "url", "youtube"]),
    raw_content: z.string().optional(),
    original_url: z.string().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async (params, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.from("inputs").insert({
      user_id: ctx.getUserId(),
      title: params.title,
      type: params.type,
      raw_content: params.raw_content ?? null,
      original_url: params.original_url ?? null,
    }).select().single();
    if (error) throw error;
    return jsonResult(data);
  },
});
