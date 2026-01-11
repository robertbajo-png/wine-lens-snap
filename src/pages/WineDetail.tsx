import { Suspense, lazy, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCachedAnalysisEntryByKey, type CachedWineAnalysisEntry } from "@/lib/wineCache";
import { AmbientBackground } from "@/components/AmbientBackground";
import ResultHeader from "@/components/result/ResultHeader";
import MetersRow from "@/components/result/MetersRow";
import ClampTextCard from "@/components/result/ClampTextCard";
import { WineListsPanel } from "@/components/result/WineListsPanel";
import { useAuth } from "@/auth/AuthProvider";
import { normalizeEvidenceItems } from "@/lib/evidence";
import { useTranslation } from "@/hooks/useTranslation";

const KeyFacts = lazy(() => import("@/components/result/KeyFacts"));
const Pairings = lazy(() => import("@/components/result/Pairings"));
const ServingCard = lazy(() => import("@/components/result/ServingCard"));
const EvidenceAccordion = lazy(() => import("@/components/result/EvidenceAccordion"));

const LazySectionFallback = ({ className = "" }: { className?: string }) => (
  <div
    className={`w-full min-h-[120px] rounded-2xl border border-theme-card bg-theme-elevated/60 animate-pulse ${className}`}
  />
);

const WineDetail = () => {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [entry, setEntry] = useState<CachedWineAnalysisEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!scanId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    // Try to find the entry in local cache by key
    const cached = getCachedAnalysisEntryByKey(scanId);
    if (cached) {
      setEntry(cached);
      setLoading(false);
      return;
    }

    // Not found in local cache
    setNotFound(true);
    setLoading(false);
  }, [scanId]);


  const handleBack = () => {
    navigate(-1);
  };

  const handleNewScan = () => {
    navigate("/scan");
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-theme-secondary">
        {t("wineDetail.loading")}
      </div>
    );
  }

  if (notFound || !entry) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-theme-secondary text-avoid-break sm:text-base">
            {t("wineDetail.notFoundLabel")}
          </p>
          <h1 className="text-2xl font-semibold text-theme-primary text-wrap-balance text-avoid-break sm:text-3xl md:text-4xl">
            {t("wineDetail.notFoundTitle")}
          </h1>
          <p className="text-theme-secondary text-avoid-break sm:text-lg">
            {t("wineDetail.notFoundDesc")}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            onClick={handleBack}
            variant="secondary"
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("wineDetail.back")}
          </Button>
          <Button
            onClick={handleNewScan}
            size="lg"
          >
            {t("wineDetail.scanNewWine")}
          </Button>
        </div>
      </div>
    );
  }

  const results = entry.result;
  const pairings = results.passar_till ?? results.food_pairings ?? [];
  const evidenceHits = normalizeEvidenceItems({
    evidence: results.evidence,
    sourceStatus: results.källstatus,
    ocrText: entry.ocrText ?? results.originaltext ?? results.vin ?? null,
    sources: results.sources,
  });
  const ocrText = entry.ocrText ?? results.evidence?.etiketttext ?? results.originaltext;
  const sourceType: "label" | "web" = results.källstatus?.source === "web" ? "web" : "label";

  return (
    <div className="relative min-h-screen pb-24">
      <AmbientBackground />

      {/* Back button */}
      <div className="fixed left-4 top-4 z-50">
        <Button
          onClick={handleBack}
          variant="secondary"
          size="icon"
          className="backdrop-blur-sm"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <div className="relative z-10 mx-auto max-w-2xl space-y-6 px-4 pt-20 pb-8">
        {/* Header */}
        <ResultHeader
          vin={results.vin}
          land_region={results.land_region}
          ar={results.årgång}
          producent={results.producent}
          typ={results.typ}
          evidenceItems={evidenceHits}
          sourceType={sourceType}
        />

        {/* Wine Lists Panel - only for logged in users */}
        {user && entry.remoteId && (
          <WineListsPanel
            scanId={entry.remoteId}
            ensureScanId={async () => entry.remoteId ?? null}
            isPersistingScan={false}
          />
        )}

        {/* Meters */}
        {results.meters && (
          <MetersRow
            meters={results.meters}
            estimated={results._meta?.meters_source !== "web"}
          />
        )}


        {/* Key Facts */}
        <Suspense fallback={<LazySectionFallback className="min-h-[180px]" />}>
          <KeyFacts
            druvor={results.druvor}
            fargtyp={results.färgtyp}
            klassificering={results.klassificering}
            alkoholhalt={results.alkoholhalt}
            volym={results.volym}
            sockerhalt={results.sockerhalt}
            syra={results.syra}
            evidenceItems={evidenceHits}
            sourceType={sourceType}
          />
        </Suspense>

        {/* Character */}
        {results.karaktär && (
          <ClampTextCard titleKey="wineDetail.character" text={results.karaktär} lines={4} />
        )}

        {/* Taste */}
        {results.smak && (
          <ClampTextCard titleKey="wineDetail.taste" text={results.smak} lines={4} />
        )}

        {/* Pairings */}
        {pairings.length > 0 && (
          <Suspense fallback={<LazySectionFallback className="min-h-[140px]" />}>
            <Pairings items={pairings} />
          </Suspense>
        )}

        {/* Serving */}
        {results.servering && (
          <Suspense fallback={<LazySectionFallback className="min-h-[140px]" />}>
            <ServingCard servering={results.servering} />
          </Suspense>
        )}

        {/* Evidence */}
        <Suspense fallback={<LazySectionFallback className="min-h-[160px]" />}>
          <EvidenceAccordion ocr={ocrText} hits={evidenceHits} primary={results.källa} />
        </Suspense>

        {/* Image preview */}
        {entry.imageData && (
          <div className="overflow-hidden rounded-3xl border border-theme-card bg-theme-elevated/60 backdrop-blur-sm">
            <img
              src={entry.imageData}
              alt={t("wineDetail.labelAlt")}
              className="w-full object-contain"
              style={{ maxHeight: "300px" }}
            />
          </div>
        )}

        {/* New scan button */}
        <div className="flex justify-center pt-4">
          <Button
            onClick={handleNewScan}
            size="lg"
            className="gap-2"
          >
            <Camera className="h-5 w-5" />
            {t("wineDetail.scanNew")}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WineDetail;
