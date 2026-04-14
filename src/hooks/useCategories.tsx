import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

export interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

export function useCategories() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as CategoryRow[];
    },
    enabled: !!user,
  });
}

export function useCreateCategory() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color?: string }) => {
      if (!user) throw new Error(t("toast.notAuthenticated"));
      const { data, error } = await supabase
        .from("categories")
        .insert({ user_id: user.id, name, color: color || null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(t("toast.categoryCreated"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success(t("toast.categoryDeleted"));
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useAssignCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ inputId, categoryId }: { inputId: string; categoryId: string | null }) => {
      const { error } = await supabase
        .from("inputs")
        .update({ category_id: categoryId })
        .eq("id", inputId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inputs"] });
      queryClient.invalidateQueries({ queryKey: ["input-detail"] });
    },
  });
}
