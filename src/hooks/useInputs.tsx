import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { extractTextFromPdfFile } from "@/lib/pdf";

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
  const { t } = useLanguage();

  return useMutation({
    mutationFn: async (params: CreateInputParams) => {
      if (!user) throw new Error(t("toast.notAuthenticated"));

      let file_path: string | null = null;
      let extracted_content: string | null = null;

      if (params.file && params.type === "pdf") {
        try {
          extracted_content = await extractTextFromPdfFile(params.file);
        } catch (error) {
          console.error("Client PDF extraction failed:", error);
        }

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
          extracted_content,
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
      toast.success(t("toast.sourceSaved"));

      if (data.type === "pdf" && data.file_path && !data.extracted_content) {
        supabase.functions.invoke("extract-pdf", {
          body: { input_id: data.id },
        }).then(({ error }) => {
          if (error) {
            console.error("PDF extraction error:", error);
          } else {
            queryClient.invalidateQueries({ queryKey: ["inputs"] });
            queryClient.invalidateQueries({ queryKey: ["input-detail", data.id] });
            toast.success(t("toast.pdfExtracted"));
          }
        });
      }

      if ((data.type === "url" || data.type === "youtube") && data.original_url && !data.extracted_content) {
        supabase.functions.invoke("extract-url", {
          body: { input_id: data.id },
        }).then(({ data: result, error }) => {
          if (error) {
            console.error("URL extraction error:", error);
          } else if (result?.error) {
            console.error("URL extraction failed:", result.error);
          } else {
            queryClient.invalidateQueries({ queryKey: ["inputs"] });
            queryClient.invalidateQueries({ queryKey: ["input-detail", data.id] });
            toast.success(t("toast.urlExtracted"));
          }
        });
      }
    },
    onError: (error: Error) => {
      toast.error(`${t("toast.sourceSaveError")}: ${error.message}`);
    },
  });
}

export function useDeleteInput() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  return useMutation({
    mutationFn: async (input: InputRow) => {
      const { error: newsletterError } = await supabase
        .from("newsletter_items")
        .update({ imported_to_library: false, input_id: null })
        .eq("input_id", input.id);
      if (newsletterError) throw newsletterError;

      if (input.file_path) {
        await supabase.storage.from("inputs").remove([input.file_path]);
      }

      const { error } = await supabase.from("inputs").delete().eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inputs"] });
      queryClient.invalidateQueries({ queryKey: ["inputs-count"] });
      queryClient.invalidateQueries({ queryKey: ["newsletter-detail"] });
      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
      toast.success(t("toast.sourceDeleted"));
    },
    onError: (error: Error) => {
      toast.error(`${t("toast.sourceDeleteError")}: ${error.message}`);
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
