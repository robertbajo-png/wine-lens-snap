import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/lib/supabaseClient";

export type Creator = Tables<"creators">;
export type CreatorPost = Tables<"creator_posts">;
export type CreatorFeedPost = CreatorPost & { creator: Creator | null };
export type UserFeedState = Tables<"user_feed_state">;

export const fetchCreators = async (): Promise<Creator[]> => {
  const { data, error } = await supabase.from("creators").select("*").order("display_name", { ascending: true });
  if (error) {
    throw error;
  }
  return data ?? [];
};

export const fetchFollowingIds = async (userId: string): Promise<string[]> => {
  const { data, error } = await supabase.from("user_follows").select("creator_id").eq("user_id", userId);
  if (error) {
    throw error;
  }
  return data?.map((row) => row.creator_id) ?? [];
};

export const fetchFollowingFeed = async (creatorIds: string[]): Promise<CreatorFeedPost[]> => {
  if (!creatorIds.length) {
    return [];
  }

  const { data, error } = await supabase
    .from("creator_posts")
    .select("*, creator:creators!creator_posts_creator_id_fkey(*)")
    .in("creator_id", creatorIds)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    throw error;
  }

  return (data as CreatorFeedPost[] | null) ?? [];
};

export const fetchUserFeedState = async (userId: string): Promise<UserFeedState | null> => {
  const { data, error } = await supabase.from("user_feed_state").select("*").eq("user_id", userId).maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
};

export const fetchFollowingFeedMeta = async (
  userId: string,
): Promise<{ lastOpened: string | null; newPostsCount: number }> => {
  const [followingIds, feedState] = await Promise.all([fetchFollowingIds(userId), fetchUserFeedState(userId)]);

  if (!feedState) {
    return { lastOpened: null, newPostsCount: 0 };
  }

  if (!followingIds.length) {
    return { lastOpened: feedState.last_opened, newPostsCount: 0 };
  }

  const { data, error } = await supabase
    .from("creator_posts")
    .select("id, created_at")
    .in("creator_id", followingIds)
    .gt("created_at", feedState.last_opened);

  if (error) {
    throw error;
  }

  return { lastOpened: feedState.last_opened, newPostsCount: data?.length ?? 0 };
};

export const touchUserFeedState = async (): Promise<UserFeedState> => {
  const { data, error } = await supabase.rpc("touch_user_feed_state");
  if (error) {
    throw error;
  }
  return data as UserFeedState;
};
