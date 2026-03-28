import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface VoiceSample {
  id: string;
  user_id: string;
  title: string | null;
  content: string;
  created_at: string;
}

export function useVoiceSamples() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["voice-samples", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("voice_samples" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as VoiceSample[];
    },
    enabled: !!user,
  });

  return query;
}

export function useAddVoiceSample() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ title, content }: { title?: string; content: string }) => {
      if (!user) throw new Error("No autenticado");
      const { error } = await supabase.from("voice_samples" as any).insert({
        user_id: user.id,
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
      const { error } = await supabase.from("voice_samples" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ejemplo eliminado");
      queryClient.invalidateQueries({ queryKey: ["voice-samples"] });
    },
    onError: () => toast.error("Error al eliminar"),
  });
}
