import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

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

      const importedItems = (items || []).filter(i => i.imported_to_library);
      if (importedItems.length > 0) {
        const noRefIds = importedItems.filter(i => !i.input_id).map(i => i.id);
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
  const { t } = useLanguage();
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = async (topic: string, profileId?: string | null): Promise<Newsletter | null> => {
    if (!user) return null;
    setIsGenerating(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) throw new Error(t("toast.notAuthenticated"));

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-newsletter`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ topic, profile_id: profileId ?? null }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: t("toast.unknownError") }));
        throw new Error(err.error || `Error ${resp.status}`);
      }

      const data = await resp.json();
      queryClient.invalidateQueries({ queryKey: ["newsletters"] });
      queryClient.invalidateQueries({ queryKey: ["newsletter-topics"] });
      toast.success(t("toast.newsletterGenerated"));
      return data.newsletter as Newsletter;
    } catch (e: any) {
      toast.error(e.message || t("toast.newsletterGenerateError"));
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  return { generate, isGenerating };
}

export function useNewsletterPreferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  const query = useQuery({
    queryKey: ["newsletter-preferences", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("newsletter_preferences, newsletter_preferences_enabled")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return {
        preferences: (data as any)?.newsletter_preferences ?? "",
        enabled: (data as any)?.newsletter_preferences_enabled ?? true,
      };
    },
    enabled: !!user,
  });

  const update = useMutation({
    mutationFn: async (input: { preferences?: string; enabled?: boolean }) => {
      if (!user) throw new Error(t("toast.notAuthenticated"));
      const payload: Record<string, any> = {};
      if (input.preferences !== undefined) payload.newsletter_preferences = input.preferences;
      if (input.enabled !== undefined) payload.newsletter_preferences_enabled = input.enabled;
      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-preferences"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  return { ...query, update };
}

export interface NewsletterPreferenceProfile {
  id: string;
  user_id: string;
  name: string;
  preferences: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useNewsletterProfiles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["newsletter-preference-profiles", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("newsletter_preference_profiles")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as NewsletterPreferenceProfile[];
    },
    enabled: !!user,
  });
}

export function useCreateNewsletterProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: async (input: { name: string; preferences: string }) => {
      if (!user) throw new Error(t("toast.notAuthenticated"));
      const { data, error } = await supabase
        .from("newsletter_preference_profiles")
        .insert({ user_id: user.id, name: input.name, preferences: input.preferences })
        .select()
        .single();
      if (error) throw error;
      return data as NewsletterPreferenceProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-preference-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateNewsletterProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; preferences?: string }) => {
      const payload: Record<string, any> = {};
      if (input.name !== undefined) payload.name = input.name;
      if (input.preferences !== undefined) payload.preferences = input.preferences;
      const { error } = await supabase
        .from("newsletter_preference_profiles")
        .update(payload)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-preference-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteNewsletterProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("newsletter_preference_profiles")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-preference-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useSetDefaultNewsletterProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error(t("toast.notAuthenticated"));
      // Unset all then set one
      const { error: e1 } = await supabase
        .from("newsletter_preference_profiles")
        .update({ is_default: false })
        .eq("user_id", user.id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("newsletter_preference_profiles")
        .update({ is_default: true })
        .eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-preference-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteNewsletter() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();

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
      toast.success(t("toast.newsletterDeleted"));
    },
    onError: (error: Error) => {
      toast.error(`${t("toast.newsletterDeleteError")}: ${error.message}`);
    },
  });
}

export function useImportToLibrary() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLanguage();

  return useMutation({
    mutationFn: async (item: NewsletterItem) => {
      if (!user) throw new Error(t("toast.notAuthenticated"));

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

      const { error: updateError } = await supabase
        .from("newsletter_items")
        .update({ imported_to_library: true, input_id: input.id })
        .eq("id", item.id);

      if (updateError) throw updateError;
      return input;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["newsletter-detail"] });
      queryClient.invalidateQueries({ queryKey: ["inputs"] });
      queryClient.invalidateQueries({ queryKey: ["inputs-count"] });
      toast.success(t("toast.importedToLibrary"));

      if (data.original_url) {
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
            toast.success(t("toast.autoExtracted"));
          }
        });
      }
    },
    onError: (error: Error) => {
      toast.error(`${t("toast.importError")}: ${error.message}`);
    },
  });
}
