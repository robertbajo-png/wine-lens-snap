import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/auth/AuthProvider";
import { feedMetaQueryKey } from "@/lib/followingQueries";
import { fetchFollowingFeedMeta, touchUserFeedState } from "@/services/followingFeed";

export const useFollowingFeedNotifications = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  const metaQuery = useQuery({
    queryKey: feedMetaQueryKey(userId),
    queryFn: () => fetchFollowingFeedMeta(userId!),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });

  const markAsOpened = useCallback(async () => {
    if (!userId) {
      return;
    }
    await touchUserFeedState();
    await queryClient.invalidateQueries({ queryKey: feedMetaQueryKey(userId) });
  }, [queryClient, userId]);

  const lastOpened = useMemo(() => {
    if (!metaQuery.data?.lastOpened) {
      return null;
    }
    return new Date(metaQuery.data.lastOpened);
  }, [metaQuery.data?.lastOpened]);

  return {
    newPostsCount: metaQuery.data?.newPostsCount ?? 0,
    lastOpened,
    isLoading: metaQuery.isLoading,
    isFetched: metaQuery.isFetched,
    markAsOpened,
  };
};
