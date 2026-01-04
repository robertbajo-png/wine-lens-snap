import { useNavigate } from "react-router-dom";
import { ExternalLink, Share2, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { CachedWineAnalysisEntry } from "@/lib/wineCache";
import { useTranslation } from "@/hooks/useTranslation";

interface WineCardProps {
  entry: CachedWineAnalysisEntry;
  formatDate: (iso: string) => string;
  formatRelativeTime: (iso: string) => string;
  onShare: (entry: CachedWineAnalysisEntry) => void | Promise<void>;
  onRemove: (key: string) => void;
}

export const WineCardSkeleton = () => (
  <Card className="border border-theme-card bg-theme-elevated shadow-2xl shadow-purple-900/20 backdrop-blur">
    <CardContent className="flex gap-4 p-5">
      <Skeleton className="h-28 w-28 rounded-2xl bg-white/10" />
      <div className="flex flex-1 flex-col gap-4">
        <div className="space-y-3">
          <Skeleton className="h-5 w-48 rounded-lg bg-white/10" />
          <Skeleton className="h-4 w-64 rounded-lg bg-white/10" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-7 w-20 rounded-full bg-white/10" />
          <Skeleton className="h-7 w-24 rounded-full bg-white/10" />
          <Skeleton className="h-7 w-16 rounded-full bg-white/10" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-full bg-white/10" />
          <Skeleton className="h-9 w-20 rounded-full bg-white/10" />
          <Skeleton className="h-9 w-24 rounded-full bg-white/10" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const WineCard = ({ entry, formatDate, formatRelativeTime, onShare, onRemove }: WineCardProps) => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const classificationTags = [
    { label: t("wineCard.colorLabel"), value: entry.result.färgtyp },
    { label: t("wineCard.tasteTypeLabel"), value: entry.result.typ },
    { label: t("wineCard.originLabel"), value: entry.result.land_region },
  ].filter((tag) => tag.value);

  const pairings = (entry.result.passar_till ?? []).slice(0, 2);

  const displayTitle = entry.result.vin || t("wineCard.unknownWine");
  const displaySubtitle = [
    entry.result.land_region,
    entry.result.årgång ? `${t("history.vintage")} ${entry.result.årgång}` : null,
  ]
    .filter(Boolean)
    .join(" • ");

  const handleOpenDetails = () => {
    navigate(`/wine/${entry.key}`);
  };

  return (
    <Card className="border border-theme-card bg-theme-elevated shadow-2xl shadow-purple-900/20 transition hover:-translate-y-[2px] hover:shadow-purple-900/40 backdrop-blur">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:gap-6">
        <div className="relative h-40 w-full overflow-hidden rounded-3xl border border-theme-card bg-black/20 shadow-inner shadow-black/30 sm:h-32 sm:w-32">
          {entry.imageData ? (
            <img
              src={entry.imageData}
              alt={displayTitle}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-theme-secondary">
              {t("wineCard.noImage")}
            </div>
          )}
          <div className="absolute bottom-2 left-2 rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-theme-primary">
            {formatRelativeTime(entry.timestamp)}
          </div>
          {entry.syncReady && !entry.remoteId && (
            <Badge
              variant="outline"
              className="absolute right-2 top-2 rounded-full border-amber-500/60 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-100"
            >
              {t("wineCard.notSynced")}
            </Badge>
          )}
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <h3 className="truncate text-2xl font-semibold text-theme-primary" title={displayTitle}>
                {displayTitle}
              </h3>
              {displaySubtitle && (
                <p className="text-sm text-theme-secondary" title={displaySubtitle}>
                  {displaySubtitle}
                </p>
              )}
            </div>
            <time className="text-xs text-theme-secondary/80" dateTime={entry.timestamp}>
              {formatDate(entry.timestamp)}
            </time>
          </div>

          {(classificationTags.length > 0 || pairings.length > 0) && (
            <div className="flex flex-wrap gap-2">
              {classificationTags.map((tag) => (
                <span
                  key={tag.label}
                  className="inline-flex items-center gap-2 rounded-full border border-theme-card bg-theme-elevated px-3 py-1 text-xs text-[#D4C5FF]"
                >
                  <span className="text-[10px] uppercase tracking-[0.35em] text-[#B095FF]/70">{tag.label}</span>
                  <span className="font-semibold text-theme-primary">{tag.value}</span>
                </span>
              ))}
              {pairings.map((pairing) => (
                <span
                  key={pairing}
                  className="inline-flex items-center rounded-full border border-theme-card bg-theme-elevated px-3 py-1 text-xs text-theme-primary"
                >
                  {pairing}
                </span>
              ))}
            </div>
          )}

          <Separator className="border-theme-card" />

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={handleOpenDetails}
              className="gap-2 rounded-full bg-theme-elevated px-4 py-2 text-sm font-semibold text-theme-primary shadow-sm transition hover:bg-[hsl(var(--surface-elevated)/0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B095FF] focus-visible:ring-offset-2 focus-visible:ring-offset-theme-elevated"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              {t("wineCard.open")}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => onShare(entry)}
              className="gap-2 rounded-full border-theme-card bg-theme-elevated px-4 py-2 text-sm font-semibold text-theme-primary transition hover:bg-[hsl(var(--surface-elevated)/0.85)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B095FF] focus-visible:ring-offset-2 focus-visible:ring-offset-theme-elevated"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              {t("wineCard.share")}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => onRemove(entry.key)}
              className="gap-2 rounded-full border-destructive/60 bg-theme-elevated px-4 py-2 text-sm font-semibold text-destructive transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-theme-elevated"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t("wineCard.deleteLocally")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WineCard;
