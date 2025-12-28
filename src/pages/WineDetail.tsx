import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCachedAnalysisEntryByKey, type CachedWineAnalysisEntry } from "@/lib/wineCache";
import { AmbientBackground } from "@/components/AmbientBackground";
import ResultHeader from "@/components/result/ResultHeader";
import MetersRow from "@/components/result/MetersRow";
import KeyFacts from "@/components/result/KeyFacts";
import ClampTextCard from "@/components/result/ClampTextCard";
import Pairings from "@/components/result/Pairings";
import ServingCard from "@/components/result/ServingCard";
import EvidenceAccordion from "@/components/result/EvidenceAccordion";
import { WineListsPanel } from "@/components/result/WineListsPanel";
import { useAuth } from "@/auth/AuthProvider";

const WineDetail = () => {
  const { scanId } = useParams<{ scanId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
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
        Laddar vindetaljer...
      </div>
    );
  }

  if (notFound || !entry) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-[0.2em] text-theme-secondary">Vin ej hittat</p>
          <h1 className="text-2xl font-semibold text-theme-primary">Kunde inte hitta vinet</h1>
          <p className="text-theme-secondary">
            Det här vinet finns inte längre i din lokala historik.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            onClick={handleBack}
            variant="ghost"
            className="gap-2 rounded-full border border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated/80"
          >
            <ArrowLeft className="h-4 w-4" />
            Tillbaka
          </Button>
          <Button
            onClick={handleNewScan}
            className="rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#B095FF] px-6 text-theme-primary shadow-[0_18px_45px_-18px_rgba(123,63,228,1)]"
          >
            Skanna ett nytt vin
          </Button>
        </div>
      </div>
    );
  }

  const results = entry.result;
  const pairings = results.passar_till ?? results.food_pairings ?? [];
  const evidenceHits = results.källstatus?.evidence_links ?? results.evidence?.webbträffar ?? [];
  const ocrText = entry.ocrText ?? results.evidence?.etiketttext ?? results.originaltext;

  return (
    <div className="relative min-h-screen pb-24">
      <AmbientBackground />

      {/* Back button */}
      <div className="fixed left-4 top-4 z-50">
        <Button
          onClick={handleBack}
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full border border-theme-card bg-theme-elevated/90 text-theme-primary backdrop-blur-sm hover:bg-theme-elevated"
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
        <KeyFacts
          druvor={results.druvor}
          fargtyp={results.färgtyp}
          klassificering={results.klassificering}
          alkoholhalt={results.alkoholhalt}
          volym={results.volym}
          sockerhalt={results.sockerhalt}
          syra={results.syra}
        />

        {/* Character */}
        {results.karaktär && (
          <ClampTextCard title="Karaktär" text={results.karaktär} lines={4} />
        )}

        {/* Taste */}
        {results.smak && (
          <ClampTextCard title="Smak" text={results.smak} lines={4} />
        )}

        {/* Pairings */}
        {pairings.length > 0 && <Pairings items={pairings} />}

        {/* Serving */}
        {results.servering && <ServingCard servering={results.servering} />}

        {/* Evidence */}
        <EvidenceAccordion ocr={ocrText} hits={evidenceHits} primary={results.källa} />

        {/* Image preview */}
        {entry.imageData && (
          <div className="overflow-hidden rounded-3xl border border-theme-card bg-theme-elevated/60 backdrop-blur-sm">
            <img
              src={entry.imageData}
              alt="Etikett"
              className="w-full object-contain"
              style={{ maxHeight: "300px" }}
            />
          </div>
        )}

        {/* New scan button */}
        <div className="flex justify-center pt-4">
          <Button
            onClick={handleNewScan}
            className="gap-2 rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#B095FF] px-8 py-3 text-theme-primary shadow-[0_18px_45px_-18px_rgba(123,63,228,1)]"
          >
            <Camera className="h-5 w-5" />
            Skanna nytt vin
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WineDetail;
