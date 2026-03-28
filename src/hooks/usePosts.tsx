import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function usePostsCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["posts-count", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("generated_posts")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });
}
