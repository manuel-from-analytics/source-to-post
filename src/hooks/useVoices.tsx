import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

export interface Voice {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export function useVoices() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["voices", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voices")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Voice[];
    },
    enabled: !!user,
  });
}

export function useAddVoice() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      if (!user) throw new Error(t("toast.notAuthenticated"));
      const { data, error } = await supabase
        .from("voices")
        .insert({ user_id: user.id, name, description: description || null } as any)
        .select()
        .single();
      if (error) throw error;
      return data as Voice;
    },
    onSuccess: () => {
      toast.success(t("toast.voiceCreated"));
      queryClient.invalidateQueries({ queryKey: ["voices"] });
    },
    onError: () => toast.error(t("toast.voiceCreateError")),
  });
}

export function useDeleteVoice() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("voices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("toast.voiceDeleted"));
      queryClient.invalidateQueries({ queryKey: ["voices"] });
      queryClient.invalidateQueries({ queryKey: ["voice-samples"] });
    },
    onError: () => toast.error(t("toast.voiceDeleteError")),
  });
}
