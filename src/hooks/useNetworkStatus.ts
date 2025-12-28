import { useEffect, useState } from "react";

const getOnlineStatus = () => (typeof navigator === "undefined" ? true : navigator.onLine !== false);

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState<boolean>(getOnlineStatus);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
  };
};

export default useNetworkStatus;
