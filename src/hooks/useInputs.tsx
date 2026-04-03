import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type InputType = "pdf" | "url" | "youtube" | "text";

export interface InputRow {
  id: string;
  user_id: string;
  title: string;
  type: InputType;
  original_url: string | null;
  file_path: string | null;
  raw_content: string | null;
  extracted_content: string | null;
  summary: string | null;
  category_id: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export function useInputs() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["inputs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inputs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as InputRow[];
    },
    enabled: !!user,
  });
}

export function useInputsCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["inputs-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("inputs")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });
}

interface CreateInputParams {
  title: string;
  type: InputType;
  original_url?: string;
  raw_content?: string;
  file?: File;
}

export function useCreateInput() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateInputParams) => {
      if (!user) throw new Error("No autenticado");

      let file_path: string | null = null;

      // Upload PDF if provided
      if (params.file && params.type === "pdf") {
        const ext = params.file.name.split(".").pop();
        const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("inputs")
          .upload(filePath, params.file, { contentType: params.file.type });
        if (uploadError) throw uploadError;
        file_path = filePath;
      }

      const { data, error } = await supabase
        .from("inputs")
        .insert({
          user_id: user.id,
          title: params.title,
          type: params.type,
          original_url: params.original_url || null,
          raw_content: params.raw_content || null,
          file_path,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["inputs"] });
      queryClient.invalidateQueries({ queryKey: ["inputs-count"] });
      toast.success("Fuente guardada correctamente");

      // Auto-extract PDF text in background
      if (data.type === "pdf" && data.file_path) {
        supabase.functions.invoke("extract-pdf", {
          body: { input_id: data.id },
        }).then(({ error }) => {
          if (error) {
            console.error("PDF extraction error:", error);
          } else {
            queryClient.invalidateQueries({ queryKey: ["inputs"] });
            queryClient.invalidateQueries({ queryKey: ["input-detail", data.id] });
            toast.success("Texto del PDF extraído correctamente");
          }
        });
      }
    },
    onError: (error: Error) => {
      toast.error(`Error al guardar: ${error.message}`);
    },
  });
}

export function useDeleteInput() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InputRow) => {
      // Delete file from storage if exists
      if (input.file_path) {
        await supabase.storage.from("inputs").remove([input.file_path]);
      }
      const { error } = await supabase.from("inputs").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inputs"] });
      queryClient.invalidateQueries({ queryKey: ["inputs-count"] });
      toast.success("Fuente eliminada");
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar: ${error.message}`);
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_favorite }: { id: string; is_favorite: boolean }) => {
      const { error } = await supabase
        .from("inputs")
        .update({ is_favorite })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inputs"] });
    },
  });
}
