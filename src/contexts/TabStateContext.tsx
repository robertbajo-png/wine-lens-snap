import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { TAB_DEFINITIONS, getDefaultTabPath, type TabKey } from "@/lib/tabNavigation";

type TabState = {
  scrollTop?: number;
  lastPath?: string;
  isProcessing?: boolean;
  progressLabel?: string | null;
};

type TabStateMap = Partial<Record<TabKey, TabState>>;

type TabStateContextValue = {
  currentTab: TabKey | null;
  stateMap: TabStateMap;
  setTabState: (key: TabKey, updater: TabState | ((prev: TabState) => TabState)) => void;
};

const TabStateContext = createContext<TabStateContextValue | null>(null);

const createInitialState = (): TabStateMap => {
  const initial: TabStateMap = {};
  for (const tab of TAB_DEFINITIONS) {
    initial[tab.key] = {
      scrollTop: 0,
      lastPath: tab.path,
      isProcessing: false,
      progressLabel: null,
    };
  }
  return initial;
};

const shallowEqual = (a: TabState, b: TabState) => {
  const keysA = Object.keys(a) as (keyof TabState)[];
  const keysB = Object.keys(b) as (keyof TabState)[];

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!Object.is(a[key], b[key])) {
      return false;
    }
  }

  return true;
};

type TabStateProviderProps = {
  currentTab: TabKey | null;
  children: ReactNode;
};

export const TabStateProvider = ({ currentTab, children }: TabStateProviderProps) => {
  const [stateMap, setStateMap] = useState<TabStateMap>(createInitialState);

  const setTabState = useCallback((key: TabKey, updater: TabState | ((prev: TabState) => TabState)) => {
    setStateMap((prev) => {
      const previousState = prev[key] ?? {
        scrollTop: 0,
        lastPath: getDefaultTabPath(key),
        isProcessing: false,
        progressLabel: null,
      };

      const nextState =
        typeof updater === "function"
          ? (updater as (state: TabState) => TabState)(previousState)
          : { ...previousState, ...updater };

      if (shallowEqual(previousState, nextState)) {
        return prev;
      }

      return {
        ...prev,
        [key]: nextState,
      };
    });
  }, []);

  const value = useMemo<TabStateContextValue>(
    () => ({
      currentTab,
      stateMap,
      setTabState,
    }),
    [currentTab, stateMap, setTabState],
  );

  return <TabStateContext.Provider value={value}>{children}</TabStateContext.Provider>;
};

export const useTabStateContext = () => {
  const context = useContext(TabStateContext);
  if (!context) {
    throw new Error("useTabStateContext must be used within a TabStateProvider");
  }
  return context;
};

export type { TabKey, TabState };
