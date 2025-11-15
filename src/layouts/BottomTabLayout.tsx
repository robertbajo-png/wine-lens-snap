import { useEffect, useRef, type CSSProperties } from "react";
import { Outlet, useLocation } from "react-router-dom";
import BottomTabBar from "@/components/navigation/BottomTabBar";
import { TabStateProvider, useTabStateContext } from "@/contexts/TabStateContext";
import { isTabRootPath, matchTabKey } from "@/lib/tabNavigation";
import { useToast } from "@/hooks/use-toast";

const EXIT_PROMPT_TIMEOUT = 2200;

const contentPadding: CSSProperties = {
  paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)",
};

const LayoutContent = () => {
  const location = useLocation();
  const { toast } = useToast();
  const { currentTab, stateMap, setTabState } = useTabStateContext();
  const previousTabRef = useRef(currentTab);
  const exitTimestampRef = useRef<number | null>(null);
  const skipNextPopRef = useRef(false);
  const currentPathRef = useRef(location.pathname);

  currentPathRef.current = location.pathname;

  useEffect(() => {
    if (!currentTab) {
      return;
    }

    const composedPath = `${location.pathname}${location.search}${location.hash}`;

    setTabState(currentTab, (prev) => ({
      ...prev,
      lastPath: composedPath,
    }));
  }, [currentTab, location.hash, location.pathname, location.search, setTabState]);

  useEffect(() => {
    if (!currentTab) {
      return;
    }

    const targetScroll = stateMap[currentTab]?.scrollTop ?? 0;

    if (previousTabRef.current !== currentTab) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: targetScroll, behavior: "auto" });
      });
    }

    previousTabRef.current = currentTab;
  }, [currentTab, stateMap]);

  useEffect(() => {
    if (!currentTab) {
      return;
    }

    const handleScroll = () => {
      setTabState(currentTab, (prev) => {
        const nextScroll = Math.max(window.scrollY, 0);
        if (prev.scrollTop === nextScroll) {
          return prev;
        }
        return {
          ...prev,
          scrollTop: nextScroll,
        };
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      handleScroll();
    };
  }, [currentTab, setTabState]);

  useEffect(() => {
    const ensureSentinel = () => {
      if (typeof window === "undefined") {
        return;
      }

      const state = window.history.state ?? {};
      if (!state.__winesnapSentinel) {
        window.history.replaceState({ ...state, __winesnapSentinel: true }, "", window.location.href);
        window.history.pushState({ __winesnapSentinel: true }, "", window.location.href);
      }
    };

    ensureSentinel();
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (skipNextPopRef.current) {
        skipNextPopRef.current = false;
        exitTimestampRef.current = null;
        return;
      }

      const leavingPath = currentPathRef.current;
      const leavingTab = matchTabKey(leavingPath);
      const isLeavingTabRoot = leavingTab ? isTabRootPath(leavingPath) : false;

      if (!isLeavingTabRoot) {
        exitTimestampRef.current = null;
        return;
      }

      const now = Date.now();

      if (exitTimestampRef.current && now - exitTimestampRef.current < EXIT_PROMPT_TIMEOUT) {
        exitTimestampRef.current = null;
        skipNextPopRef.current = true;
        window.history.back();
        return;
      }

      exitTimestampRef.current = now;

      toast({
        title: "Tryck igen för att avsluta",
        description: "Tryck tillbaka en gång till om du vill lämna WineSnap.",
        duration: EXIT_PROMPT_TIMEOUT,
      });

      window.history.pushState({ __winesnapSentinel: true }, "", leavingPath);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [toast]);

  return (
    <div className="flex min-h-screen flex-col bg-theme-canvas text-theme-secondary">
      <main className="flex-1" style={contentPadding}>
        <Outlet />
      </main>
      <BottomTabBar />
    </div>
  );
};

const BottomTabLayout = () => {
  const location = useLocation();
  const currentTab = matchTabKey(location.pathname);

  return (
    <TabStateProvider currentTab={currentTab}>
      <LayoutContent />
    </TabStateProvider>
  );
};

export default BottomTabLayout;
