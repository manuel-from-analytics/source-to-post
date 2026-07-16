import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, jsonResult } from "../supabase-client";

export default defineTool({
  name: "list_newsletter_items",
  title: "List newsletter items",
  description: "List items (sources found) for a given newsletter.",
  inputSchema: { newsletter_id: z.string() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ newsletter_id }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.from("newsletter_items")
      .select("id, title, url, description, source_type, imported_to_library, input_id, pub_date, created_at")
      .eq("newsletter_id", newsletter_id)
      .order("created_at");
    if (error) throw error;
    return jsonResult(data);
  },
});
