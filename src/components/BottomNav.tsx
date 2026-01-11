import { memo, useCallback, useMemo, type ComponentType, type CSSProperties, type SVGProps } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { History } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { cn } from "@/lib/utils";
import {
  ExploreIcon,
  ForYouIcon,
  ProfileIcon,
  ScanIcon,
} from "@/components/navigation/TabIcons";
import { TAB_DEFINITIONS, getDefaultTabPath, type TabDefinition, type TabKey } from "@/lib/tabNavigation";
import { useTabStateContext } from "@/contexts/TabStateContext";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";
import { trackEvent } from "@/lib/telemetry";
import { useTranslation } from "@/hooks/useTranslation";

const HistoryIcon = (props: SVGProps<SVGSVGElement>) => <History {...props} />;

const iconMap: Record<TabKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  "for-you": ForYouIcon,
  explore: ExploreIcon,
  scan: ScanIcon,
  history: HistoryIcon,
  profile: ProfileIcon,
};

const tabLabelKeys: Record<TabKey, "nav.forYou" | "nav.explore" | "nav.scan" | "nav.history" | "nav.profile"> = {
  "for-you": "nav.forYou",
  explore: "nav.explore",
  scan: "nav.scan",
  history: "nav.history",
  profile: "nav.profile",
};

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { stateMap } = useTabStateContext();
  const triggerHaptic = useHapticFeedback();
  const { user, loading } = useAuth();
  const { t } = useTranslation();

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

  const gridTemplateColumns = useMemo<CSSProperties>(
    () => ({ gridTemplateColumns: `repeat(${TAB_DEFINITIONS.length}, minmax(0, 1fr))` }),
    [],
  );

  const handleNavigate = useCallback(
    (tab: TabDefinition) => {
      const targetState = stateMap[tab.key];
      const targetPath = targetState?.lastPath ?? getDefaultTabPath(tab.key);
      const label = t(tabLabelKeys[tab.key]);

      const requiresAuth = tab.key === "profile" || tab.key === "history";

      if (requiresAuth && !user && !loading) {
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

      // For scan tab, always allow action even if already on /scan (to start new scan)
      if (location.pathname === targetPath && tab.key !== "scan") {
        return;
      }

      triggerHaptic();
      trackEvent("tab_select", {
        tab: tab.key,
        from: activeKey ?? undefined,
        targetPath,
      });
      
      // For scan tab when already on /scan, pass state to trigger new scan
      if (tab.key === "scan" && location.pathname === targetPath) {
        navigate(targetPath, { state: { triggerNewScan: Date.now() } });
      } else {
        navigate(targetPath);
      }
    },
    [activeKey, loading, location.pathname, navigate, stateMap, t, triggerHaptic, user],
  );

  return (
    <nav
      aria-label={t("nav.forYou")}
      className="sticky bottom-0 left-0 right-0 z-40 border-t border-[var(--bottom-nav-border)] bg-[var(--bottom-nav-bg)] py-3 shadow-theme-bottom-nav backdrop-blur"
      style={safeAreaPadding}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center justify-center px-4">
        <ul className="grid w-full items-end gap-1" style={gridTemplateColumns}>
          {TAB_DEFINITIONS.map((tab) => {
            const Icon = iconMap[tab.key];
            const isActive = activeKey === tab.key;
            const tabState = stateMap[tab.key];
            const showProcessingIndicator = tab.key === "scan" && Boolean(tabState?.isProcessing);
            const label = t(tabLabelKeys[tab.key]);
            const scanStatusLabel = tab.key === "scan" ? tabState?.progressLabel ?? null : null;
            const scanAriaLabel =
              tab.key === "scan" && scanStatusLabel ? `${label}. ${scanStatusLabel}` : label;

            if (tab.key === "scan") {
              return (
                <li key={tab.key} className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleNavigate(tab)}
                    className="group relative -translate-y-4 transform rounded-full border-[3px] border-[var(--bottom-nav-bg)] bg-[hsl(var(--color-accent))] p-3 text-[hsl(var(--color-on-accent))] shadow-[0_16px_36px_-18px_hsl(var(--color-accent))] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-on-accent))] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bottom-nav-bg)]"
                    aria-label={scanAriaLabel}
                  >
                    {showProcessingIndicator && (
                      <span className="absolute inset-0 -m-1.5 flex items-center justify-center">
                        <span className="h-12 w-12 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
                      </span>
                    )}
                    <Icon className="h-6 w-6" aria-hidden="true" />
                    <span className="sr-only" aria-live="polite">
                      {scanStatusLabel ?? label}
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
                  aria-label={label}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-full px-3 py-2 text-[0.75rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--color-accent))]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bottom-nav-bg)]",
                    isActive
                      ? "text-[var(--bottom-nav-active)] drop-shadow-[0_6px_18px_rgba(0,0,0,0.24)]"
                      : "text-[var(--bottom-nav-inactive)] hover:text-[var(--bottom-nav-active)]",
                  )}
                >
                  <span className="relative inline-flex">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>{label}</span>
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
