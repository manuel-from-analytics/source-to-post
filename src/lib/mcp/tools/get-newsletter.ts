import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, jsonResult } from "../supabase-client";

export default defineTool({
  name: "get_newsletter",
  title: "Get newsletter",
  description: "Get full newsletter content by ID, including its items.",
  inputSchema: { id: z.string() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const { data: newsletter, error } = await supabase.from("newsletters").select("*").eq("id", id).single();
    if (error) throw error;
    const { data: items } = await supabase.from("newsletter_items").select("*").eq("newsletter_id", id).order("created_at");
    return jsonResult({ ...newsletter, items: items || [] });
  },
});
