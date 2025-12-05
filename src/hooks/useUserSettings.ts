import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/auth/AuthProvider";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/lib/supabaseClient";

type UserSettings = Tables<"user_settings">;

const fetchUserSettings = async (userId: string): Promise<UserSettings | null> => {
  const { data, error } = await supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
};

export const useUserSettings = () => {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const query = useQuery<UserSettings | null, Error>({
    queryKey: ["user_settings", userId],
    queryFn: () => fetchUserSettings(userId!),
    enabled: Boolean(userId),
    staleTime: 60_000,
  });

  const settings = userId ? query.data ?? null : null;
  const settingsJson = settings?.settings_json as { is_premium?: boolean; premium_since?: string } | null;
  const premiumFlag = settings?.is_premium ?? settingsJson?.is_premium ?? false;
  const premiumTimestamp = settings?.premium_since ?? settingsJson?.premium_since ?? null;
  const premiumSince = useMemo(() => {
    if (!premiumTimestamp) {
      return null;
    }

    const parsed = new Date(premiumTimestamp);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [premiumTimestamp]);

  return {
    settings,
    isPremium: premiumFlag,
    premiumSince,
    isLoading: userId ? query.isPending : false,
    error: query.error ?? null,
    refetch: query.refetch,
  };
};

export const useIsPremium = () => {
  const { isPremium, premiumSince, isLoading } = useUserSettings();
  return { isPremium, premiumSince, isLoading } as const;
};
