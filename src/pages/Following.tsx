import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, LogIn, Sparkles, Users2 } from "lucide-react";

import AccountCard from "@/components/following/AccountCard";
import { AmbientBackground } from "@/components/AmbientBackground";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/auth/AuthProvider";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/lib/supabaseClient";

const numberFormatter = new Intl.NumberFormat("sv-SE");

type Account = Tables<"accounts">;

type ToggleFollowVariables = {
  accountId: string;
  shouldFollow: boolean;
};

const accountsQueryKey = ["following", "accounts"] as const;
const followingQueryKey = (userId: string | null) => ["following", "relationships", userId ?? "guest"] as const;

type ToggleFollowContext = {
  previousAccounts?: Account[];
  previousFollowing?: string[];
  key?: ReturnType<typeof followingQueryKey>;
};

const fetchAccounts = async (): Promise<Account[]> => {
  const { data, error } = await supabase.from("accounts").select("*").order("display_name", { ascending: true });
  if (error) {
    throw error;
  }
  return data ?? [];
};

const fetchFollowingIds = async (userId: string): Promise<string[]> => {
  const { data, error } = await supabase.from("follows").select("followee_id").eq("follower_id", userId);
  if (error) {
    throw error;
  }
  return data?.map((row) => row.followee_id) ?? [];
};

const Following = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();

  const {
    data: accounts,
    isLoading: accountsLoading,
    error: accountsError,
  } = useQuery<Account[]>({
    queryKey: accountsQueryKey,
    queryFn: fetchAccounts,
  });

  const { data: followingData = [], isLoading: followingLoading } = useQuery<string[]>({
    queryKey: followingQueryKey(user?.id ?? null),
    queryFn: () => fetchFollowingIds(user!.id),
    enabled: Boolean(user?.id),
  });

  const followingSet = useMemo(() => new Set(followingData), [followingData]);
  const curatedCount = accounts?.length ?? 0;
  const totalFollowers = useMemo(
    () => (accounts ?? []).reduce((sum, account) => sum + (account.followers_count ?? 0), 0),
    [accounts],
  );

  const toggleFollowMutation = useMutation<void, Error, ToggleFollowVariables, ToggleFollowContext>({
    mutationFn: async ({ accountId, shouldFollow }) => {
      if (!user?.id) {
        throw new Error("Du behöver vara inloggad för att följa konton.");
      }

      if (shouldFollow) {
        const { error } = await supabase
          .from("follows")
          .upsert(
            { follower_id: user.id, followee_id: accountId },
            { onConflict: "follower_id,followee_id" },
          );
        if (error) {
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("follows")
          .delete()
          .match({ follower_id: user.id, followee_id: accountId });
        if (error) {
          throw error;
        }
      }
    },
    onMutate: async ({ accountId, shouldFollow }) => {
      if (!user?.id) {
        return {};
      }

      const key = followingQueryKey(user.id);
      await Promise.all([
        queryClient.cancelQueries({ queryKey: accountsQueryKey }),
        queryClient.cancelQueries({ queryKey: key }),
      ]);

      const previousAccounts = queryClient.getQueryData<Account[]>(accountsQueryKey);
      const previousFollowing = queryClient.getQueryData<string[]>(key);

      queryClient.setQueryData<Account[]>(accountsQueryKey, (old) => {
        if (!old) return old;
        return old.map((account) =>
          account.id === accountId
            ? {
                ...account,
                followers_count: Math.max(0, account.followers_count + (shouldFollow ? 1 : -1)),
              }
            : account,
        );
      });

      queryClient.setQueryData<string[]>(key, (old = []) => {
        const next = new Set(old);
        if (shouldFollow) {
          next.add(accountId);
        } else {
          next.delete(accountId);
        }
        return Array.from(next);
      });

      return { previousAccounts, previousFollowing, key } satisfies ToggleFollowContext;
    },
    onError: (error, _variables, context) => {
      if (context?.previousAccounts) {
        queryClient.setQueryData(accountsQueryKey, context.previousAccounts);
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
      queryClient.invalidateQueries({ queryKey: accountsQueryKey });
      queryClient.invalidateQueries({ queryKey: key });
    },
  });

  const handleToggleFollow = (accountId: string, nextState: boolean) => {
    if (!user) {
      navigate(`/login?redirectTo=${encodeURIComponent("/following")}`);
      return;
    }
    toggleFollowMutation.mutate({ accountId, shouldFollow: nextState });
  };

  const isProcessingAccount = (accountId: string) =>
    toggleFollowMutation.isPending && toggleFollowMutation.variables?.accountId === accountId;

  const showSkeletons = accountsLoading;

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
          <h1 className="text-3xl font-semibold text-theme-primary sm:text-4xl">Kuraterade konton & listor</h1>
          <p className="max-w-2xl text-sm text-theme-secondary/80 sm:text-base">
            Följ redaktionens favoriter för att se butikslistor, livesändningar och nördiga rekommendationer så fort funktionen rullas ut.
          </p>
          <div className="flex flex-wrap justify-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-theme-secondary/70">
            <span className="inline-flex items-center gap-2 rounded-full border border-theme-card/40 bg-theme-card/10 px-3 py-1">
              <Sparkles className="h-3.5 w-3.5 text-theme-primary" aria-hidden="true" />
              {curatedCount} konton
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
          {accountsError ? (
            <Card className="border-theme-card/60 bg-theme-elevated/80 text-theme-primary">
              <CardContent className="space-y-2 p-6 text-center">
                <p className="text-base font-semibold">Kunde inte ladda listan</p>
                <p className="text-sm text-theme-secondary/80">
                  Kontrollera din uppkoppling och försök igen om en liten stund.
                </p>
                <Button variant="outline" className="rounded-full" onClick={() => queryClient.invalidateQueries({ queryKey: accountsQueryKey })}>
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

          {!accountsLoading && !accountsError ? (
            <>
              {accounts && accounts.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {accounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      isFollowing={followingSet.has(account.id)}
                      disabled={!user || authLoading || followingLoading}
                      isProcessing={isProcessingAccount(account.id)}
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
    </div>
  );
};

export default Following;
