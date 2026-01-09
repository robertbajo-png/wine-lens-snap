import { ProgressBanner } from "@/components/ProgressBanner";
import ResultSkeleton from "@/components/result/ResultSkeleton";
import { AppHeader } from "@/components/layout/AppHeader";
import { ScanLoadingView } from "@/components/wine-scan/ScanLoadingView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { BadgeProps } from "@/components/ui/badge";
import { Camera, Download, ImageUp, RefreshCcw, Sparkles, Wine } from "lucide-react";
import { ReactNode } from "react";

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
}

export const ScanEmptyState = ({
  banner,
  isInstallCTAVisible,
  onInstall,
  onNavigateHome,
  onNavigateProfile,
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
}: ScanEmptyStateProps) => {
  const showProgress = isProcessing || progressStep || progressNote || progressPercent !== null;

  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center px-4 pb-20 pt-12 text-center sm:px-8">
      <div className="mb-10 w-full">
        <AppHeader
          variant="compact"
          title="WineSnap"
          subtitle="Skanna vinetiketter med AI"
          rightActions={
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-theme-secondary hover:text-theme-primary"
                onClick={onNavigateHome}
              >
                Hem
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-theme-secondary hover:text-theme-primary"
                onClick={onNavigateProfile}
              >
                Profil
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated"
                onClick={onNavigateHistory}
              >
                Historik
              </Button>
            </div>
          }
        />
      </div>

      {banner}

      {isProcessing && !previewImage && (
        <div className="mb-8 w-full rounded-3xl border border-theme-card bg-theme-elevated p-6 text-left">
          <ResultSkeleton />
        </div>
      )}

      <div className="flex w-full max-w-md flex-col items-center gap-8">
        <div className="space-y-3">
          <p className="inline-flex items-center gap-2 rounded-full border border-theme-card bg-theme-elevated px-4 py-1 text-sm text-purple-100">
            <Sparkles className="h-4 w-4" />
            Klar för nästa skanning
          </p>
          <h1 className="text-3xl font-semibold text-theme-primary">Din digitala sommelier</h1>
          <p className="text-base text-theme-secondary">
            Fota etiketten och låt AI:n skapa en komplett vinprofil med smaknoter, serveringstips och matmatchningar – sparat lokalt för nästa gång.
          </p>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3">
          <Badge variant={statusTone}>{statusLabel}</Badge>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRetryScan}
              disabled={isProcessing}
              className="border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated/80"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              Starta om
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onChangeImage}
              disabled={isProcessing}
              className="text-theme-primary hover:bg-theme-elevated"
            >
              <ImageUp className="mr-2 h-4 w-4" />
              Byt bild
            </Button>
          </div>
        </div>

        {showProgress && (
          <div className="w-full">
            <ProgressBanner
              step={progressStep}
              note={progressNote}
              progress={progressPercent}
              label={progressLabel}
            />
          </div>
        )}

        {showError && (
          <Card className="w-full border-theme-card bg-theme-elevated">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center gap-2 text-theme-primary">
                <Wine className="h-5 w-5" />
                <p className="font-semibold">Något gick snett</p>
              </div>
              <p className="text-sm text-theme-secondary">
                Kontrollera ljuset och prova igen. Du kan starta om eller välja en annan bild utan att ladda om sidan.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={onRetryScan}
                  className="bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#9C5CFF] text-theme-primary"
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Starta om skanning
                </Button>
                <Button
                  variant="outline"
                  onClick={onChangeImage}
                  className="border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated/80"
                >
                  <ImageUp className="mr-2 h-4 w-4" />
                  Byt bild
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <ScanLoadingView
          previewImage={previewImage}
          isProcessing={isProcessing}
          progressStep={progressStep}
          progressNote={progressNote}
          progressPercent={progressPercent}
          progressLabel={progressLabel}
        />

        {!previewImage && (
          <div className="w-full space-y-4">
            <Button
              onClick={onTakePhoto}
              className="h-14 w-full rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#9C5CFF] text-base font-semibold shadow-[0_20px_45px_-22px_rgba(123,63,228,0.95)]"
              size="lg"
              disabled={isProcessing}
            >
              <Camera className="mr-2 h-5 w-5" />
              Fota vinflaska
            </Button>
            <p className="text-sm text-theme-secondary">
              Bäst resultat när etiketten fyller rutan och du fotar i mjukt ljus.
            </p>
          </div>
        )}

        <div className="w-full rounded-3xl border border-theme-card bg-theme-elevated p-5 text-left text-sm text-theme-secondary">
          <p className="font-semibold text-theme-primary">Så funkar skanningen</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {["Justera flaskan tills guidelinjen blir grön.", "Vi kör OCR och AI-analys i bakgrunden.", "Spara själv när du vill lägga till vinet i historiken."].map((tip, idx) => (
              <div key={tip} className="rounded-2xl border border-theme-card bg-black/25 p-3">
                <span className="mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-theme-elevated text-xs font-semibold text-theme-primary">
                  {idx + 1}
                </span>
                <p>{tip}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isInstallCTAVisible && (
        <div className="absolute right-4 top-4 z-10">
          <Button
            onClick={onInstall}
            variant="outline"
            size="sm"
            className="border-theme-card bg-theme-elevated text-theme-primary shadow-lg backdrop-blur hover:bg-theme-elevated"
          >
            <Download className="mr-2 h-4 w-4" />
            Installera app
          </Button>
        </div>
      )}
    </div>
  );
};

export default ScanEmptyState;
