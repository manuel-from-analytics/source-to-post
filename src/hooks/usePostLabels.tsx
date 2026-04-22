import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface PostLabel {
  id: string;
  name: string;
  color: string | null;
  user_id: string;
  created_at: string;
}

export function usePostLabels() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["post-labels", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_labels")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as PostLabel[];
    },
    enabled: !!user,
  });
}

export function usePostLabelAssignments(postId: string | undefined) {
  return useQuery({
    queryKey: ["post-label-assignments", postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_label_assignments")
        .select("label_id")
        .eq("post_id", postId!);
      if (error) throw error;
      return data.map((d: any) => d.label_id as string);
    },
    enabled: !!postId,
  });
}

export function useCreatePostLabel() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const { data, error } = await supabase
        .from("post_labels")
        .insert({ name, color, user_id: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as PostLabel;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["post-labels"] }),
  });
}

export function useTogglePostLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, labelId, assigned }: { postId: string; labelId: string; assigned: boolean }) => {
      if (assigned) {
        const { error } = await supabase
          .from("post_label_assignments")
          .delete()
          .eq("post_id", postId)
          .eq("label_id", labelId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("post_label_assignments")
          .insert({ post_id: postId, label_id: labelId } as any);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["post-label-assignments", vars.postId] });
      qc.invalidateQueries({ queryKey: ["all-post-label-assignments"] });
    },
  });
}

/** Bulk fetch all assignments for listing pages */
export function useAllPostLabelAssignments() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["all-post-label-assignments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_label_assignments")
        .select("post_id, label_id");
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const row of data as any[]) {
        if (!map[row.post_id]) map[row.post_id] = [];
        map[row.post_id].push(row.label_id);
      }
      return map;
    },
    enabled: !!user,
  });
}

/* ============================================================
 * Per-label publication tracking
 * ============================================================ */

export interface PostLabelPublication {
  post_id: string;
  label_id: string;
  published_at: string;
}

/** Per-post: list of (label_id, published_at) for that post */
export function usePostLabelPublications(postId: string | undefined) {
  return useQuery({
    queryKey: ["post-label-publications", postId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("post_label_publications")
        .select("post_id, label_id, published_at")
        .eq("post_id", postId!);
      if (error) throw error;
      return data as PostLabelPublication[];
    },
    enabled: !!postId,
  });
}

/** Bulk fetch for listing pages */
export function useAllPostLabelPublications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["all-post-label-publications", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("post_label_publications")
        .select("post_id, label_id, published_at");
      if (error) throw error;
      const map: Record<string, PostLabelPublication[]> = {};
      for (const row of data as PostLabelPublication[]) {
        if (!map[row.post_id]) map[row.post_id] = [];
        map[row.post_id].push(row);
      }
      return map;
    },
    enabled: !!user,
  });
}

/** Recompute the global status & published_at of a post based on its per-label publications. */
async function syncPostGlobalStatus(postId: string) {
  const { data: pubs, error } = await (supabase as any)
    .from("post_label_publications")
    .select("published_at")
    .eq("post_id", postId);
  if (error) throw error;

  if (!pubs || pubs.length === 0) {
    // No publications left → demote to "final"
    await supabase
      .from("generated_posts")
      .update({ status: "final", published_at: null } as any)
      .eq("id", postId);
  } else {
    // At least one publication → promote to "published" with earliest date
    const earliest = (pubs as { published_at: string }[])
      .map((p) => p.published_at)
      .sort()[0];
    await supabase
      .from("generated_posts")
      .update({ status: "published", published_at: earliest } as any)
      .eq("id", postId);
  }
}

export function usePublishToLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, labelId }: { postId: string; labelId: string }) => {
      const { error } = await (supabase as any)
        .from("post_label_publications")
        .insert({ post_id: postId, label_id: labelId } as any);
      if (error) throw error;
      await syncPostGlobalStatus(postId);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["post-label-publications", vars.postId] });
      qc.invalidateQueries({ queryKey: ["all-post-label-publications"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}

export function useUnpublishFromLabel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, labelId }: { postId: string; labelId: string }) => {
      const { error } = await (supabase as any)
        .from("post_label_publications")
        .delete()
        .eq("post_id", postId)
        .eq("label_id", labelId);
      if (error) throw error;
      await syncPostGlobalStatus(postId);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["post-label-publications", vars.postId] });
      qc.invalidateQueries({ queryKey: ["all-post-label-publications"] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });
}
