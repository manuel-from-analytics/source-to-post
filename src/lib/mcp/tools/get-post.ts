import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, jsonResult } from "../supabase-client";

export default defineTool({
  name: "get_post",
  title: "Get post",
  description: "Get full details of a generated post by ID, including labels, per-label publication info, and aggregated LinkedIn performance metrics.",
  inputSchema: { id: z.string() },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.from("generated_posts").select("*").eq("id", id).single();
    if (error) throw error;

    const [{ data: assignments }, { data: publications }, { data: metrics }] = await Promise.all([
      supabase.from("post_label_assignments").select("label_id, post_labels(id, name, color)").eq("post_id", id),
      supabase.from("post_label_publications").select("label_id, published_at").eq("post_id", id),
      supabase.from("linkedin_post_metrics").select("source, impressions, engagement_rate, posted_at, linkedin_url, imported_at").eq("post_id", id),
    ]);

    const pubMap = new Map<string, string>();
    for (const p of (publications ?? []) as any[]) pubMap.set(p.label_id, p.published_at);

    const labels = ((assignments ?? []) as any[])
      .map((a) => a.post_labels)
      .filter(Boolean)
      .map((lbl: any) => ({ id: lbl.id, name: lbl.name, color: lbl.color, published_at: pubMap.get(lbl.id) ?? null }));

    const metricsAgg: any[] = [];
    for (const m of (metrics ?? []) as any[]) {
      const engagements = Math.round((m.impressions || 0) * (m.engagement_rate || 0));
      const row = { source: m.source, impressions: m.impressions || 0, engagements, engagement_rate: m.engagement_rate || 0, posted_at: m.posted_at, linkedin_url: m.linkedin_url, imported_at: m.imported_at };
      const existing = metricsAgg.find((x) => x.source === m.source);
      if (!existing) metricsAgg.push(row);
      else if (row.impressions > existing.impressions) Object.assign(existing, row);
    }

    return jsonResult({ ...data, labels, metrics: metricsAgg });
  },
});
