import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, jsonResult } from "../supabase-client";

export default defineTool({
  name: "notify_review",
  title: "Notify review",
  description: "Send a notification (email) summarizing posts ready for review. Includes deep links.",
  inputSchema: {
    post_ids: z.array(z.string()),
    subject: z.string().optional(),
    summary: z.string().optional(),
    to: z.string().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: true },
  handler: async (params, ctx) => {
    requireAuth(ctx);
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/notify-review`, {
      method: "POST",
      headers: { Authorization: `Bearer ${ctx.getToken()}`, "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify(params),
    });
    if (!resp.ok) throw new Error(`notify-review failed ${resp.status}: ${await resp.text()}`);
    return jsonResult(await resp.json());
  },
});
