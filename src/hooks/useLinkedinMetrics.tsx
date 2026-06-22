import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { parseLinkedInCsv, type LinkedInSource, type ParsedMetricRow } from "@/lib/linkedin-csv";
import { buildPostMatcher } from "@/lib/match-posts";

export interface LinkedinMetric {
  id: string;
  user_id: string;
  post_id: string | null;
  source: LinkedInSource;
  linkedin_url: string | null;
  linkedin_urn: string | null;
  post_title: string | null;
  post_excerpt: string | null;
  posted_at: string | null;
  impressions: number;
  clicks: number;
  reactions: number;
  comments: number;
  shares: number;
  engagement_rate: number;
  imported_at: string;
}

export function useLinkedinMetrics() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["linkedin-metrics", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("linkedin_post_metrics")
        .select("*")
        .order("posted_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as LinkedinMetric[];
    },
    enabled: !!user,
  });
}

export function useDeleteLinkedinMetric() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("linkedin_post_metrics").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["linkedin-metrics"] }),
  });
}

export function useImportLinkedinCsv() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ file, source, sheetName }: { file: File; source: LinkedInSource; sheetName?: string }) => {
      if (!user) throw new Error("Not authenticated");

      const rows = await parseLinkedInCsv(file, source, sheetName);
      if (rows.length === 0) throw new Error("No se detectaron filas con métricas en este fichero");

      const { data: posts } = await supabase
        .from("generated_posts")
        .select("id, content, linkedin_url");

      const byUrl = new Map<string, string>();
      const byNorm = new Map<string, string>();
      (posts ?? []).forEach((p: any) => {
        if (p.linkedin_url) byUrl.set(p.linkedin_url, p.id);
        if (p.content) byNorm.set(normalizeContent(p.content), p.id);
      });

      // Existing metrics for the same source — used to apply the "overwrite only if impressions >= current" rule.
      const { data: existing } = await supabase
        .from("linkedin_post_metrics")
        .select("id, linkedin_urn, linkedin_url, impressions")
        .eq("source", source);

      const existingByUrn = new Map<string, { id: string; impressions: number }>();
      const existingByUrl = new Map<string, { id: string; impressions: number }>();
      (existing ?? []).forEach((e: any) => {
        const entry = { id: e.id, impressions: e.impressions ?? 0 };
        if (e.linkedin_urn) existingByUrn.set(e.linkedin_urn, entry);
        else if (e.linkedin_url) existingByUrl.set(e.linkedin_url, entry);
      });

      let matched = 0;
      let inserted = 0;
      let overwritten = 0;
      let kept = 0;
      const toInsert: any[] = [];
      const toUpdate: { id: string; row: any }[] = [];

      for (const r of rows as ParsedMetricRow[]) {
        let post_id: string | null = null;
        if (r.linkedin_url && byUrl.has(r.linkedin_url)) post_id = byUrl.get(r.linkedin_url)!;
        else if (r.post_excerpt) {
          const key = normalizeContent(r.post_excerpt);
          if (key && byNorm.has(key)) post_id = byNorm.get(key)!;
        }
        if (post_id) matched++;

        const newRow = {
          user_id: user.id,
          post_id,
          source: r.source,
          linkedin_url: r.linkedin_url,
          linkedin_urn: r.linkedin_urn,
          post_title: r.post_title,
          post_excerpt: r.post_excerpt,
          posted_at: r.posted_at,
          impressions: Math.round(r.impressions),
          clicks: Math.round(r.clicks),
          reactions: Math.round(r.reactions),
          comments: Math.round(r.comments),
          shares: Math.round(r.shares),
          engagement_rate: r.engagement_rate,
          raw: r.raw,
        };

        const prev =
          (r.linkedin_urn ? existingByUrn.get(r.linkedin_urn) : null) ||
          (r.linkedin_url ? existingByUrl.get(r.linkedin_url) : null);

        if (!prev) {
          toInsert.push(newRow);
          inserted++;
        } else if (newRow.impressions >= prev.impressions) {
          toUpdate.push({ id: prev.id, row: newRow });
          overwritten++;
        } else {
          kept++;
        }
      }

      const CHUNK = 500;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const { error } = await supabase
          .from("linkedin_post_metrics")
          .insert(toInsert.slice(i, i + CHUNK) as any);
        if (error) throw error;
      }
      for (const u of toUpdate) {
        const { error } = await supabase.from("linkedin_post_metrics").update(u.row as any).eq("id", u.id);
        if (error) throw error;
      }

      return { total: rows.length, matched, inserted, overwritten, kept };
    },
    onSuccess: ({ total, matched, inserted, overwritten, kept }) => {
      qc.invalidateQueries({ queryKey: ["linkedin-metrics"] });
      toast.success(
        `Importadas ${total} filas · ${inserted} nuevas, ${overwritten} actualizadas, ${kept} sin cambios (datos menores) · ${matched} cruzadas con posts`,
      );
    },
    onError: (e: any) => toast.error(e?.message ?? "Error importando el fichero"),
  });
}
