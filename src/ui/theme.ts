export type ThemeTokens = {
  bgCanvas: string;
  bgSurface: string;
  surfaceElevated: string;
  surfaceBase: string;
  surfaceCanvas: string;
  surfaceCard: string;
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
  shadowBottomNav: string;
  navActive: string;
  navInactive: string;
};

export type ThemeName = "dark" | "light";
export type ThemePreference = ThemeName | "system";

export const darkTheme: ThemeTokens = {
  bgCanvas: "262 52% 6%",
  bgSurface: "262 45% 11%",
  surfaceElevated: "261 42% 20%",
  surfaceBase: "36 20% 5%",
  surfaceCanvas: "34 17% 10%",
  surfaceCard: "36 17% 14%",
  textPrimary: "259 56% 96%",
  textSecondary: "260 34% 90%",
  accentPrimary: "271 86% 67%",
  cardBorder: "262 36% 34%",
  colorBackground: "36 20% 5%",
  colorSurface: "34 17% 10%",
  colorSurfaceAlt: "36 17% 14%",
  colorBorder: "35 15% 20%",
  colorText: "37 50% 95%",
  colorTextMuted: "38 30% 86%",
  colorAccent: "7 71% 57%",
  colorAccentSoft: "15 31% 18%",
  colorDanger: "0 81% 66%",
  colorOnAccent: "0 0% 100%",
  shadowCard: "0 10px 30px rgba(0, 0, 0, 0.35)",
  shadowBottomNav: "0 -4px 20px rgba(0, 0, 0, 0.45)",
  navActive: "271 86% 67%",
  navInactive: "260 40% 94%",
};

export const lightTheme: ThemeTokens = {
  bgCanvas: "0 0% 100%",
  bgSurface: "258 60% 97%",
  surfaceElevated: "260 38% 94%",
  surfaceBase: "44 24% 96%",
  surfaceCanvas: "0 0% 100%",
  surfaceCard: "36 26% 94%",
  textPrimary: "261 38% 16%",
  textSecondary: "262 20% 28%",
  accentPrimary: "268 85% 58%",
  cardBorder: "260 20% 72%",
  colorBackground: "45 22% 96%",
  colorSurface: "0 0% 100%",
  colorSurfaceAlt: "36 26% 94%",
  colorBorder: "260 18% 60%",
  colorText: "33 20% 12%",
  colorTextMuted: "34 14% 24%",
  colorAccent: "7 60% 45%",
  colorAccentSoft: "13 63% 92%",
  colorDanger: "0 61% 54%",
  colorOnAccent: "0 0% 100%",
  shadowCard: "0 10px 30px rgba(31, 27, 22, 0.08)",
  shadowBottomNav: "0 -4px 20px rgba(31, 27, 22, 0.12)",
  navActive: "268 85% 58%",
  navInactive: "262 20% 26%",
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
