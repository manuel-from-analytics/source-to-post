import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

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
  return useMutation({
    mutationFn: async ({ title, content, voice_id }: { title?: string; content: string; voice_id: string }) => {
      if (!user) throw new Error("No autenticado");
      const { error } = await supabase.from("voice_samples").insert({
        user_id: user.id,
        voice_id,
        title: title || null,
        content,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ejemplo de voz guardado");
      queryClient.invalidateQueries({ queryKey: ["voice-samples"] });
    },
    onError: () => toast.error("Error al guardar el ejemplo"),
  });
}

export function useDeleteVoiceSample() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("voice_samples").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ejemplo eliminado");
      queryClient.invalidateQueries({ queryKey: ["voice-samples"] });
    },
    onError: () => toast.error("Error al eliminar"),
  });
}
