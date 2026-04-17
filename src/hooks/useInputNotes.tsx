import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

export interface InputNote {
  id: string;
  input_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export function useInputNotes(inputId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["input-notes", inputId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("input_notes")
        .select("*")
        .eq("input_id", inputId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as InputNote[];
    },
    enabled: !!user && !!inputId,
  });
}

export function useCreateInputNote() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  return useMutation({
    mutationFn: async ({ input_id, content }: { input_id: string; content: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("input_notes")
        .insert({ input_id, content, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["input-notes", data.input_id] });
      toast.success(t("inputNotes.added"));
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateInputNote() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  return useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const { data, error } = await supabase
        .from("input_notes")
        .update({ content })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["input-notes", data.input_id] });
      toast.success(t("inputNotes.updated"));
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useDeleteInputNote() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  return useMutation({
    mutationFn: async ({ id, input_id }: { id: string; input_id: string }) => {
      const { error } = await supabase.from("input_notes").delete().eq("id", id);
      if (error) throw error;
      return { input_id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["input-notes", data.input_id] });
      toast.success(t("inputNotes.deleted"));
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
