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
  manually_unmatched?: boolean | null;
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

      // Fetch posts + per-label publication dates (Personal) so personal metrics
      // are matched against the date the post was actually published as Personal.
      const [{ data: posts }, { data: personalLabel }] = await Promise.all([
        supabase.from("generated_posts").select("id, content, linkedin_url"),
        supabase.from("post_labels").select("id").eq("name", "Personal").maybeSingle(),
      ]);

      let personalPubs: { post_id: string; published_at: string }[] = [];
      if (personalLabel?.id) {
        const { data: pubs } = await supabase
          .from("post_label_publications")
          .select("post_id, published_at")
          .eq("label_id", personalLabel.id);
        personalPubs = (pubs ?? []).filter((p: any) => p.published_at) as any;
      }

      const matcher = buildPostMatcher(
        (posts ?? []).map((p: any) => ({
          id: p.id,
          content: p.content,
          linkedin_url: p.linkedin_url,
        })),
        personalPubs,
        { personalMetrics: rows.filter((r) => r.source === "personal") },
      );

      // Existing metrics for the same source — used to apply the "overwrite only if impressions >= current" rule
      // AND to preserve the manually_unmatched flag set by the user in the UI.
      const { data: existing } = await supabase
        .from("linkedin_post_metrics")
        .select("id, linkedin_urn, linkedin_url, impressions, manually_unmatched, post_id")
        .eq("source", source);

      const existingByUrn = new Map<string, { id: string; impressions: number; manually_unmatched: boolean; post_id: string | null }>();
      const existingByUrl = new Map<string, { id: string; impressions: number; manually_unmatched: boolean; post_id: string | null }>();
      (existing ?? []).forEach((e: any) => {
        const entry = { id: e.id, impressions: e.impressions ?? 0, manually_unmatched: !!e.manually_unmatched, post_id: e.post_id ?? null };
        if (e.linkedin_urn) existingByUrn.set(e.linkedin_urn, entry);
        else if (e.linkedin_url) existingByUrl.set(e.linkedin_url, entry);
      });

      let matched = 0;
      let inserted = 0;
      let overwritten = 0;
      let kept = 0;
      const toInsert: any[] = [];
      const toUpdate: { id: string; row: any }[] = [];

      const urlsToBackfillByPost = new Map<string, string>(); // post_id -> linkedin_url

      for (const r of rows as ParsedMetricRow[]) {
        const prev =
          (r.linkedin_urn ? existingByUrn.get(r.linkedin_urn) : null) ||
          (r.linkedin_url ? existingByUrl.get(r.linkedin_url) : null);

        // If the user previously unlinked this metric, preserve that decision.
        const preserveUnmatched = !!prev?.manually_unmatched;

        let post_id: string | null = null;
        if (preserveUnmatched) {
          post_id = null;
        } else if (prev?.post_id) {
          // Trust prior manual link.
          post_id = prev.post_id;
        } else {
          post_id = matcher({
            source: r.source,
            linkedin_url: r.linkedin_url,
            post_title: r.post_title,
            post_excerpt: r.post_excerpt,
            posted_at: r.posted_at,
          });
        }
        if (post_id) {
          matched++;
          // Remember to write linkedin_url back onto the post so the URL becomes the shared key.
          if (r.linkedin_url) urlsToBackfillByPost.set(post_id, r.linkedin_url);
        }

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
          manually_unmatched: preserveUnmatched,
        };

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

      // Backfill linkedin_url onto matched posts (only when the post has no URL yet),
      // so the URL becomes the durable common key across future imports / publications.
      if (urlsToBackfillByPost.size > 0) {
        const postIds = Array.from(urlsToBackfillByPost.keys());
        const { data: postRows } = await supabase
          .from("generated_posts")
          .select("id, linkedin_url")
          .in("id", postIds);
        const updates = (postRows ?? [])
          .filter((p: any) => !p.linkedin_url)
          .map((p: any) => ({ id: p.id, url: urlsToBackfillByPost.get(p.id)! }))
          .filter((u) => u.url);
        await Promise.all(
          updates.map((u) =>
            supabase.from("generated_posts").update({ linkedin_url: u.url }).eq("id", u.id),
          ),
        );
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
