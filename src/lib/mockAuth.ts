export const AUTH_STORAGE_KEY = "wineSnap:auth-state";

export type AuthState = "anonymous" | "authenticated";

type AuthChangeListener = (state: AuthState) => void;

export const readAuthState = (): AuthState => {
  if (typeof window === "undefined") return "anonymous";
  return window.localStorage.getItem(AUTH_STORAGE_KEY) === "authenticated" ? "authenticated" : "anonymous";
};

export const subscribeToAuthState = (listener: AuthChangeListener) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === AUTH_STORAGE_KEY) {
      listener(readAuthState());
    }
  };

  const handleCustomEvent = (event: Event) => {
    const customEvent = event as CustomEvent<AuthState | undefined>;
    if (customEvent.detail) {
      listener(customEvent.detail);
    } else {
      listener(readAuthState());
    }
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener("winesnap:auth-changed", handleCustomEvent as EventListener);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("winesnap:auth-changed", handleCustomEvent as EventListener);
  };
};
