import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, jsonResult } from "../supabase-client";

export default defineTool({
  name: "import_newsletter_item_as_input",
  title: "Import newsletter item",
  description: "Import a newsletter item into the library as a reusable input.",
  inputSchema: {
    item_id: z.string(),
    extract_content: z.boolean().optional(),
  },
  annotations: { readOnlyHint: false, openWorldHint: true },
  handler: async ({ item_id, extract_content }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const { data: item, error: ie } = await supabase.from("newsletter_items").select("*").eq("id", item_id).single();
    if (ie) throw ie;
    if (item.input_id) {
      const { data: existing } = await supabase.from("inputs").select("*").eq("id", item.input_id).single();
      return jsonResult({ input: existing, already_imported: true });
    }

    const isYoutube = (item.url || "").includes("youtube.com") || (item.url || "").includes("youtu.be");
    const type = isYoutube ? "youtube" : "url";

    let extracted: string | null = null;
    if (extract_content) {
      const SUPABASE_URL = process.env.SUPABASE_URL!;
      const ANON_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!;
      try {
        const ex = await fetch(`${SUPABASE_URL}/functions/v1/extract-url`, {
          method: "POST",
          headers: { Authorization: `Bearer ${ctx.getToken()}`, "Content-Type": "application/json", apikey: ANON_KEY },
          body: JSON.stringify({ url: item.url }),
        });
        if (ex.ok) { const d = await ex.json(); extracted = d.content || d.extracted_content || null; }
      } catch { /* ignore */ }
    }

    const { data: input, error: ce } = await supabase.from("inputs").insert({
      user_id: ctx.getUserId(),
      title: item.title,
      type,
      original_url: item.url,
      raw_content: extracted,
      summary: item.description || null,
    }).select().single();
    if (ce) throw ce;

    await supabase.from("newsletter_items").update({ imported_to_library: true, input_id: input.id }).eq("id", item_id);
    return jsonResult({ input, already_imported: false });
  },
});
