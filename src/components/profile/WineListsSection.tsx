import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { fetchWineListsWithItems, removeScanFromList, type WineListDetail } from "@/services/wineLists";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";

const formatRelativeTime = (iso: string, locale: string, unknownTimeLabel: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return unknownTimeLabel;
  }

  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 1000 * 60 * 60 * 24 * 365],
    ["month", 1000 * 60 * 60 * 24 * 30],
    ["week", 1000 * 60 * 60 * 24 * 7],
    ["day", 1000 * 60 * 60 * 24],
    ["hour", 1000 * 60 * 60],
    ["minute", 1000 * 60],
  ];

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  for (const [unit, unitMs] of units) {
    if (absMs >= unitMs || unit === "minute") {
      const value = Math.round(diffMs / unitMs);
      return rtf.format(value, unit);
    }
  }

  return locale === "en" ? "just now" : "nyss";
};

const MAX_ITEMS_PER_LIST = 6;

type RemovalState = Record<string, boolean>;

export const WineListsSection = () => {
  const { toast } = useToast();
  const { t, locale } = useTranslation();
  const [lists, setLists] = useState<WineListDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState<RemovalState>({});

  const loadLists = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchWineListsWithItems();
      setLists(data.filter((list) => list.items.length > 0));
    } catch (error) {
      console.error("Failed to fetch wine lists", error);
      toast({
        title: t("wineLists.couldNotLoad"),
        description: t("common.retry"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const visibleLists = lists;
  const hasLists = visibleLists.length > 0;

  const handleRemove = useCallback(
    async (listId: string, scanId: string) => {
      const key = `${listId}:${scanId}`;
      setRemoving((prev) => ({ ...prev, [key]: true }));
      try {
        await removeScanFromList(listId, scanId);
        toast({
          title: t("wineLists.wineRemoved"),
          description: t("wineLists.listUpdated"),
        });
        await loadLists();
      } catch (error) {
        console.error("Failed to remove list item", error);
        toast({
          title: t("wineLists.couldNotRemove"),
          description: error instanceof Error ? error.message : t("common.retry"),
          variant: "destructive",
        });
      } finally {
        setRemoving((prev) => ({ ...prev, [key]: false }));
      }
    },
    [loadLists, toast],
  );

  const headerAction = useMemo(
    () => (
      <Button
        size="sm"
        variant="ghost"
        className="gap-2 text-theme-secondary hover:text-theme-primary"
        onClick={() => void loadLists()}
        disabled={loading}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {t("history.refresh")}
      </Button>
    ),
    [loadLists, loading],
  );

  return (
    <Card className="border-theme-card/80 bg-theme-elevated/80 backdrop-blur">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="break-words text-theme-primary">{t("wineLists.myLists")}</CardTitle>
          </div>
          <CardDescription className="text-theme-secondary">
            {t("wineLists.onlyShowNonEmpty")}
          </CardDescription>
        </div>
        {headerAction}
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasLists && !loading ? (
          <div className="rounded-xl border border-dashed border-theme-card/70 p-6 text-center text-sm text-theme-secondary">
            {t("wineLists.emptyHint")}
          </div>
        ) : null}

        {loading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl bg-theme-card/50" />
            ))}
          </div>
        ) : null}

        {hasLists ? (
          <div className="space-y-4">
            {visibleLists.map((list) => {
              const items = list.items.slice(0, MAX_ITEMS_PER_LIST);
              const hiddenCount = list.items.length - items.length;
              return (
                <div
                  key={list.id}
                  className="rounded-2xl border border-theme-card/80 bg-theme-canvas/40 p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-base font-semibold text-theme-primary">{list.name}</p>
                      <p className="text-sm text-theme-secondary">{t("history.savedWines", { count: list.itemCount })}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className="whitespace-normal border-theme-card bg-theme-elevated text-theme-secondary"
                    >
                      {list.itemCount} {t("wineLists.countSuffix")}
                    </Badge>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {items.map((item) => {
                      const key = `${list.id}:${item.scanId}`;
                      const wine = item.wine;
                      return (
                        <div
                          key={key}
                          className="flex gap-3 rounded-xl border border-theme-card/60 bg-theme-elevated/40 p-3"
                        >
                          <div
                            className={cn(
                              "h-16 w-16 overflow-hidden rounded-lg border border-theme-card/70 bg-black/30",
                              !item.imageThumb && "flex items-center justify-center text-[10px] text-theme-secondary",
                            )}
                          >
                            {item.imageThumb ? (
                              <img src={item.imageThumb} alt={wine?.vin ?? t("wineLists.savedLabel")} className="h-full w-full object-cover" />
                            ) : (
                              <span>{t("forYou.noImage")}</span>
                            )}
                          </div>
                          <div className="flex flex-1 flex-col gap-2">
                            <div>
                              <p className="text-sm font-semibold text-theme-primary">{wine?.vin ?? t("wineLists.unknownWine")}</p>
                              <p className="text-xs text-theme-secondary">{wine?.producent ?? t("wineLists.missingProducer")}</p>
                              <p className="text-xs text-theme-secondary">{wine?.land_region ?? t("wineLists.missingRegion")}</p>
                            </div>
                            <div className="flex items-center justify-between text-xs text-theme-secondary">
                              <span>{formatRelativeTime(item.createdAt, locale, t("history.unknownTime"))}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-theme-secondary hover:text-destructive"
                                onClick={() => void handleRemove(list.id, item.scanId)}
                                disabled={removing[key]}
                                aria-label={t("wineLists.removeFromList")}
                              >
                                {removing[key] ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {hiddenCount > 0 ? (
                    <p className="mt-3 text-xs text-theme-secondary">
                      {t("wineLists.hiddenCount", { count: hiddenCount })}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};
