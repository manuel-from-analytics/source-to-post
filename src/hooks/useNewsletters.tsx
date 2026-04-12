import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface NewsletterItem {
  id: string;
  newsletter_id: string;
  title: string;
  url: string;
  description: string | null;
  source_type: string;
  imported_to_library: boolean;
  input_id: string | null;
  pub_date: string | null;
  created_at: string;
}

export interface Newsletter {
  id: string;
  user_id: string;
  topic: string;
  content: string;
  language: string | null;
  podcast_script: string | null;
  created_at: string;
  items?: NewsletterItem[];
}

export function useNewsletters() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["newsletters", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletters")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Newsletter[];
    },
    enabled: !!user,
  });
}

export function useNewsletterDetail(id: string | null) {
  return useQuery({
    queryKey: ["newsletter-detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data: newsletter, error } = await supabase
        .from("newsletters")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;

      const { data: items } = await supabase
        .from("newsletter_items")
        .select("*")
        .eq("newsletter_id", id)
        .order("created_at", { ascending: true });

      // Check for orphaned imports: imported but input_id is null OR input no longer exists
      const importedItems = (items || []).filter(i => i.imported_to_library);
      if (importedItems.length > 0) {
        // Items marked imported but with no input_id are definitely orphaned
        const noRefIds = importedItems.filter(i => !i.input_id).map(i => i.id);

        // Items with input_id — verify the input still exists
        const withRef = importedItems.filter(i => i.input_id);
        let missingRefIds: string[] = [];
        if (withRef.length > 0) {
          const inputIds = withRef.map(i => i.input_id!);
          const { data: existingInputs } = await supabase
            .from("inputs")
            .select("id")
            .in("id", inputIds);
          const existingIds = new Set((existingInputs || []).map(i => i.id));
          missingRefIds = withRef.filter(i => !existingIds.has(i.input_id!)).map(i => i.id);
        }

        const orphanedIds = [...noRefIds, ...missingRefIds];
        if (orphanedIds.length > 0) {
          await supabase
            .from("newsletter_items")
            .update({ imported_to_library: false, input_id: null })
            .in("id", orphanedIds);
          for (const item of items || []) {
            if (orphanedIds.includes(item.id)) {
              item.imported_to_library = false;
              item.input_id = null;
            }
          }
        }
      }

      return { ...newsletter, items: items || [] } as Newsletter;
    },
    enabled: !!id,
  });
}

export function useSearchTopics() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["newsletter-topics", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletters")
        .select("topic")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      const unique = [...new Set((data || []).map((d: any) => d.topic))];
      return unique as string[];
    },
    enabled: !!user,
  });
}

export function useGenerateNewsletter() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = async (topic: string): Promise<Newsletter | null> => {
    if (!user) return null;
    setIsGenerating(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error("No autenticado");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-newsletter`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ topic }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Error desconocido" }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      const data = await resp.json();
      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
      queryClient.invalidateQueries({ queryKey: ["newsletter-topics"] });
      toast.success("Newsletter generada correctamente");
      return data.newsletter as Newsletter;
    } catch (e: any) {
      toast.error(e.message || "Error al generar la newsletter");
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return { generate, isGenerating };
}

export function useDeleteNewsletter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error: itemsError } = await supabase
        .from("newsletter_items")
        .delete()
        .eq("newsletter_id", id);
      if (itemsError) throw itemsError;

      const { error } = await supabase
        .from("newsletters")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
      queryClient.invalidateQueries({ queryKey: ["newsletter-topics"] });
      queryClient.invalidateQueries({ queryKey: ["newsletter-detail"] });
      toast.success("Newsletter eliminada");
    },
    onError: (error: Error) => {
      toast.error(`Error al eliminar: ${error.message}`);
    },
  });
}

export function useImportToLibrary() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (item: NewsletterItem) => {
      if (!user) throw new Error("No autenticado");

      // Create input in library
      const { data: input, error: inputError } = await supabase
        .from("inputs")
        .insert({
          user_id: user.id,
          title: item.title,
          type: "url" as const,
          original_url: item.url,
          raw_content: item.description,
        })
        .select()
        .single();

      if (inputError) throw inputError;

      // Mark as imported
      const { error: updateError } = await supabase
        .from("newsletter_items")
        .update({ imported_to_library: true, input_id: input.id })
        .eq("id", item.id);

      if (updateError) throw updateError;
      return input;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-detail"] });
      queryClient.invalidateQueries({ queryKey: ["inputs"] });
      queryClient.invalidateQueries({ queryKey: ["inputs-count"] });
      toast.success("Referencia importada a la biblioteca");
    },
    onError: (error: Error) => {
      toast.error(`Error al importar: ${error.message}`);
    },
  });
}
