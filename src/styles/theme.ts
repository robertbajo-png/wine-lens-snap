export type Theme = {
  color: {
    background: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    text: string;
    textMuted: string;
    accent: string;
    accentSoft: string;
    danger: string;
  };
  radius: {
    card: string;
    button: string;
    chip: string;
  };
  shadow: {
    card: string;
    bottomNav: string;
  };
  fontSize: {
    title: string;
    subtitle: string;
    body: string;
    caption: string;
  };
};

export type ThemeKeys = keyof Theme;

export const lightTheme: Theme = {
  color: {
    background: "#F8F7F4",
    surface: "#FFFFFF",
    surfaceAlt: "#F2EFEA",
    border: "#E2DDD3",
    text: "#1F1B16",
    textMuted: "#5C5245",
    accent: "#B63E2E",
    accentSoft: "#F7E2DC",
    danger: "#D14343",
  },
  radius: {
    card: "16px",
    button: "12px",
    chip: "999px",
  },
  shadow: {
    card: "0 10px 30px rgba(31, 27, 22, 0.08)",
    bottomNav: "0 -4px 20px rgba(31, 27, 22, 0.12)",
  },
  fontSize: {
    title: "24px",
    subtitle: "18px",
    body: "16px",
    caption: "14px",
  },
};

export const darkTheme: Theme = {
  color: {
    background: "#0F0D0A",
    surface: "#181511",
    surfaceAlt: "#221E18",
    border: "#2F2A23",
    text: "#F7F1E7",
    textMuted: "#C9BCA6",
    accent: "#E05845",
    accentSoft: "#3B261F",
    danger: "#EF6464",
  },
  radius: {
    card: "16px",
    button: "12px",
    chip: "999px",
  },
  shadow: {
    card: "0 10px 30px rgba(0, 0, 0, 0.35)",
    bottomNav: "0 -4px 20px rgba(0, 0, 0, 0.45)",
  },
  fontSize: {
    title: "24px",
    subtitle: "18px",
    body: "16px",
    caption: "14px",
  },
};
