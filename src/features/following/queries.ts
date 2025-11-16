import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/lib/supabaseClient";

export type Creator = Tables<"creators">;

export const creatorsQueryKey = ["following", "creators"] as const;

export const fetchCreators = async (): Promise<Creator[]> => {
  const { data, error } = await supabase
    .from("creators")
    .select("*")
    .order("display_name", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const followingQueryKey = (userId: string | null) =>
  ["following", "relationships", userId ?? "guest"] as const;

export const fetchFollowingIds = async (userId: string): Promise<string[]> => {
  const { data, error } = await supabase.from("user_follows").select("creator_id").eq("user_id", userId);

  if (error) {
    throw error;
  }

  return data?.map((row) => row.creator_id) ?? [];
};
