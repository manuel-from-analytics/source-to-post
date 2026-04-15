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
