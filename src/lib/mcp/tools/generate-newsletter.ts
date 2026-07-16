import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, jsonResult } from "../supabase-client";

export default defineTool({
  name: "generate_newsletter",
  title: "Generate newsletter",
  description: "Generate a fresh newsletter using the user's preferences. Returns newsletter_id and items found.",
  inputSchema: {
    topic: z.string().optional(),
    language: z.enum(["es", "en", "pt"]).optional(),
    freshness_months: z.number().optional(),
    preference_profile_id: z.string().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: true },
  handler: async (params, ctx) => {
    requireAuth(ctx);
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
    const token = ctx.getToken();
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/generate-newsletter`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify(params),
    });
    if (!resp.ok) throw new Error(`generate-newsletter failed ${resp.status}: ${await resp.text()}`);
    return jsonResult(await resp.json());
  },
});
