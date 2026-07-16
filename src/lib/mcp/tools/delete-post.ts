import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, textResult } from "../supabase-client";

export default defineTool({
  name: "delete_post",
  title: "Delete post",
  description: "Delete a generated post by ID.",
  inputSchema: { id: z.string() },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const { error } = await supabase.from("generated_posts").delete().eq("id", id);
    if (error) throw error;
    return textResult("Deleted successfully");
  },
});
