import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, jsonResult } from "../supabase-client";

export default defineTool({
  name: "list_inputs",
  title: "List inputs",
  description: "List sources from the library. Optional filters: type, is_favorite, category_id, limit.",
  inputSchema: {
    type: z.enum(["pdf", "url", "youtube", "text"]).optional(),
    is_favorite: z.boolean().optional(),
    category_id: z.string().optional(),
    limit: z.number().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (params, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    let q = supabase.from("inputs")
      .select("id, title, type, original_url, summary, category_id, is_favorite, created_at")
      .order("created_at", { ascending: false })
      .limit(params.limit ?? 50);
    if (params.type) q = q.eq("type", params.type);
    if (params.is_favorite !== undefined) q = q.eq("is_favorite", params.is_favorite);
    if (params.category_id) q = q.eq("category_id", params.category_id);
    const { data, error } = await q;
    if (error) throw error;
    return jsonResult(data);
  },
});
