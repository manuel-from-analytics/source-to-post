import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

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
  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description?: string }) => {
      if (!user) throw new Error("No autenticado");
      const { data, error } = await supabase
        .from("voices")
        .insert({ user_id: user.id, name, description: description || null } as any)
        .select()
        .single();
      if (error) throw error;
      return data as Voice;
    },
    onSuccess: () => {
      toast.success("Voz creada");
      queryClient.invalidateQueries({ queryKey: ["voices"] });
    },
    onError: () => toast.error("Error al crear la voz"),
  });
}

export function useDeleteVoice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("voices").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Voz eliminada");
      queryClient.invalidateQueries({ queryKey: ["voices"] });
      queryClient.invalidateQueries({ queryKey: ["voice-samples"] });
    },
    onError: () => toast.error("Error al eliminar la voz"),
  });
}
