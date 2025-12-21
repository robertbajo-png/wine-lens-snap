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
import { setAuthContextUserId } from "@/auth/authContextBridge";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<AuthOtpResponse>;
  signInWithGoogle: (redirectPath?: string | null) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// TEMPORARY: Mock user/session to bypass login requirement
const MOCK_USER_ID = "00000000-0000-0000-0000-000000000000";
const mockUser: User = {
  id: MOCK_USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "mock@winesnap.app",
  email_confirmed_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  app_metadata: { provider: "email" },
  user_metadata: {},
};
const mockSession: Session = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: "bearer",
  user: mockUser,
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // TEMPORARY: Always return mock session (bypass login)
  const [session, setSession] = useState<Session | null>(mockSession);
  const [loading, setLoading] = useState(false);

  useSyncScans(session?.user ?? null);

  // TEMPORARY: Original auth logic commented out - restore when re-enabling login
  /*
  useEffect(() => {
    let ignore = false;

    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!ignore) {
        setSession(session);
        setLoading(false);
        setAuthContextUserId(session?.user?.id ?? null);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      setAuthContextUserId(session?.user?.id ?? null);

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
  */

  useEffect(() => {
    setAuthContextUserId(MOCK_USER_ID);
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
      void logEvent("login_failed", { provider: "email", reason: result.error.message });
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

    const callbackUrl = new URL("/login/callback", window.location.origin);
    callbackUrl.searchParams.set("redirectTo", safeRedirectPath);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });

    if (error) {
      console.error("Supabase Google sign-in failed", error);
      void logEvent("login_failed", { provider: "google", reason: error.message });
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
