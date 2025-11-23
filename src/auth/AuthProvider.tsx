import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthOtpResponse, Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { useSyncScans } from "@/hooks/useSyncScans";
import { logEvent } from "@/lib/logger";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<AuthOtpResponse>;
  signInWithGoogle: (redirectPath?: string | null) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useSyncScans(session?.user ?? null);

  useEffect(() => {
    let ignore = false;

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!ignore) {
        setSession(session);
        setLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);

      if (_event === "SIGNED_IN" && session?.user) {
        const rawProvider = session.user.app_metadata?.provider;
        const provider =
          rawProvider === "google" || rawProvider === "apple" ? rawProvider : "email";
        void logEvent(
          "login_succeeded",
          { provider },
          { userId: session.user.id },
        );
      }
    });

    return () => {
      ignore = true;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithEmail = useCallback(async (email: string) => {
    const result = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/me`,
      },
    });

    if (result.error) {
      console.error("Supabase email sign-in failed", result.error);
    }

    return result;
  }, []);

  const signInWithGoogle = useCallback(async (redirectPath?: string | null) => {
    const safeRedirectPath = (() => {
      if (!redirectPath) {
        return "/me";
      }

      const trimmed = redirectPath.trim();
      if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
        return "/me";
      }

      return trimmed;
    })();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: new URL(safeRedirectPath, window.location.origin).toString(),
      },
    });

    if (error) {
      console.error("Supabase Google sign-in failed", error);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Supabase sign-out failed", error);
      throw error;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      signInWithEmail,
      signInWithGoogle,
      signOut,
    }),
    [loading, session, signInWithEmail, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
