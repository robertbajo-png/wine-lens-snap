import type { Tables } from "@/integrations/supabase/types";
import creatorsFallback from "@/data/creatorsFallback.json";
import { withTimeoutFallback } from "@/lib/fallback";
import { supabase } from "@/lib/supabaseClient";

export type Creator = Tables<"creators">;
export type CreatorPost = Tables<"creator_posts">;
export type CreatorFeedPost = CreatorPost & { creator: Creator | null };
export type UserFeedState = Tables<"user_feed_state">;

const CREATOR_CACHE_KEY = "following_creators_cache_v1";
const CREATOR_CACHE_TTL_MS = 1000 * 60 * 60 * 24;

const readCachedCreators = (): Creator[] | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CREATOR_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { timestamp: number; creators: Creator[] };
    if (!parsed?.timestamp || !Array.isArray(parsed.creators)) {
      return null;
    }
    if (Date.now() - parsed.timestamp > CREATOR_CACHE_TTL_MS) {
      return null;
    }
    return parsed.creators;
  } catch (error) {
    console.warn("[following] Failed to read cached creators", error);
    return null;
  }
};

const writeCachedCreators = (creators: Creator[]) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const payload = JSON.stringify({ timestamp: Date.now(), creators });
    window.localStorage.setItem(CREATOR_CACHE_KEY, payload);
  } catch (error) {
    console.warn("[following] Failed to persist creators cache", error);
  }
};

export const fetchCreators = async (): Promise<Creator[]> => {
  const cached = readCachedCreators();
  if (cached) {
    return cached;
  }

  const request = async (): Promise<Creator[]> => {
    const { data, error } = await supabase.from("creators").select("*").order("display_name", { ascending: true });
    if (error) {
      throw error;
    }
    return data ?? [];
  };

  const creators = await withTimeoutFallback(request, () => creatorsFallback as Creator[], {
    context: "fetch_creators",
  });

  writeCachedCreators(creators);
  return creators;
};

export const fetchFollowingIds = async (userId: string): Promise<string[]> => {
  const request = async (): Promise<string[]> => {
    const { data, error } = await supabase.from("user_follows").select("creator_id").eq("user_id", userId);
    if (error) {
      throw error;
    }
    return data?.map((row) => row.creator_id) ?? [];
  };

  return withTimeoutFallback(request, () => [], { context: "fetch_following_ids" });
};

export const fetchFollowingFeed = async (creatorIds: string[]): Promise<CreatorFeedPost[]> => {
  if (!creatorIds.length) {
    return [];
  }

  const request = async (): Promise<CreatorFeedPost[]> => {
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

  return withTimeoutFallback(request, () => [], { context: "fetch_following_feed" });
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

  const request = async () => {
    const { data, error } = await supabase
      .from("creator_posts")
      .select("id, created_at")
      .in("creator_id", followingIds)
      .gt("created_at", feedState.last_opened);

    if (error) {
      throw error;
    }

    return data?.length ?? 0;
  };

  const newPostsCount = await withTimeoutFallback(request, () => 0, { context: "fetch_following_feed_meta" });

  return { lastOpened: feedState.last_opened, newPostsCount };
};

export const touchUserFeedState = async (): Promise<UserFeedState> => {
  const { data, error } = await supabase.rpc("touch_user_feed_state");
  if (error) {
    throw error;
  }
  return data as UserFeedState;
};
