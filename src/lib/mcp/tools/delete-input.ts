import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, textResult } from "../supabase-client";

export default defineTool({
  name: "delete_input",
  title: "Delete input",
  description: "Delete a source from the library by ID.",
  inputSchema: { id: z.string() },
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const { error } = await supabase.from("inputs").delete().eq("id", id);
    if (error) throw error;
    return textResult("Deleted successfully");
  },
});
