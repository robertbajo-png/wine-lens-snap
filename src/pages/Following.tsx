import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, LogIn, Sparkles, Users2 } from "lucide-react";

import CreatorCard from "@/components/following/CreatorCard";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/lib/supabaseClient";
import { followCreator, unfollowCreator } from "@/services/creatorFollows";

const numberFormatter = new Intl.NumberFormat("sv-SE");

type Creator = Tables<"creators">;

type ToggleFollowVariables = {
  creatorId: string;
  shouldFollow: boolean;
};

const creatorsQueryKey = ["following", "creators"] as const;
const followingQueryKey = (userId: string | null) => ["following", "relationships", userId ?? "guest"] as const;

type ToggleFollowContext = {
  previousCreators?: Creator[];
  previousFollowing?: string[];
  key?: ReturnType<typeof followingQueryKey>;
};

const fetchCreators = async (): Promise<Creator[]> => {
  const { data, error } = await supabase.from("creators").select("*").order("display_name", { ascending: true });
  if (error) {
    throw error;
  }
  return data ?? [];
};

const fetchFollowingIds = async (userId: string): Promise<string[]> => {
  const { data, error } = await supabase.from("user_follows").select("creator_id").eq("user_id", userId);
  if (error) {
    throw error;
  }
  return data?.map((row) => row.creator_id) ?? [];
};

const Following = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const [pendingUnfollowId, setPendingUnfollowId] = useState<string | null>(null);

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
    queryFn: () => fetchFollowingIds(user!.id),
    enabled: Boolean(user?.id),
  });

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

  return (
    <div className="relative min-h-screen overflow-hidden bg-theme-canvas text-theme-secondary">
      <AmbientBackground />
      <div className="absolute right-4 top-6 z-20">
        <Button
          className="gap-2 rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#B095FF] text-theme-primary shadow-[0_18px_45px_-18px_rgba(123,63,228,1)]"
          onClick={() => navigate("/scan")}
          aria-label="Starta ny skanning"
        >
          <Camera className="h-4 w-4" />
          Ny skanning
        </Button>
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-24 pt-24 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-5 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-theme-card/40 bg-theme-card/20 px-4 py-1 text-xs uppercase tracking-[0.25em] text-theme-secondary/70">
            <Users2 className="h-4 w-4 text-theme-primary" aria-hidden="true" />
            Följer
          </span>
          <h1 className="text-3xl font-semibold text-theme-primary sm:text-4xl">Kuraterade skapare & listor</h1>
          <p className="max-w-2xl text-sm text-theme-secondary/80 sm:text-base">
            Följ redaktionens favoriter för att se butikslistor, livesändningar och nördiga rekommendationer så fort funktionen rullas ut.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/70">
            <span className="inline-flex items-center gap-2 rounded-full border border-theme-card/40 bg-theme-card/10 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-theme-primary" aria-hidden="true" />
              {curatedCount} skapare
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-theme-card/40 bg-theme-card/10 px-3 py-1">
              <Users2 className="h-3.5 w-3.5 text-theme-primary" aria-hidden="true" />
              {followingSet.size} följer du
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-theme-card/40 bg-theme-card/10 px-3 py-1">
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

        <div className="mt-10 space-y-6">
          {creatorsError ? (
            <Card className="border-theme-card/60 bg-theme-elevated/80 text-theme-primary">
              <CardContent className="space-y-2 p-6 text-center">
                <p className="text-base font-semibold">Kunde inte ladda listan</p>
                <p className="text-sm text-theme-secondary/80">
                  Kontrollera din uppkoppling och försök igen om en liten stund.
                </p>
                <Button variant="outline" className="rounded-full" onClick={() => queryClient.invalidateQueries({ queryKey: creatorsQueryKey })}>
                  Försök igen
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {showSkeletons ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[0, 1, 2].map((key) => (
                <Card key={key} className="border-theme-card/70 bg-theme-elevated/60">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-12 w-12 rounded-full bg-theme-card/60" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/2 bg-theme-card/60" />
                        <Skeleton className="h-3 w-1/3 bg-theme-card/60" />
                      </div>
                    </div>
                    <Skeleton className="h-16 w-full bg-theme-card/60" />
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-3 w-24 bg-theme-card/60" />
                      <Skeleton className="h-9 w-28 rounded-full bg-theme-card/60" />
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
                <Card className="border-theme-card/70 bg-theme-elevated/80 text-theme-primary">
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
        </div>
      </div>
      <AlertDialog open={Boolean(pendingUnfollowId)} onOpenChange={(open) => !open && setPendingUnfollowId(null)}>
        <AlertDialogContent className="border-theme-card/70 bg-theme-elevated/90 text-theme-primary">
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
    </div>
  );
};

export default Following;
