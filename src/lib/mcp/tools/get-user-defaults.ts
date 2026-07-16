import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser, requireAuth, jsonResult } from "../supabase-client";

export default defineTool({
  name: "get_user_defaults",
  title: "Get user defaults",
  description: "Get the user's profile defaults (default voice, CTA, length, languages, writing style, newsletter preferences).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_params, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.from("profiles")
      .select("id, full_name, default_voice_id, default_cta, default_length, preferred_language, app_language, default_writing_style, newsletter_preferences")
      .eq("id", ctx.getUserId())
      .single();
    if (error) throw error;
    return jsonResult(data);
  },
});
