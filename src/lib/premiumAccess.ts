const STORAGE_KEY = "winesnap_free_scan_usage";
const FREE_DAILY_SCAN_LIMIT = 3;

type FreeScanUsage = {
  date: string;
  count: number;
};

const todayKey = () => new Date().toISOString().slice(0, 10);

const readUsage = (): FreeScanUsage => {
  if (typeof window === "undefined" || !window.localStorage) {
    return { date: todayKey(), count: 0 };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { date: todayKey(), count: 0 };

    const parsed = JSON.parse(raw) as FreeScanUsage;
    if (!parsed?.date || typeof parsed.count !== "number") {
      return { date: todayKey(), count: 0 };
    }

    if (parsed.date !== todayKey()) {
      return { date: todayKey(), count: 0 };
    }

    return { date: parsed.date, count: Math.max(0, Math.floor(parsed.count)) };
  } catch (error) {
    console.warn("Kunde inte läsa gratis-skanningar", error);
    return { date: todayKey(), count: 0 };
  }
};

export const getFreeScanUsage = () => {
  const usage = readUsage();
  return {
    ...usage,
    limit: FREE_DAILY_SCAN_LIMIT,
    remaining: Math.max(0, FREE_DAILY_SCAN_LIMIT - usage.count),
  };
};

export const incrementFreeScanUsage = () => {
  if (typeof window === "undefined" || !window.localStorage) return;

  const usage = readUsage();
  const next: FreeScanUsage = {
    date: todayKey(),
    count: Math.min(FREE_DAILY_SCAN_LIMIT + 1, usage.count + 1),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn("Kunde inte spara gratis-skanningar", error);
  }
};

export const resetFreeScanUsage = () => {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Kunde inte nollställa gratis-skanningar", error);
  }
};

export const FREE_SCAN_LIMIT_PER_DAY = FREE_DAILY_SCAN_LIMIT;
