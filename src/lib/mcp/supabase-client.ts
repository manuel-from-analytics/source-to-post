// Helper for MCP tools: builds a Supabase client that runs as the OAuth user,
// so RLS applies. Called inside tool handlers (never at module top level) so
// env reads only happen at request time.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "@lovable.dev/mcp-js";

export function supabaseForUser(ctx: ToolContext): SupabaseClient {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
  const token = ctx.getToken();
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function requireAuth(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) {
    throw new Error("Not authenticated");
  }
}

export function jsonResult(obj: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(obj, null, 2) }] };
}

export function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}
