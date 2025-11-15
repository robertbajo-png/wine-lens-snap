import { useEffect, useState } from "react";

function readStoredValue<T>(key: string, defaultValue: T): T {
  if (typeof window === "undefined") {
    return defaultValue;
  }

  const storedValue = window.localStorage.getItem(key);
  if (!storedValue) {
    return defaultValue;
  }

  try {
    return JSON.parse(storedValue) as T;
  } catch (error) {
    console.warn(`[useLocalSetting] Failed to parse localStorage value for "${key}"`, error);
    return defaultValue;
  }
}

export const useLocalSetting = <T,>(key: string, defaultValue: T) => {
  const [value, setValue] = useState<T>(() => readStoredValue(key, defaultValue));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`[useLocalSetting] Failed to persist "${key}"`, error);
    }
  }, [key, value]);

  return [value, setValue] as const;
};
