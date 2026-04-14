import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

export interface VoiceSample {
  id: string;
  user_id: string;
  voice_id: string;
  title: string | null;
  content: string;
  created_at: string;
}

export function useVoiceSamples(voiceId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["voice-samples", user?.id, voiceId],
    queryFn: async () => {
      let query = supabase
        .from("voice_samples")
        .select("*")
        .order("created_at", { ascending: false });
      if (voiceId) query = query.eq("voice_id", voiceId);
      const { data, error } = await query;
      if (error) throw error;
      return data as VoiceSample[];
    },
    enabled: !!user,
  });
}

export function useAddVoiceSample() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: async ({ title, content, voice_id }: { title?: string; content: string; voice_id: string }) => {
      if (!user) throw new Error(t("toast.notAuthenticated"));
      const { error } = await supabase.from("voice_samples").insert({
        user_id: user.id,
        voice_id,
        title: title || null,
        content,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("toast.sampleSaved"));
      queryClient.invalidateQueries({ queryKey: ["voice-samples"] });
    },
    onError: () => toast.error(t("toast.sampleSaveError")),
  });
}

export function useDeleteVoiceSample() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("voice_samples").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("toast.sampleDeleted"));
      queryClient.invalidateQueries({ queryKey: ["voice-samples"] });
    },
    onError: () => toast.error(t("toast.sampleDeleteError")),
  });
}
