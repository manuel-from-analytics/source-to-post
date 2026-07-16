import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, jsonResult } from "../supabase-client";

export default defineTool({
  name: "log_agent_run",
  title: "Log agent run",
  description: "Record the outcome of an agent execution for auditing and idempotency.",
  inputSchema: {
    newsletter_id: z.string().optional(),
    posts_created: z.number().optional(),
    status: z.enum(["running", "success", "error", "partial"]).optional(),
    error: z.string().optional(),
    notified: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: false },
  handler: async (params, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.from("agent_runs").insert({
      user_id: ctx.getUserId(),
      newsletter_id: params.newsletter_id ?? null,
      posts_created: params.posts_created ?? 0,
      status: params.status ?? "success",
      error: params.error ?? null,
      notified_at: params.notified ? new Date().toISOString() : null,
      finished_at: new Date().toISOString(),
    }).select().single();
    if (error) throw error;
    return jsonResult(data);
  },
});
