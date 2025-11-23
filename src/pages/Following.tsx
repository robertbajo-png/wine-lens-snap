import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";
import { Camera, LogIn, Newspaper, Sparkles, Users2 } from "lucide-react";

import CreatorCard from "@/components/following/CreatorCard";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/auth/AuthProvider";
import type { Json } from "@/integrations/supabase/types";
import { followCreator, unfollowCreator } from "@/services/creatorFollows";
import {
  type Creator,
  type CreatorFeedPost,
  fetchCreators,
  fetchFollowingFeed,
  fetchFollowingIds,
} from "@/services/followingFeed";
import { creatorsQueryKey, feedQueryKey, feedMetaQueryKey, followingQueryKey } from "@/lib/followingQueries";
import { useFollowingFeedNotifications } from "@/hooks/useFollowingFeedNotifications";

const numberFormatter = new Intl.NumberFormat("sv-SE");

type ToggleFollowVariables = {
  creatorId: string;
  shouldFollow: boolean;
};

type ToggleFollowContext = {
  previousCreators?: Creator[];
  previousFollowing?: string[];
  key?: ReturnType<typeof followingQueryKey>;
};

const POST_TYPE_LABELS: Record<string, string> = {
  quick_take: "Snabbnotis",
  longform: "Guide",
  listicle: "Lista",
  tip: "Tips",
  article: "Artikel",
  pairing: "Matchning",
};

const isRecord = (value: Json | Record<string, unknown> | null | undefined): value is Record<string, Json> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;

const getPreviewFromBody = (bodyJson: Json): string => {
  const fallback = "Öppna inlägget för mer detaljer.";

  if (!isRecord(bodyJson)) {
    return fallback;
  }

  if (isNonEmptyString(bodyJson.summary)) {
    return bodyJson.summary.trim();
  }

  if (isNonEmptyString(bodyJson.text)) {
    return bodyJson.text.trim();
  }

  const fromBlocks = Array.isArray(bodyJson.blocks)
    ? bodyJson.blocks.find((block) => isRecord(block) && isNonEmptyString(block.text))
    : null;
  if (fromBlocks && isRecord(fromBlocks) && isNonEmptyString(fromBlocks.text)) {
    return fromBlocks.text.trim();
  }

  const fromItems = Array.isArray(bodyJson.items)
    ? bodyJson.items.find((item) => isRecord(item) && (isNonEmptyString(item.detail) || isNonEmptyString(item.title)))
    : null;
  if (fromItems && isRecord(fromItems)) {
    if (isNonEmptyString(fromItems.detail)) {
      return fromItems.detail.trim();
    }
    if (isNonEmptyString(fromItems.title)) {
      return fromItems.title.trim();
    }
  }

  if (isNonEmptyString(bodyJson.cta)) {
    return bodyJson.cta.trim();
  }

  return fallback;
};

const truncateText = (text: string, maxLength = 200) =>
  text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;

const formatPostTypeLabel = (type: string) => POST_TYPE_LABELS[type] ?? type.replace(/_/g, " ");

const getInitials = (displayName: string) =>
  displayName
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);

const Following = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [pendingUnfollowId, setPendingUnfollowId] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<CreatorFeedPost | null>(null);
  const { newPostsCount, isFetched: notificationsReady, markAsOpened } = useFollowingFeedNotifications();
  const hasMarkedRef = useRef(false);

  const {
    data: creators,
    isLoading: creatorsLoading,
    error: creatorsError,
  } = useQuery<Creator[]>({
    queryKey: creatorsQueryKey,
    queryFn: fetchCreators,
  });

  const { data: followingData = [], isLoading: followingLoading } = useQuery<string[]>({
    queryKey: followingQueryKey(user?.id ?? null),
    queryFn: async () => {
      if (!user?.id) {
        return [];
      }
      return fetchFollowingIds(user.id);
    },
    enabled: Boolean(user?.id),
  });

  const {
    data: feedPosts = [],
    isLoading: feedLoading,
    error: feedError,
  } = useQuery<CreatorFeedPost[]>({
    queryKey: feedQueryKey(user?.id ?? null, followingData),
    queryFn: () => fetchFollowingFeed(followingData),
    enabled: Boolean(user?.id && !followingLoading && followingData.length > 0),
  });

  useEffect(() => {
    if (!user?.id) {
      hasMarkedRef.current = false;
      return;
    }

    if (!notificationsReady) {
      return;
    }

    if (newPostsCount === 0 && hasMarkedRef.current) {
      return;
    }

    const delay = newPostsCount > 0 ? 3000 : 0;
    const timer = window.setTimeout(() => {
      markAsOpened().catch(() => {
        /* noop */
      });
      hasMarkedRef.current = true;
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [markAsOpened, newPostsCount, notificationsReady, user?.id]);

  useEffect(() => {
    if (newPostsCount > 0) {
      hasMarkedRef.current = false;
    }
  }, [newPostsCount]);

  const followingSet = useMemo(() => new Set(followingData), [followingData]);
  const curatedCount = creators?.length ?? 0;
  const totalFollowers = useMemo(
    () => (creators ?? []).reduce((sum, creator) => sum + (creator.followers_count ?? 0), 0),
    [creators],
  );

  const creatorToUnfollow = useMemo(
    () => creators?.find((creator) => creator.id === pendingUnfollowId) ?? null,
    [creators, pendingUnfollowId],
  );

  const toggleFollowMutation = useMutation<void, Error, ToggleFollowVariables, ToggleFollowContext>({
    mutationFn: async ({ creatorId, shouldFollow }) => {
      if (!user?.id) {
        throw new Error("Du behöver vara inloggad för att följa skapare.");
      }

      if (shouldFollow) {
        await followCreator(creatorId);
      } else {
        await unfollowCreator(creatorId);
      }
    },
    onMutate: async ({ creatorId, shouldFollow }) => {
      if (!user?.id) {
        return {};
      }

      const key = followingQueryKey(user.id);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: creatorsQueryKey }),
        queryClient.cancelQueries({ queryKey: key }),
      ]);

      const previousCreators = queryClient.getQueryData<Creator[]>(creatorsQueryKey);
      const previousFollowing = queryClient.getQueryData<string[]>(key);

      queryClient.setQueryData<Creator[]>(creatorsQueryKey, (old) => {
        if (!old) return old;
        return old.map((creator) =>
          creator.id === creatorId
            ? {
                ...creator,
                followers_count: Math.max(0, creator.followers_count + (shouldFollow ? 1 : -1)),
              }
            : creator,
        );
      });

      queryClient.setQueryData<string[]>(key, (old = []) => {
        const next = new Set(old);
        if (shouldFollow) {
          next.add(creatorId);
        } else {
          next.delete(creatorId);
        }
        return Array.from(next);
      });

      return { previousCreators, previousFollowing, key } satisfies ToggleFollowContext;
    },
    onError: (error, _variables, context) => {
      if (context?.previousCreators) {
        queryClient.setQueryData(creatorsQueryKey, context.previousCreators);
      }
      if (context?.previousFollowing && context.key) {
        queryClient.setQueryData(context.key, context.previousFollowing);
      }
      toast({
        title: "Kunde inte uppdatera följning",
        description: error.message ?? "Försök igen om en liten stund.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      if (!user?.id) {
        return;
      }
      const key = followingQueryKey(user.id);
      queryClient.invalidateQueries({ queryKey: creatorsQueryKey });
      queryClient.invalidateQueries({ queryKey: key });
      queryClient.invalidateQueries({ queryKey: ["following", "feed"] });
      queryClient.invalidateQueries({ queryKey: feedMetaQueryKey(user.id) });
    },
  });

  const handleToggleFollow = (creatorId: string, nextState: boolean) => {
    if (!user) {
      navigate(`/login?redirectTo=${encodeURIComponent("/following")}`);
      return;
    }
    if (!nextState) {
      setPendingUnfollowId(creatorId);
      return;
    }
    toggleFollowMutation.mutate({ creatorId, shouldFollow: nextState });
  };

  const confirmUnfollow = () => {
    if (!pendingUnfollowId) {
      return;
    }
    toggleFollowMutation.mutate({ creatorId: pendingUnfollowId, shouldFollow: false });
    setPendingUnfollowId(null);
  };

  const isProcessingCreator = (creatorId: string) =>
    toggleFollowMutation.isPending && toggleFollowMutation.variables?.creatorId === creatorId;

  const showSkeletons = creatorsLoading;
  const showFeedSkeleton = followingLoading || feedLoading;
  const showEmptyFollowState = Boolean(user) && !followingLoading && followingSet.size === 0;
  const showFeedSection = Boolean(user);
  const showNewPostsBadge = newPostsCount > 0;
  const newPostsBadgeLabel = showNewPostsBadge ? (newPostsCount > 99 ? "99+" : `${newPostsCount}`) : null;

  const activatePost = (post: CreatorFeedPost) => {
    setSelectedPost(post);
  };

  const handlePostKeyDown = (event: KeyboardEvent<HTMLDivElement>, post: CreatorFeedPost) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activatePost(post);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-theme-canvas text-theme-secondary">
      <AmbientBackground />
      <div className="absolute right-4 top-6 z-20">
        <Button
          className="gap-2 rounded-full bg-theme-accent text-theme-on-accent shadow-theme-card"
          onClick={() => navigate("/scan")}
          aria-label="Starta ny skanning"
        >
          <Camera className="h-4 w-4" />
          Ny skanning
        </Button>
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-24 pt-24 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--color-border)/0.4)] bg-[hsl(var(--color-surface)/0.2)] px-4 py-1 text-xs uppercase tracking-[0.25em] text-theme-secondary/70">
              <Users2 className="h-4 w-4 text-theme-primary" aria-hidden="true" />
              Följer
            </span>
            {showNewPostsBadge && newPostsBadgeLabel ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-theme-accent-soft px-3 py-1 text-[0.75rem] font-semibold text-theme-accent"
                aria-live="polite"
              >
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                {newPostsBadgeLabel} nya inlägg
              </span>
            ) : null}
          </div>
          <h1 className="text-3xl font-semibold text-theme-primary sm:text-4xl">Kuraterade skapare & listor</h1>
          <p className="max-w-2xl text-sm text-theme-secondary/80 sm:text-base">
            Följ redaktionens favoriter för att se butikslistor, livesändningar och nördiga rekommendationer så fort funktionen rullas ut.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/70">
            <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--color-border)/0.4)] bg-[hsl(var(--color-surface)/0.1)] px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-theme-primary" aria-hidden="true" />
              {curatedCount} skapare
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--color-border)/0.4)] bg-[hsl(var(--color-surface)/0.1)] px-3 py-1">
              <Users2 className="h-3.5 w-3.5 text-theme-primary" aria-hidden="true" />
              {followingSet.size} följer du
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(var(--color-border)/0.4)] bg-[hsl(var(--color-surface)/0.1)] px-3 py-1">
              {numberFormatter.format(totalFollowers)} följare totalt
            </span>
          </div>
          {!user && !authLoading ? (
            <Button
              size="lg"
              className="mt-2 gap-2 rounded-full"
              onClick={() => navigate(`/login?redirectTo=${encodeURIComponent("/following")}`)}
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Logga in för att följa
            </Button>
          ) : null}
        </div>

        <div className="mt-10 space-y-10">
          {showFeedSection ? (
            <section className="space-y-4 rounded-3xl border border-[hsl(var(--color-border)/0.7)] bg-[hsl(var(--color-surface-alt)/0.8)] p-6 text-theme-primary shadow-theme-card">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/70">Ditt flöde</p>
                  <h2 className="text-2xl font-semibold text-theme-primary">Nyheter från skapare du följer</h2>
                  <p className="text-sm text-theme-secondary/80">Sorterade efter senast publicerat.</p>
                </div>
                <div className="rounded-2xl bg-[hsl(var(--color-surface)/0.4)] p-3 text-theme-primary/80">
                  <Newspaper className="h-6 w-6" aria-hidden="true" />
                </div>
              </div>

              {showFeedSkeleton ? (
                <div className="space-y-3">
                  {[0, 1, 2].map((key) => (
                    <Card key={`feed-skeleton-${key}`} className="border-[hsl(var(--color-border)/0.7)] bg-[hsl(var(--color-surface)/0.3)]">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-10 w-10 rounded-full bg-[hsl(var(--color-surface)/0.6)]" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-1/3 bg-[hsl(var(--color-surface)/0.6)]" />
                            <Skeleton className="h-3 w-1/4 bg-[hsl(var(--color-surface)/0.6)]" />
                          </div>
                          <Skeleton className="h-5 w-20 rounded-full bg-[hsl(var(--color-surface)/0.6)]" />
                        </div>
                        <Skeleton className="h-4 w-3/4 bg-[hsl(var(--color-surface)/0.6)]" />
                        <Skeleton className="h-3 w-full bg-[hsl(var(--color-surface)/0.6)]" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : null}

              {showEmptyFollowState ? (
                <Card className="border-[hsl(var(--color-border)/0.6)] bg-[hsl(var(--color-surface)/0.2)] text-theme-primary shadow-theme-card">
                  <CardContent className="space-y-3 p-6 text-center">
                    <p className="text-base font-semibold">Följ minst en skapare för att se flödet.</p>
                    <p className="text-sm text-theme-secondary/80">
                      Använd listan nedan för att hitta profiler du vill följa. Nya inlägg dyker upp här direkt.
                    </p>
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() =>
                        document.getElementById("recommended-creators")?.scrollIntoView({ behavior: "smooth" })
                      }
                    >
                      Visa rekommenderade skapare
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              {!showFeedSkeleton && !showEmptyFollowState && followingSet.size > 0 ? (
                <div className="space-y-4">
                  {feedError ? (
                    <Card className="border-[hsl(var(--color-border)/0.6)] bg-[hsl(var(--color-surface)/0.2)] text-theme-primary shadow-theme-card">
                      <CardContent className="space-y-2 p-5 text-center">
                        <p className="text-base font-semibold">Kunde inte ladda flödet</p>
                        <p className="text-sm text-theme-secondary/80">Försök igen eller uppdatera sidan.</p>
                        <Button
                          variant="outline"
                          className="rounded-full"
                          onClick={() => queryClient.invalidateQueries({ queryKey: ["following", "feed"] })}
                        >
                          Försök igen
                        </Button>
                      </CardContent>
                    </Card>
                  ) : null}

                  {!feedLoading && !feedError && feedPosts.length === 0 ? (
                    <Card className="border-[hsl(var(--color-border)/0.6)] bg-[hsl(var(--color-surface)/0.2)] text-theme-primary shadow-theme-card">
                      <CardContent className="space-y-2 p-6 text-center">
                        <p className="text-base font-semibold">Inga inlägg än</p>
                        <p className="text-sm text-theme-secondary/80">
                          Dina favoritkreatörer har inte publicerat något nytt ännu. Kika tillbaka lite senare.
                        </p>
                      </CardContent>
                    </Card>
                  ) : null}

                  {feedPosts.map((post) => {
                    const preview = truncateText(getPreviewFromBody(post.body_json));
                    const publishedAgo = formatDistanceToNow(new Date(post.created_at), {
                      addSuffix: true,
                      locale: sv,
                    });
                    const creatorName = post.creator?.display_name ?? "Okänd skapare";

                    return (
                      <Card
                        key={post.id}
                        className="cursor-pointer border-[hsl(var(--color-border)/0.7)] bg-[hsl(var(--color-surface)/0.2)] transition hover:border-[hsl(var(--color-accent)/0.6)] hover:bg-[hsl(var(--color-surface)/0.3)]"
                        role="button"
                        tabIndex={0}
                        aria-label={`Öppna inlägget ${post.title}`}
                        onClick={() => activatePost(post)}
                        onKeyDown={(event) => handlePostKeyDown(event, post)}
                      >
                        <CardContent className="space-y-4 p-5">
                          <div className="flex flex-wrap items-center gap-3">
                            <Avatar className="h-10 w-10 border border-[hsl(var(--color-border)/0.6)] bg-[hsl(var(--color-surface)/0.4)]">
                              {post.creator?.avatar_url ? (
                                <AvatarImage src={post.creator.avatar_url} alt={creatorName} />
                              ) : (
                                <AvatarFallback className="bg-[hsl(var(--color-surface)/0.5)] text-sm text-theme-primary/80">
                                  {getInitials(creatorName)}
                                </AvatarFallback>
                              )}
                            </Avatar>
                            <div className="flex-1 text-left">
                              <p className="text-sm font-semibold text-theme-primary">{creatorName}</p>
                              <p className="text-xs text-theme-secondary/70">{publishedAgo}</p>
                            </div>
                            <Badge className="rounded-full border-[hsl(var(--color-border)/0.7)] text-xs uppercase tracking-[0.2em] text-theme-secondary/80" variant="outline">
                              {formatPostTypeLabel(post.type)}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold text-theme-primary">{post.title}</h3>
                            <p className="text-sm text-theme-secondary/80">{preview}</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : null}
            </section>
          ) : null}

          <section id="recommended-creators" className="space-y-6">
            <div className="space-y-1 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/70">
                Rekommenderade skapare
              </p>
              <h2 className="text-2xl font-semibold text-theme-primary">Utforska redaktionens favoriter</h2>
            </div>

            {creatorsError ? (
              <Card className="border-[hsl(var(--color-border)/0.6)] bg-[hsl(var(--color-surface-alt)/0.8)] text-theme-primary shadow-theme-card">
                <CardContent className="space-y-2 p-6 text-center">
                  <p className="text-base font-semibold">Kunde inte ladda listan</p>
                  <p className="text-sm text-theme-secondary/80">
                    Kontrollera din uppkoppling och försök igen om en liten stund.
                  </p>
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => queryClient.invalidateQueries({ queryKey: creatorsQueryKey })}
                  >
                    Försök igen
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            {showSkeletons ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[0, 1, 2].map((key) => (
                  <Card key={key} className="border-[hsl(var(--color-border)/0.7)] bg-[hsl(var(--color-surface-alt)/0.6)]">
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-full bg-[hsl(var(--color-surface)/0.6)]" />
                        <div className="flex-1 space-y-2">
                          <Skeleton className="h-4 w-1/2 bg-[hsl(var(--color-surface)/0.6)]" />
                          <Skeleton className="h-3 w-1/3 bg-[hsl(var(--color-surface)/0.6)]" />
                        </div>
                      </div>
                      <Skeleton className="h-16 w-full bg-[hsl(var(--color-surface)/0.6)]" />
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-3 w-24 bg-[hsl(var(--color-surface)/0.6)]" />
                        <Skeleton className="h-9 w-28 rounded-full bg-[hsl(var(--color-surface)/0.6)]" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}

            {!creatorsLoading && !creatorsError ? (
              <>
                {creators && creators.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {creators.map((creator) => (
                      <CreatorCard
                        key={creator.id}
                        creator={creator}
                        isFollowing={followingSet.has(creator.id)}
                        disabled={!user || authLoading || followingLoading}
                        isProcessing={isProcessingCreator(creator.id)}
                        onToggle={handleToggleFollow}
                      />
                    ))}
                  </div>
                ) : (
                  <Card className="border-[hsl(var(--color-border)/0.7)] bg-[hsl(var(--color-surface-alt)/0.8)] text-theme-primary shadow-theme-card">
                    <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
                      <p className="text-base font-semibold">Listan är tom</p>
                      <p className="text-sm text-theme-secondary/80">
                        Vi fyller på med fler tips. Under tiden kan du gå till Utforska och hitta etiketter att bevaka.
                      </p>
                      <Button variant="outline" className="rounded-full" onClick={() => navigate("/explore")}>
                        Gå till Utforska
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : null}
          </section>
        </div>
      </div>
      <AlertDialog open={Boolean(pendingUnfollowId)} onOpenChange={(open) => !open && setPendingUnfollowId(null)}>
        <AlertDialogContent className="border-[hsl(var(--color-border)/0.7)] bg-[hsl(var(--color-surface-alt)/0.9)] text-theme-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Sluta följa {creatorToUnfollow?.display_name ?? "den här skaparen"}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-theme-secondary/80">
              Du kommer inte längre att se nya listor eller tips från den här skaparen i flödet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full" disabled={toggleFollowMutation.isPending}>
              Behåll
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmUnfollow}
              disabled={toggleFollowMutation.isPending}
            >
              Sluta följ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={Boolean(selectedPost)} onOpenChange={(open) => !open && setSelectedPost(null)}>
        <DialogContent className="border-[hsl(var(--color-border)/0.8)] bg-[hsl(var(--color-surface-alt)/0.95)] text-theme-primary">
          <DialogHeader>
            <DialogTitle>{selectedPost?.title}</DialogTitle>
            {selectedPost ? (
              <DialogDescription className="text-theme-secondary/80">
                {selectedPost.creator?.display_name ?? "Okänd skapare"} · {formatPostTypeLabel(selectedPost.type)} · {" "}
                {formatDistanceToNow(new Date(selectedPost.created_at), { addSuffix: true, locale: sv })}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          {selectedPost ? (
            <div className="space-y-4">
              <p className="text-sm text-theme-secondary/80">{getPreviewFromBody(selectedPost.body_json)}</p>
              <Card className="border-[hsl(var(--color-border)/0.6)] bg-[hsl(var(--color-surface)/0.2)] text-theme-secondary/80">
                <CardContent className="space-y-2 p-4 text-sm">
                  <p className="font-semibold text-theme-primary">Detaljerad läsning kommer snart</p>
                  <p>
                    Vi bygger en fullständig läsarupplevelse för kreatörsinlägg. Tills dess visar vi en kort förhandsvisning.
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Following;
