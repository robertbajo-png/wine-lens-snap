export type ThemeTokens = {
  bgCanvas: string;
  bgSurface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  accentPrimary: string;
  cardBorder: string;
};

export const darkTheme: ThemeTokens = {
  bgCanvas: "262 52% 6%",
  bgSurface: "262 45% 10%",
  surfaceElevated: "261 42% 16%",
  textPrimary: "259 56% 95%",
  textSecondary: "260 28% 78%",
  accentPrimary: "271 86% 67%",
  cardBorder: "262 36% 28%",
};

const toCssVariableName = (token: keyof ThemeTokens) =>
  `--${token.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}`;

export const applyTheme = (tokens: ThemeTokens) => {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;

  (Object.keys(tokens) as (keyof ThemeTokens)[]).forEach(key => {
    const cssVariable = toCssVariableName(key);
    root.style.setProperty(cssVariable, tokens[key]);
  });

  document.body.classList.add("app-theme");
};
