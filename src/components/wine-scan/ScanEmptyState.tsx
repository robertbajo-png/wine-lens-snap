import { useState, type ReactNode } from "react";
import { ProgressBanner } from "@/components/ProgressBanner";
import ResultSkeleton from "@/components/result/ResultSkeleton";
import { ScanLoadingView } from "@/components/wine-scan/ScanLoadingView";
import { ManualLookupDialog } from "@/components/wine-scan/ManualLookupDialog";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BadgeProps } from "@/components/ui/badge";
import { Camera, Download, ImageUp, RefreshCcw, Search, Sparkles, Wine } from "lucide-react";
import heroWine from "@/assets/hero-wine.jpg";

type Step = "prep" | "ocr" | "analysis" | "done" | "error" | null;

interface ScanEmptyStateProps {
  banner: ReactNode;
  isInstallCTAVisible: boolean;
  onInstall: () => void;
  onNavigateHome: () => void;
  onNavigateProfile: () => void;
  onNavigateHistory: () => void;
  statusLabel: string;
  statusTone: BadgeProps["variant"];
  onRetryScan: () => void;
  onChangeImage: () => void;
  onTakePhoto: () => void;
  isProcessing: boolean;
  progressStep: Step;
  progressNote: string | null;
  progressPercent: number | null;
  progressLabel: string | null;
  previewImage: string | null;
  showError: boolean;
  scanLog?: ReactNode;
  /** Valfri callback – om satt visas "Sök manuellt"-knapp och dialog */
  onManualLookup?: (query: string) => Promise<void> | void;
}

/**
 * ScanEmptyState – lyxig scan-hemsida enligt ScentSnap-struktur, vin-färgad.
 * Hero-bild med veil + gradient-luxe-CTA + 01/02/03 how-it-works.
 * Behåller alla WineSnap-callbacks (pipeline-logik) intakta.
 */
export const ScanEmptyState = ({
  banner,
  isInstallCTAVisible,
  onInstall,
  onNavigateHistory,
  statusLabel,
  statusTone,
  onRetryScan,
  onChangeImage,
  onTakePhoto,
  isProcessing,
  progressStep,
  progressNote,
  progressPercent,
  progressLabel,
  previewImage,
  showError,
  scanLog,
  onManualLookup,
}: ScanEmptyStateProps) => {
  const showProgress = isProcessing || progressStep || progressNote || progressPercent !== null;
  const [lookupOpen, setLookupOpen] = useState(false);

  return (
    <AppShell>
      {/* Header: logo + historik-snabblänk */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wine className="h-5 w-5 text-primary" aria-hidden />
          <span className="font-display text-xl tracking-tight text-foreground">WineSnap</span>
        </div>
        <button
          type="button"
          onClick={onNavigateHistory}
          className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground transition hover:text-foreground"
        >
          Historik
        </button>
      </div>

      {/* Eyebrow + display-headline */}
      <section className="mt-8 text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-gold">
          <Sparkles className="mr-1 inline h-3 w-3" aria-hidden />
          AI-sommelier
        </p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-foreground text-wrap-balance">
          Skanna vinet,
          <br />
          <span className="italic text-primary">upptäck själen</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">
          Fota etiketten – AI levererar en komplett vinprofil med smaknoter, servering och matmatchningar.
        </p>
      </section>

      {banner && <div className="mt-5">{banner}</div>}

      {/* Hero eller preview */}
      <div className="relative mt-6">
        {previewImage ? (
          <ScanLoadingView
            previewImage={previewImage}
            isProcessing={isProcessing}
            progressStep={progressStep}
            progressNote={progressNote}
            progressPercent={progressPercent}
            progressLabel={progressLabel}
          />
        ) : (
          <div className="relative overflow-hidden rounded-3xl border border-border shadow-elegant">
            <img
              src={heroWine}
              alt="Rödvin i karaffstämning"
              width={1024}
              height={1280}
              className="aspect-[4/5] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-veil" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-gold/90">
                Sommelier i fickan
              </p>
              <p className="mt-1 font-display text-xl text-white">
                Fyll glaset med kunskap.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Status + progress */}
      {(isProcessing || showProgress) && !previewImage && (
        <div className="mt-5 rounded-3xl border border-border/60 bg-card/40 p-4 backdrop-blur">
          <ResultSkeleton />
        </div>
      )}

      {showProgress && previewImage && (
        <div className="mt-4">
          <ProgressBanner
            step={progressStep}
            note={progressNote}
            progress={progressPercent}
            label={progressLabel}
          />
        </div>
      )}

      {scanLog && <div className="mt-4">{scanLog}</div>}

      {/* Status-badge (diskret) */}
      <div className="mt-4 flex items-center justify-center gap-2">
        <Badge variant={statusTone} className="rounded-full">
          {statusLabel}
        </Badge>
      </div>

      {/* Error-kort */}
      {showError && (
        <Card className="mt-4 border-destructive/40 bg-card/80">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-foreground">
              <Wine className="h-5 w-5 text-destructive" aria-hidden />
              <p className="font-display text-lg">Något gick snett</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Kontrollera ljuset och prova igen. Du kan starta om eller välja en annan bild.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={onRetryScan} size="sm" className="rounded-full">
                <RefreshCcw className="mr-2 h-4 w-4" aria-hidden />
                Starta om
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onChangeImage}
                className="rounded-full"
              >
                <ImageUp className="mr-2 h-4 w-4" aria-hidden />
                Byt bild
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Primär-CTA */}
      {!previewImage && (
        <div className="mt-6 grid gap-3">
          <Button
            onClick={onTakePhoto}
            size="lg"
            disabled={isProcessing}
            className="h-14 rounded-2xl bg-gradient-luxe text-base font-medium text-primary-foreground shadow-elegant hover:opacity-90"
          >
            <Camera className="mr-2 h-5 w-5" aria-hidden />
            Fota vinetikett
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={onTakePhoto}
            disabled={isProcessing}
            className="h-14 rounded-2xl border-border bg-card/50 text-base font-medium backdrop-blur hover:bg-card"
          >
            <ImageUp className="mr-2 h-5 w-5" aria-hidden />
            Ladda upp bild
          </Button>
          {onManualLookup && (
            <button
              type="button"
              onClick={() => setLookupOpen(true)}
              className="mt-1 inline-flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground transition hover:text-foreground"
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
              Sök manuellt
            </button>
          )}
        </div>
      )}

      {/* Reset-actions när bild är laddad men inte processar */}
      {previewImage && !isProcessing && (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button variant="outline" size="sm" onClick={onChangeImage} className="rounded-full">
            <ImageUp className="mr-2 h-4 w-4" aria-hidden />
            Byt bild
          </Button>
          <Button variant="ghost" size="sm" onClick={onRetryScan} className="rounded-full">
            <RefreshCcw className="mr-2 h-4 w-4" aria-hidden />
            Starta om
          </Button>
        </div>
      )}

      {/* Så funkar det – 01/02/03 */}
      <section className="mt-10">
        <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
          Så funkar det
        </p>
        <ol className="mt-3 space-y-3">
          {[
            {
              n: "01",
              title: "Fota etiketten",
              sub: "Se till att etiketten fyller rutan i mjukt ljus.",
            },
            {
              n: "02",
              title: "AI läser och analyserar",
              sub: "OCR + web-sommelier i bakgrunden på sekunder.",
            },
            {
              n: "03",
              title: "Få en komplett profil",
              sub: "Smak, servering, parning och liknande viner.",
            },
          ].map((step) => (
            <li
              key={step.n}
              className="flex gap-4 rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur"
            >
              <span className="font-display text-2xl text-gold">{step.n}</span>
              <div>
                <p className="font-medium text-foreground">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.sub}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* PWA-install-CTA */}
      {isInstallCTAVisible && (
        <div className="mt-6 flex justify-center">
          <Button
            onClick={onInstall}
            variant="outline"
            size="sm"
            className="rounded-full border-border/60 bg-card/50 backdrop-blur"
          >
            <Download className="mr-2 h-4 w-4" aria-hidden />
            Installera appen
          </Button>
        </div>
      )}

      {onManualLookup && (
        <ManualLookupDialog
          open={lookupOpen}
          onOpenChange={setLookupOpen}
          onSubmit={onManualLookup}
        />
      )}
    </AppShell>
  );
};

export default ScanEmptyState;
