export type ThemeTokens = {
  bgCanvas: string;
  bgSurface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  accentPrimary: string;
  cardBorder: string;
  colorBackground: string;
  colorSurface: string;
  colorSurfaceAlt: string;
  colorBorder: string;
  colorText: string;
  colorTextMuted: string;
  colorAccent: string;
  colorAccentSoft: string;
  colorDanger: string;
  colorOnAccent: string;
  shadowCard: string;
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
  colorBackground: "36 20% 5%",
  colorSurface: "34 17% 8%",
  colorSurfaceAlt: "36 17% 11%",
  colorBorder: "35 15% 16%",
  colorText: "37 50% 94%",
  colorTextMuted: "38 24% 72%",
  colorAccent: "7 71% 57%",
  colorAccentSoft: "15 31% 18%",
  colorDanger: "0 81% 66%",
  colorOnAccent: "0 0% 100%",
  shadowCard: "0 10px 30px rgba(0, 0, 0, 0.35)",
};

export const lightTheme: ThemeTokens = {
  bgCanvas: "0 0% 100%",
  bgSurface: "258 60% 97%",
  surfaceElevated: "260 40% 92%",
  textPrimary: "261 40% 18%",
  textSecondary: "262 20% 38%",
  accentPrimary: "268 85% 58%",
  cardBorder: "260 28% 80%",
  colorBackground: "45 22% 96%",
  colorSurface: "0 0% 100%",
  colorSurfaceAlt: "38 24% 93%",
  colorBorder: "40 21% 86%",
  colorText: "33 17% 10%",
  colorTextMuted: "34 14% 32%",
  colorAccent: "7 60% 45%",
  colorAccentSoft: "13 63% 92%",
  colorDanger: "0 61% 54%",
  colorOnAccent: "0 0% 100%",
  shadowCard: "0 10px 30px rgba(31, 27, 22, 0.08)",
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
