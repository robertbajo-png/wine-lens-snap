import { Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface HistorySummaryProps {
  total: number;
  lastRelative?: string;
  lastAbsolute?: string;
  regionsCount: number;
  isLoading?: boolean;
}

const SummarySkeletonItem = () => (
  <div className="rounded-2xl border border-theme-card bg-theme-elevated p-5 shadow-inner shadow-black/5">
    <Skeleton className="h-3 w-32 rounded-full bg-white/10" />
    <Skeleton className="mt-4 h-9 w-16 rounded-xl bg-white/10" />
    <Skeleton className="mt-3 h-4 w-full rounded-lg bg-white/10" />
  </div>
);

export const HistorySummarySkeleton = () => (
  <Card className="border border-theme-card bg-theme-elevated shadow-xl shadow-purple-900/10 backdrop-blur">
    <CardHeader className="space-y-4 pb-0">
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 rounded-2xl bg-[#B095FF]/20" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48 rounded-lg bg-white/10" />
          <Skeleton className="h-4 w-72 max-w-full rounded-lg bg-white/10" />
        </div>
      </div>
    </CardHeader>
    <CardContent className="pb-6">
      <div className="grid gap-4 pt-4 sm:grid-cols-3">
        <SummarySkeletonItem />
        <SummarySkeletonItem />
        <SummarySkeletonItem />
      </div>
    </CardContent>
  </Card>
);

const HistorySummary = ({
  total,
  lastRelative,
  lastAbsolute,
  regionsCount,
  isLoading,
}: HistorySummaryProps) => {
  if (isLoading) {
    return <HistorySummarySkeleton />;
  }

  return (
    <Card className="border border-theme-card bg-theme-elevated shadow-xl shadow-purple-900/10 backdrop-blur">
      <CardHeader className="space-y-4 pb-0">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl border border-transparent bg-[#B095FF]/10 p-2 text-[#B095FF] shadow-inner shadow-purple-500/30">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-3xl font-semibold text-theme-primary">Dina vinminnen</CardTitle>
            <CardDescription className="max-w-2xl text-base text-theme-secondary">
              Utforska dina tidigare analyser, upptäck favoriter och hoppa snabbt tillbaka in i WineSnap.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-6">
        <div className="grid gap-4 pt-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-theme-card bg-theme-elevated p-5 shadow-inner shadow-black/5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-theme-secondary">Totalt sparade</p>
            <p className="mt-3 text-3xl font-semibold text-theme-primary">{total}</p>
            <p className="text-sm text-theme-secondary">Alla analyser finns sparade lokalt på din enhet.</p>
          </div>
          <div className="rounded-2xl border border-theme-card bg-theme-elevated p-5 shadow-inner shadow-black/5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-theme-secondary">Senaste analys</p>
            <p className="mt-3 text-lg font-semibold text-theme-primary">{lastRelative ?? "–"}</p>
            <p className="text-sm text-theme-secondary">
              {lastAbsolute ?? "Gör en skanning för att komma igång."}
            </p>
          </div>
          <div className="rounded-2xl border border-theme-card bg-theme-elevated p-5 shadow-inner shadow-black/5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-theme-secondary">Ursprung representerade</p>
            <p className="mt-3 text-3xl font-semibold text-theme-primary">{regionsCount}</p>
            <p className="text-sm text-theme-secondary">Ett smakbibliotek fyllt av olika regioner.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HistorySummary;
