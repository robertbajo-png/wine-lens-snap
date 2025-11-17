export const creatorsQueryKey = ["following", "creators"] as const;

export const followingQueryKey = (userId: string | null) =>
  ["following", "relationships", userId ?? "guest"] as const;

export const feedQueryKey = (userId: string | null, followingIds: string[]) =>
  ["following", "feed", userId ?? "guest", [...followingIds].sort().join(",")] as const;

export const feedMetaQueryKey = (userId: string | null) =>
  ["following", "feed-meta", userId ?? "guest"] as const;
