import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Database } from "@/integrations/supabase/types";

type PostStatus = Database["public"]["Enums"]["post_status"];

export function usePostsCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["posts-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("generated_posts")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });
}

export function usePosts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["posts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_posts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useUpdatePostStatus() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PostStatus }) => {
      const { error } = await supabase
        .from("generated_posts")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["posts-count"] });
    },
    onError: () => toast.error(t("toast.postStatusError")),
  });
}

export function useUpdatePost() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: async (params: {
      id: string;
      content: string;
      title?: string;
      goal?: string;
      tone?: string;
      target_audience?: string;
      language?: string;
      cta?: string;
      length?: string;
      content_focus?: string;
      voice_id?: string;
      input_ids?: string[];
    }) => {
      const { id, ...rest } = params;
      const { error } = await supabase
        .from("generated_posts")
        .update({
          ...rest,
          voice_id: rest.voice_id || null,
          input_id: rest.input_ids?.[0] || null,
          input_ids: rest.input_ids || [],
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success(t("toast.postUpdated"));
    },
    onError: () => toast.error(t("toast.postUpdateError")),
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("generated_posts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["posts-count"] });
      toast.success(t("toast.postDeleted"));
    },
    onError: () => toast.error(t("toast.postDeleteError")),
  });
}
