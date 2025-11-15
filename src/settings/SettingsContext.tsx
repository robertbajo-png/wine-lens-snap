import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import type { ThemeName } from "@/ui/theme";
import { applyThemeByName, themeTokensByName } from "@/ui/theme";

const SETTINGS_STORAGE_KEY = "winesnap.settings";
const LEGACY_THEME_STORAGE_KEY = "winesnap.theme";
const DEFAULT_LANGUAGE = "sv-SE";

export type Settings = {
  theme: ThemeName;
  lang: string;
  pushOptIn: boolean;
};

type SettingsContextValue = {
  settings: Settings;
  theme: ThemeName;
  lang: string;
  pushOptIn: boolean;
  loading: boolean;
  error: string | null;
  setTheme: (theme: ThemeName) => Promise<void>;
  setLang: (lang: string) => Promise<void>;
  setPushOptIn: (pushOptIn: boolean) => Promise<void>;
  updateSettings: (changes: Partial<Settings>) => Promise<void>;
};

type RawSettings = {
  theme?: string | null;
  lang?: string | null;
  pushOptIn?: boolean | null;
};

const normalizeLanguageTag = (value: string): string => {
  const normalized = value.replace(/_/g, "-").trim();
  if (!normalized) {
    return "";
  }

  const segments = normalized.split("-").filter(Boolean);
  if (segments.length === 0) {
    return "";
  }

  const [language, region, ...rest] = segments;
  const lowerLanguage = language.toLowerCase();
  const formattedRegion = region ? region.toUpperCase() : undefined;
  const remaining = rest.join("-");

  return [lowerLanguage, formattedRegion, remaining]
    .filter((segment) => segment && segment.length > 0)
    .join("-");
};

const detectBrowserLanguage = () => {
  if (typeof navigator === "undefined") {
    return DEFAULT_LANGUAGE;
  }

  const candidates = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language,
  ].filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);

  if (candidates.length === 0) {
    return DEFAULT_LANGUAGE;
  }

  const normalized = normalizeLanguageTag(candidates[0]);
  return normalized || DEFAULT_LANGUAGE;
};

const sanitizeTheme = (theme?: string | null): ThemeName => {
  if (!theme) {
    return "dark";
  }

  return theme in themeTokensByName ? (theme as ThemeName) : "dark";
};

const sanitizeLanguage = (lang?: string | null): string => {
  if (!lang || typeof lang !== "string") {
    return detectBrowserLanguage();
  }

  const normalized = normalizeLanguageTag(lang);
  return normalized || detectBrowserLanguage();
};

const sanitizeSettings = (raw: RawSettings | null | undefined): Settings => ({
  theme: sanitizeTheme(raw?.theme),
  lang: sanitizeLanguage(raw?.lang),
  pushOptIn: Boolean(raw?.pushOptIn),
});

const readLocalSettings = (): Settings => {
  if (typeof window === "undefined") {
    return sanitizeSettings(null);
  }

  const storedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (storedSettings) {
    try {
      const parsed = JSON.parse(storedSettings) as RawSettings;
      return sanitizeSettings(parsed);
    } catch (error) {
      console.warn("[Settings] Failed to parse stored settings", error);
    }
  }

  const legacyTheme = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
  const theme = legacyTheme
    ? (() => {
        try {
          return JSON.parse(legacyTheme) as string;
        } catch (error) {
          console.warn("[Settings] Failed to parse legacy theme", error);
          return legacyTheme;
        }
      })()
    : undefined;

  return sanitizeSettings({
    theme,
    lang: null,
    pushOptIn: null,
  });
};

const persistLocalSettings = (value: Settings) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(value));
    window.localStorage.setItem(LEGACY_THEME_STORAGE_KEY, JSON.stringify(value.theme));
  } catch (error) {
    console.warn("[Settings] Failed to persist settings", error);
  }
};

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Settings>(() => {
    const initial = readLocalSettings();
    applyThemeByName(initial.theme);
    return initial;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    applyThemeByName(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    persistLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      if (!user) {
        if (!cancelled) {
          setLoading(false);
          setError(null);
          const local = readLocalSettings();
          settingsRef.current = local;
          setSettings(local);
        }
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("user_settings")
        .select("theme, lang, push_opt_in")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        console.error("[Settings] Failed to load remote settings", error);
        setError("Kunde inte hämta dina inställningar just nu.");
        setLoading(false);
        return;
      }

      if (data) {
        const next = sanitizeSettings({
          theme: data.theme,
          lang: data.lang,
          pushOptIn: data.push_opt_in,
        });
        settingsRef.current = next;
        setSettings(next);
        setLoading(false);
        return;
      }

      const fallback = settingsRef.current;
      const payload = {
        user_id: user.id,
        theme: fallback.theme,
        lang: fallback.lang,
        push_opt_in: fallback.pushOptIn,
      } as const;

      const { error: upsertError } = await supabase
        .from("user_settings")
        .upsert(payload, { onConflict: "user_id" });

      if (cancelled) {
        return;
      }

      if (upsertError) {
        console.error("[Settings] Failed to initialize remote settings", upsertError);
        setError("Kunde inte spara dina inställningar just nu.");
      } else {
        setError(null);
      }

      setLoading(false);
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const updateSettings = useCallback(
    async (changes: Partial<Settings>) => {
      const next = sanitizeSettings({ ...settingsRef.current, ...changes });
      settingsRef.current = next;
      setSettings(next);

      if (!user) {
        setError(null);
        return;
      }

      const { error } = await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: user.id,
            theme: next.theme,
            lang: next.lang,
            push_opt_in: next.pushOptIn,
          },
          { onConflict: "user_id" },
        );

      if (error) {
        console.error("[Settings] Failed to persist settings", error);
        setError("Kunde inte spara dina inställningar just nu.");
        throw error;
      }

      setError(null);
    },
    [user],
  );

  const setTheme = useCallback(
    (theme: ThemeName) => updateSettings({ theme }),
    [updateSettings],
  );

  const setLang = useCallback((lang: string) => updateSettings({ lang }), [updateSettings]);

  const setPushOptIn = useCallback(
    (pushOptIn: boolean) => updateSettings({ pushOptIn }),
    [updateSettings],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      theme: settings.theme,
      lang: settings.lang,
      pushOptIn: settings.pushOptIn,
      loading,
      error,
      setTheme,
      setLang,
      setPushOptIn,
      updateSettings,
    }),
    [error, loading, settings, setLang, setPushOptIn, setTheme, updateSettings],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};
