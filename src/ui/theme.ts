export type ThemeTokens = {
  bgCanvas: string;
  bgSurface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  accentPrimary: string;
  cardBorder: string;
};

export type ThemeName = "dark" | "light";
export type ThemePreference = ThemeName | "system";

export const darkTheme: ThemeTokens = {
  bgCanvas: "262 52% 6%",
  bgSurface: "262 45% 10%",
  surfaceElevated: "261 42% 16%",
  textPrimary: "259 56% 95%",
  textSecondary: "260 28% 78%",
  accentPrimary: "271 86% 67%",
  cardBorder: "262 36% 28%",
};

export const lightTheme: ThemeTokens = {
  bgCanvas: "0 0% 100%",
  bgSurface: "258 60% 97%",
  surfaceElevated: "260 40% 92%",
  textPrimary: "261 40% 18%",
  textSecondary: "262 20% 38%",
  accentPrimary: "268 85% 58%",
  cardBorder: "260 28% 80%",
};

export const themeTokensByName: Record<ThemeName, ThemeTokens> = {
  dark: darkTheme,
  light: lightTheme,
};

const toCssVariableName = (token: keyof ThemeTokens) =>
  `--${token.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}`;

const setBodyThemeClass = (theme: ThemeName) => {
  if (typeof document === "undefined") {
    return;
  }

  const body = document.body;
  body.classList.add("app-theme");
  body.classList.remove("theme-dark", "theme-light");
  body.classList.add(`theme-${theme}`);
};

export const detectSystemTheme = (): ThemeName => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const applyTheme = (tokens: ThemeTokens, themeName: ThemeName) => {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;

  (Object.keys(tokens) as (keyof ThemeTokens)[]).forEach(key => {
    const cssVariable = toCssVariableName(key);
    root.style.setProperty(cssVariable, tokens[key]);
  });

  setBodyThemeClass(themeName);
};

export const applyThemeByName = (theme: ThemeName) => {
  applyTheme(themeTokensByName[theme], theme);
};
