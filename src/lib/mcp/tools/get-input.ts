import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, jsonResult } from "../supabase-client";

export default defineTool({
  name: "get_input",
  title: "Get input",
  description: "Get full details of a specific source by ID.",
  inputSchema: { id: z.string() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.from("inputs").select("*").eq("id", id).single();
    if (error) throw error;
    return jsonResult(data);
  },
});
