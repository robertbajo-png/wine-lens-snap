const parseBoolean = (value: unknown, defaultValue: boolean): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "y", "on"].includes(normalized)) {
      return true;
    }
    if (["0", "false", "no", "n", "off"].includes(normalized)) {
      return false;
    }
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  return defaultValue;
};

export const getFeatureFlag = (flagName: string, defaultValue = false): boolean => {
  const envValue = import.meta.env?.[flagName as keyof ImportMetaEnv] as unknown;
  return parseBoolean(envValue, defaultValue);
};

export const isMarketplaceEnabled = () => getFeatureFlag("VITE_FEATURE_MARKETPLACE", false);
