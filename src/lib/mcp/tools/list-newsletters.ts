import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, jsonResult } from "../supabase-client";

export default defineTool({
  name: "list_newsletters",
  title: "List newsletters",
  description: "List generated newsletters. Optional limit (default 20).",
  inputSchema: { limit: z.number().optional() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (params, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.from("newsletters")
      .select("id, topic, language, created_at")
      .order("created_at", { ascending: false })
      .limit(params.limit ?? 20);
    if (error) throw error;
    return jsonResult(data);
  },
});
