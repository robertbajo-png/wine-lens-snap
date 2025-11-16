import { supabase } from "@/lib/supabaseClient";

const AUTH_ERROR_MESSAGE = "Du behöver vara inloggad för att följa skapare.";

const requireUserId = async (): Promise<string> => {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error(error.message ?? AUTH_ERROR_MESSAGE);
  }

  const userId = data?.user?.id;
  if (!userId) {
    throw new Error(AUTH_ERROR_MESSAGE);
  }

  return userId;
};

export const followCreator = async (creatorId: string): Promise<void> => {
  if (!creatorId) {
    throw new Error("Ogiltigt creator-id");
  }

  const userId = await requireUserId();
  const { error } = await supabase
    .from("user_follows")
    .upsert({ creator_id: creatorId, user_id: userId }, { onConflict: "user_id,creator_id" });

  if (error) {
    throw new Error(error.message ?? "Kunde inte följa skaparen just nu.");
  }
};

export const unfollowCreator = async (creatorId: string): Promise<void> => {
  if (!creatorId) {
    throw new Error("Ogiltigt creator-id");
  }

  const userId = await requireUserId();
  const { error } = await supabase
    .from("user_follows")
    .delete()
    .match({ creator_id: creatorId, user_id: userId });

  if (error) {
    throw new Error(error.message ?? "Kunde inte sluta följa skaparen just nu.");
  }
};

export const isFollowing = async (creatorId: string): Promise<boolean> => {
  if (!creatorId) {
    return false;
  }

  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("user_follows")
    .select("creator_id")
    .eq("creator_id", creatorId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message ?? "Kunde inte läsa följstatus just nu.");
  }

  return Boolean(data);
};
