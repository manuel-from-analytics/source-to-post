import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { parseLinkedInCsv, normalizeContent, type LinkedInSource, type ParsedMetricRow } from "@/lib/linkedin-csv";

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

      // Fetch posts for matching
      const { data: posts } = await supabase
        .from("generated_posts")
        .select("id, content, linkedin_url");

      const byUrl = new Map<string, string>();
      const byNorm = new Map<string, string>();
      (posts ?? []).forEach((p: any) => {
        if (p.linkedin_url) byUrl.set(p.linkedin_url, p.id);
        if (p.content) byNorm.set(normalizeContent(p.content), p.id);
      });

      let matched = 0;
      const payload = rows.map((r: ParsedMetricRow) => {
        let post_id: string | null = null;
        if (r.linkedin_url && byUrl.has(r.linkedin_url)) post_id = byUrl.get(r.linkedin_url)!;
        else if (r.post_excerpt) {
          const key = normalizeContent(r.post_excerpt);
          if (key && byNorm.has(key)) post_id = byNorm.get(key)!;
        }
        if (post_id) matched++;
        return {
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
      });

      // Upsert in chunks. Use urn-based conflict if available; otherwise plain insert.
      const withUrn = payload.filter((p) => p.linkedin_urn);
      const withoutUrn = payload.filter((p) => !p.linkedin_urn);

      if (withUrn.length) {
        const { error } = await supabase
          .from("linkedin_post_metrics")
          .upsert(withUrn as any, { onConflict: "user_id,source,linkedin_urn" });
        if (error) throw error;
      }
      if (withoutUrn.length) {
        // fall back to URL-based dedup: delete existing same-url rows then insert.
        const urls = withoutUrn.map((p) => p.linkedin_url).filter(Boolean) as string[];
        if (urls.length) {
          await supabase
            .from("linkedin_post_metrics")
            .delete()
            .eq("source", withoutUrn[0].source)
            .in("linkedin_url", urls);
        }
        const { error } = await supabase.from("linkedin_post_metrics").insert(withoutUrn as any);
        if (error) throw error;
      }

      return { total: rows.length, matched };
    },
    onSuccess: ({ total, matched }) => {
      qc.invalidateQueries({ queryKey: ["linkedin-metrics"] });
      toast.success(`Importadas ${total} filas (${matched} cruzadas con posts)`);
    },
    onError: (e: any) => toast.error(e?.message ?? "Error importando CSV"),
  });
}
