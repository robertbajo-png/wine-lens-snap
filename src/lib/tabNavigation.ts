import { isPlayRC } from "@/lib/releaseChannel";

export type TabKey = "for-you" | "explore" | "scan" | "following" | "profile";

export type TabDefinition = {
  key: TabKey;
  label: string;
  path: string;
};

const BASE_TAB_DEFINITIONS: TabDefinition[] = [
  { key: "for-you", label: "För dig", path: "/for-you" },
  { key: "explore", label: "Utforska", path: "/explore" },
  { key: "scan", label: "Skanna", path: "/scan" },
  { key: "following", label: "Följer", path: "/following" },
  { key: "profile", label: "Profil", path: "/me" },
];

export const TAB_DEFINITIONS: TabDefinition[] = BASE_TAB_DEFINITIONS.filter(
  (tab) => !(isPlayRC && tab.key === "following"),
);

export const matchTabKey = (pathname: string): TabKey | null => {
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;

  const matched = TAB_DEFINITIONS.find(
    (tab) => normalized === tab.path || normalized.startsWith(`${tab.path}/`),
  );

  return matched?.key ?? null;
};

export const isTabRootPath = (pathname: string): boolean => {
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return TAB_DEFINITIONS.some((tab) => tab.path === normalized);
};

export const getDefaultTabPath = (key: TabKey): string => {
  const tab = TAB_DEFINITIONS.find((definition) => definition.key === key);
  return tab?.path ?? "/for-you";
};
