import { memo, useCallback, useMemo, type ComponentType, type CSSProperties, type SVGProps } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  ExploreIcon,
  FollowingIcon,
  ForYouIcon,
  ProfileIcon,
  ScanIcon,
} from "./TabIcons";

type TabItem = {
  key: string;
  label: string;
  path: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

const tabs: TabItem[] = [
  { key: "for-you", label: "För dig", path: "/for-you", icon: ForYouIcon },
  { key: "explore", label: "Utforska", path: "/explore", icon: ExploreIcon },
  { key: "scan", label: "Skanna", path: "/scan", icon: ScanIcon },
  { key: "following", label: "Följer", path: "/following", icon: FollowingIcon },
  { key: "profile", label: "Profil", path: "/me", icon: ProfileIcon },
];

const BottomTabBar = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const activeKey = useMemo(() => {
    const current = tabs.find((tab) =>
      location.pathname === tab.path || location.pathname.startsWith(`${tab.path}/`),
    );
    return current?.key ?? null;
  }, [location.pathname]);

  const safeAreaPadding = useMemo<CSSProperties>(
    () => ({ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 0.75rem)` }),
    [],
  );

  const handleNavigate = useCallback(
    (path: string) => {
      if (location.pathname === path) {
        return;
      }

      if (typeof window !== "undefined" && "vibrate" in window.navigator) {
        try {
          window.navigator.vibrate?.(15);
        } catch (error) {
          console.warn("[BottomTabBar] Haptics unavailable", error);
        }
      }

      navigate(path);
    },
    [location.pathname, navigate],
  );

  return (
    <nav
      aria-label="Huvudnavigation"
      className="sticky bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-theme-elevated/80 py-3 backdrop-blur-lg"
      style={safeAreaPadding}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center justify-center px-4">
        <ul className="grid w-full grid-cols-5 items-end gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeKey === tab.key;

            if (tab.key === "scan") {
              return (
                <li key={tab.key} className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleNavigate(tab.path)}
                    className="group relative -translate-y-6 transform rounded-full border-4 border-theme-canvas bg-gradient-to-br from-[#7B3FE4] via-[#8451ED] to-[#B095FF] p-4 text-white shadow-[0_18px_45px_-20px_rgba(123,63,228,1)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B095FF] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    aria-label={tab.label}
                  >
                    <Icon className="h-7 w-7" aria-hidden="true" />
                    <span className="sr-only">{tab.label}</span>
                  </button>
                </li>
              );
            }

            return (
              <li key={tab.key} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => handleNavigate(tab.path)}
                  aria-label={tab.label}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-full px-3 py-2 text-[0.7rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B095FF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    isActive ? "text-theme-primary" : "text-theme-secondary/70",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

export default memo(BottomTabBar);
