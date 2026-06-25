import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export interface ScheduledPublication {
  id: string;
  user_id: string;
  post_id: string;
  target: "personal" | "company";
  scheduled_at: string;
  status: "pending" | "publishing" | "done" | "failed" | "cancelled";
  attempts: number;
  error: string | null;
  linkedin_url: string | null;
  created_at: string;
  updated_at: string;
}

export function useScheduledPublications() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["scheduled-publications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_publications" as any)
        .select("*")
        .order("scheduled_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ScheduledPublication[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });
}

export function usePublishLinkedinNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { post_id: string; target?: "personal" | "company" } | string) => {
      const payload =
        typeof args === "string"
          ? { post_id: args, target: "personal" as const }
          : { post_id: args.post_id, target: args.target ?? "personal" };
      const { data, error } = await supabase.functions.invoke("publish-linkedin", {
        body: payload,
      });
      if (error) throw new Error(error.message ?? "Error publicando");
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { ok: true; linkedin_url: string; urn: string };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      qc.invalidateQueries({ queryKey: ["all-post-label-publications"] });
      qc.invalidateQueries({ queryKey: ["post-label-publications"] });
      qc.invalidateQueries({ queryKey: ["all-post-label-assignments"] });
      toast.success("Publicado en LinkedIn", {
        action: data?.linkedin_url
          ? { label: "Ver", onClick: () => window.open(data.linkedin_url, "_blank") }
          : undefined,
      });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al publicar"),
  });
}

export function useSchedulePublication() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (args: { post_id: string; scheduled_at: string; target?: "personal" | "company" }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("scheduled_publications" as any)
        .insert({
          user_id: user.id,
          post_id: args.post_id,
          target: args.target ?? "personal",
          scheduled_at: args.scheduled_at,
        } as any)
        .select("*")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-publications"] });
      toast.success("Publicación programada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al programar"),
  });
}

export function useCancelScheduledPublication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("scheduled_publications" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scheduled-publications"] });
      toast.success("Programación cancelada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Error"),
  });
}
