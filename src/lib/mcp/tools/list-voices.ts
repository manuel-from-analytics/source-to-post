import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, requireAuth, jsonResult } from "../supabase-client";

export default defineTool({
  name: "list_voices",
  title: "List voices",
  description: "List available writing voice profiles.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_params, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.from("voices")
      .select("id, name, description, created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return jsonResult(data);
  },
});
