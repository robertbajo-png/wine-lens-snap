import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { fetchFollowingIds, followingQueryKey } from "@/features/following/queries";

const CLEAR_BADGE_DELAY_MS = 3200;

const feedStateQueryKey = (userId: string | null) =>
  ["following", "feed-state", userId ?? "guest"] as const;

const newPostsCountQueryKey = (userId: string | null, followingKey: string, lastOpened: string | null) =>
  ["following", "feed-state", "new-posts-count", userId ?? "guest", followingKey || "none", lastOpened ?? "never"] as const;

const fetchUserFeedState = async (userId: string): Promise<string | null> => {
  const { data, error, status } = await supabase
    .from("user_feed_state")
    .select("last_opened")
    .eq("user_id", userId)
    .maybeSingle();

  if (error && status !== 406) {
    throw error;
  }

  return data?.last_opened ?? null;
};

const fetchNewPostsCount = async (followingIds: string[], lastOpened: string): Promise<number> => {
  if (!lastOpened || followingIds.length === 0) {
    return 0;
  }

  const { count, error } = await supabase
    .from("creator_posts")
    .select("id", { count: "exact", head: true })
    .in("creator_id", followingIds)
    .gt("created_at", lastOpened);

  if (error) {
    throw error;
  }

  return count ?? 0;
};

export const useFollowingFeedNotifications = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const delayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newPostsKeyRef = useRef<ReturnType<typeof newPostsCountQueryKey> | null>(null);
  const followingKeyRef = useRef<string>("");

  const feedStateQuery = useQuery({
    queryKey: feedStateQueryKey(userId),
    queryFn: () => fetchUserFeedState(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
  });

  const followingQuery = useQuery({
    queryKey: followingQueryKey(userId ?? null),
    queryFn: () => fetchFollowingIds(userId!),
    enabled: Boolean(userId),
    staleTime: 2 * 60 * 1000,
  });

  const normalizedFollowingIds = useMemo(() => {
    if (!followingQuery.data) {
      return [] as string[];
    }
    return [...followingQuery.data].sort();
  }, [followingQuery.data]);

  const followingKey = normalizedFollowingIds.join(",");
  followingKeyRef.current = followingKey;

  const lastOpened = feedStateQuery.data ?? null;

  const currentNewPostsKey = newPostsCountQueryKey(userId, followingKey, lastOpened);
  newPostsKeyRef.current = currentNewPostsKey;

  const newPostsQuery = useQuery({
    queryKey: currentNewPostsKey,
    queryFn: () => fetchNewPostsCount(normalizedFollowingIds, lastOpened!),
    enabled: Boolean(userId && lastOpened && normalizedFollowingIds.length > 0),
    staleTime: 30 * 1000,
    placeholderData: 0,
  });

  const markFeedAsOpenedMutation = useMutation({
    mutationFn: async () => {
      if (!userId) {
        return null;
      }
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("user_feed_state")
        .upsert(
          { user_id: userId, last_opened: nowIso },
          { onConflict: "user_id" },
        )
        .select("last_opened")
        .single();

      if (error) {
        throw error;
      }

      return data.last_opened;
    },
    onSuccess: (newLastOpened) => {
      if (!userId || !newLastOpened) {
        return;
      }
      const previousKey = newPostsKeyRef.current;
      const previousCount = previousKey ? (queryClient.getQueryData<number>(previousKey) ?? 0) : 0;
      queryClient.setQueryData(feedStateQueryKey(userId), newLastOpened);
      const nextKey = newPostsCountQueryKey(userId, followingKeyRef.current, newLastOpened);
      queryClient.setQueryData(nextKey, previousCount);
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
      }
      delayTimeoutRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: nextKey });
        delayTimeoutRef.current = null;
      }, CLEAR_BADGE_DELAY_MS);
    },
    onError: () => {
      if (!userId) {
        return;
      }
      queryClient.invalidateQueries({ queryKey: feedStateQueryKey(userId) });
    },
  });

  useEffect(() => {
    return () => {
      if (delayTimeoutRef.current) {
        clearTimeout(delayTimeoutRef.current);
      }
    };
  }, []);

  const markFeedAsOpened = useCallback(() => {
    if (!userId || markFeedAsOpenedMutation.isPending) {
      return;
    }
    markFeedAsOpenedMutation.mutate();
  }, [markFeedAsOpenedMutation, userId]);

  const newPostsCount = newPostsQuery.data ?? 0;
  const isLoading = feedStateQuery.isLoading || followingQuery.isLoading || newPostsQuery.isLoading;

  return {
    newPostsCount,
    isLoading,
    markFeedAsOpened,
  };
};
