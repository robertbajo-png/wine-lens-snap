import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useSettings } from "@/settings/SettingsContext";
import {
  applyThemeByName,
  detectSystemTheme,
  themeTokensByName,
  type ThemeName,
  type ThemePreference,
  type ThemeTokens,
} from "@/ui/theme";

export type ThemeContextValue = {
  theme: ThemeName;
  themePreference: ThemePreference;
  tokens: ThemeTokens;
  setThemePreference: (preference: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const resolveThemeFromPreference = (preference: ThemePreference, systemTheme: ThemeName): ThemeName => {
  return preference === "system" ? systemTheme : preference;
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { theme: themePreference, setTheme: setThemePreference } = useSettings();
  const [systemTheme, setSystemTheme] = useState<ThemeName>(() => detectSystemTheme());

  const resolvedTheme = useMemo(
    () => resolveThemeFromPreference(themePreference, systemTheme),
    [systemTheme, themePreference],
  );

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    setSystemTheme(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, []);

  useEffect(() => {
    applyThemeByName(resolvedTheme);
  }, [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: resolvedTheme,
      themePreference,
      tokens: themeTokensByName[resolvedTheme],
      setThemePreference,
    }),
    [resolvedTheme, setThemePreference, themePreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
};
