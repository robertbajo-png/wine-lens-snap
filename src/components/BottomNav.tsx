import { memo, useCallback, useMemo, type ComponentType, type CSSProperties, type SVGProps } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/AuthProvider";
import { cn } from "@/lib/utils";
import {
  ExploreIcon,
  FollowingIcon,
  ForYouIcon,
  ProfileIcon,
  ScanIcon,
} from "@/components/navigation/TabIcons";
import { TAB_DEFINITIONS, getDefaultTabPath, type TabDefinition, type TabKey } from "@/lib/tabNavigation";
import { useTabStateContext } from "@/contexts/TabStateContext";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { trackEvent } from "@/lib/telemetry";
import { useFollowingFeedNotifications } from "@/hooks/useFollowingFeedNotifications";

const iconMap: Record<TabKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  "for-you": ForYouIcon,
  explore: ExploreIcon,
  scan: ScanIcon,
  following: FollowingIcon,
  profile: ProfileIcon,
};

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { stateMap } = useTabStateContext();
  const triggerHaptic = useHapticFeedback();
  const { user, loading } = useAuth();
  const { newPostsCount } = useFollowingFeedNotifications();

  const activeKey = useMemo(() => {
    const current = TAB_DEFINITIONS.find((tab) =>
      location.pathname === tab.path || location.pathname.startsWith(`${tab.path}/`),
    );
    return current?.key ?? null;
  }, [location.pathname]);

  const safeAreaPadding = useMemo<CSSProperties>(
    () => ({ paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 0.75rem)` }),
    [],
  );

  const handleNavigate = useCallback(
    (tab: TabDefinition) => {
      const targetState = stateMap[tab.key];
      const targetPath = targetState?.lastPath ?? getDefaultTabPath(tab.key);

      const isProfileTab = tab.key === "profile";

      if (isProfileTab) {
        if (loading) {
          return;
        }

        if (!user) {
          triggerHaptic();
          trackEvent("tab_select", {
            tab: tab.key,
            from: activeKey ?? undefined,
            targetPath,
            requiresAuth: true,
          });

          const params = new URLSearchParams();
          params.set("redirectTo", targetPath);
          navigate(`/login?${params.toString()}`);
          return;
        }
      }

      if (location.pathname === targetPath) {
        return;
      }

      triggerHaptic();
      trackEvent("tab_select", {
        tab: tab.key,
        from: activeKey ?? undefined,
        targetPath,
      });
      navigate(targetPath);
    },
    [activeKey, loading, location.pathname, navigate, stateMap, triggerHaptic, user],
  );

  return (
    <nav
      aria-label="Huvudnavigation"
      className="sticky bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-theme-elevated/80 py-3 backdrop-blur-lg"
      style={safeAreaPadding}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center justify-center px-4">
        <ul className="grid w-full grid-cols-5 items-end gap-1">
          {TAB_DEFINITIONS.map((tab) => {
            const Icon = iconMap[tab.key];
            const isActive = activeKey === tab.key;
            const tabState = stateMap[tab.key];
            const showProcessingIndicator = tab.key === "scan" && Boolean(tabState?.isProcessing);
            const scanStatusLabel = tab.key === "scan" ? tabState?.progressLabel ?? null : null;
            const scanAriaLabel =
              tab.key === "scan" && scanStatusLabel ? `${tab.label}. ${scanStatusLabel}` : tab.label;
            const showFollowingBadge = tab.key === "following" && newPostsCount > 0;
            const badgeLabel = showFollowingBadge ? (newPostsCount > 9 ? "9+" : `${newPostsCount}`) : null;
            const tabAriaLabel =
              tab.key === "following" && badgeLabel
                ? `${tab.label}. ${badgeLabel} nya poster`
                : tab.label;

            if (tab.key === "scan") {
              return (
                <li key={tab.key} className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleNavigate(tab)}
                    className="group relative -translate-y-6 transform rounded-full border-4 border-theme-canvas bg-gradient-to-br from-[#7B3FE4] via-[#8451ED] to-[#B095FF] p-4 text-white shadow-[0_18px_45px_-20px_rgba(123,63,228,1)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B095FF] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    aria-label={scanAriaLabel}
                  >
                    {showProcessingIndicator && (
                      <span className="absolute inset-0 -m-1.5 flex items-center justify-center">
                        <span className="h-12 w-12 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                      </span>
                    )}
                    <Icon className="h-7 w-7" aria-hidden="true" />
                    <span className="sr-only" aria-live="polite">
                      {scanStatusLabel ?? tab.label}
                    </span>
                  </button>
                </li>
              );
            }

            return (
              <li key={tab.key} className="flex justify-center">
                <button
                  type="button"
                  onClick={() => handleNavigate(tab)}
                  aria-label={tab.key === "scan" ? scanAriaLabel : tabAriaLabel}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-full px-3 py-2 text-[0.7rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B095FF]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
                    isActive ? "text-theme-primary" : "text-theme-secondary/70",
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  <span>{tab.label}</span>
                  {showFollowingBadge && badgeLabel ? (
                    <span className="absolute -top-1 right-2 inline-flex min-w-[1.25rem] translate-y-[-0.2rem] items-center justify-center rounded-full bg-[#FF4E88] px-1 py-0.5 text-[0.6rem] font-semibold leading-none text-white shadow-[0_10px_25px_-15px_rgba(255,78,136,1)]">
                      {badgeLabel}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};

export default memo(BottomNav);
