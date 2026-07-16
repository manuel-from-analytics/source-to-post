import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser, requireAuth, jsonResult } from "../supabase-client";

export default defineTool({
  name: "list_posts",
  title: "List generated posts",
  description: "List generated posts including labels (personal/empresa), per-label publication dates, and LinkedIn performance metrics. Each post includes a `metrics` array and aggregated `performance` object. Filters: status, is_favorite, source_newsletter_id, created_after (ISO), created_before (ISO), label (name, case-insensitive), limit.",
  inputSchema: {
    status: z.enum(["draft", "final", "published"]).optional(),
    is_favorite: z.boolean().optional(),
    source_newsletter_id: z.string().optional(),
    created_after: z.string().optional(),
    created_before: z.string().optional(),
    label: z.string().optional(),
    limit: z.number().optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (params, ctx) => {
    requireAuth(ctx);
    const supabase = supabaseForUser(ctx);
    let q = supabase.from("generated_posts")
      .select("id, title, content, status, goal, tone, language, is_favorite, source_newsletter_id, source_newsletter_item_id, created_at, published_at")
      .order("created_at", { ascending: false })
      .limit(params.limit ?? 50);
    if (params.status) q = q.eq("status", params.status);
    if (params.is_favorite !== undefined) q = q.eq("is_favorite", params.is_favorite);
    if (params.source_newsletter_id) q = q.eq("source_newsletter_id", params.source_newsletter_id);
    if (params.created_after) q = q.gte("created_at", params.created_after);
    if (params.created_before) q = q.lte("created_at", params.created_before);
    const { data, error } = await q;
    if (error) throw error;

    const posts = (data ?? []) as any[];
    if (posts.length === 0) return jsonResult([]);
    const postIds = posts.map((p) => p.id);

    const [{ data: assignments }, { data: publications }, { data: metrics }] = await Promise.all([
      supabase.from("post_label_assignments").select("post_id, label_id, post_labels(id, name, color)").in("post_id", postIds),
      supabase.from("post_label_publications").select("post_id, label_id, published_at").in("post_id", postIds),
      supabase.from("linkedin_post_metrics").select("post_id, source, impressions, clicks, reactions, comments, shares, engagement_rate, posted_at, linkedin_url, imported_at").in("post_id", postIds),
    ]);

    const pubMap = new Map<string, string>();
    for (const p of (publications ?? []) as any[]) pubMap.set(`${p.post_id}|${p.label_id}`, p.published_at);

    const labelsByPost = new Map<string, any[]>();
    for (const a of (assignments ?? []) as any[]) {
      const lbl = a.post_labels;
      if (!lbl) continue;
      const arr = labelsByPost.get(a.post_id) ?? [];
      arr.push({ id: lbl.id, name: lbl.name, color: lbl.color, published_at: pubMap.get(`${a.post_id}|${lbl.id}`) ?? null });
      labelsByPost.set(a.post_id, arr);
    }

    const metricsByPost = new Map<string, any[]>();
    for (const m of (metrics ?? []) as any[]) {
      if (!m.post_id) continue;
      const arr = metricsByPost.get(m.post_id) ?? [];
      const clicks = m.clicks || 0;
      const reactions = m.reactions || 0;
      const comments = m.comments || 0;
      const shares = m.shares || 0;
      const engagements = clicks + reactions + comments + shares;
      const existing = arr.find((x) => x.source === m.source);
      const row = { source: m.source, impressions: m.impressions || 0, clicks, reactions, comments, shares, engagements, engagement_rate: m.engagement_rate || 0, posted_at: m.posted_at, linkedin_url: m.linkedin_url, imported_at: m.imported_at };
      if (!existing) arr.push(row);
      else if (row.impressions > existing.impressions) Object.assign(existing, row);
      metricsByPost.set(m.post_id, arr);
    }

    const performanceByPost = new Map<string, any>();
    for (const [pid, rows] of metricsByPost.entries()) {
      const totals = rows.reduce((acc: any, r: any) => {
        acc.impressions += r.impressions; acc.clicks += r.clicks; acc.reactions += r.reactions;
        acc.comments += r.comments; acc.shares += r.shares; acc.engagements += r.engagements;
        return acc;
      }, { impressions: 0, clicks: 0, reactions: 0, comments: 0, shares: 0, engagements: 0 });
      const engagement_rate = totals.impressions > 0 ? totals.engagements / totals.impressions : 0;
      performanceByPost.set(pid, { ...totals, engagement_rate });
    }

    let enriched = posts.map((p) => ({
      ...p,
      labels: labelsByPost.get(p.id) ?? [],
      metrics: metricsByPost.get(p.id) ?? [],
      performance: performanceByPost.get(p.id) ?? null,
    }));

    if (params.label && typeof params.label === "string") {
      const needle = params.label.toLowerCase();
      enriched = enriched.filter((p) => (p.labels as any[]).some((l) => (l.name ?? "").toLowerCase() === needle));
    }

    return jsonResult(enriched);
  },
});
