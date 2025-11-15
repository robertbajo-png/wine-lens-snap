import { useCallback } from "react";

const supportsVibration = () => typeof window !== "undefined" && "vibrate" in window.navigator;

export const useHapticFeedback = (pattern: number | number[] = 20) => {
  return useCallback(() => {
    if (!supportsVibration()) {
      return;
    }

    try {
      window.navigator.vibrate?.(pattern);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("[useHapticFeedback] Haptics unavailable", error);
      }
    }
  }, [pattern]);
};

export default useHapticFeedback;
