import { ProgressBanner } from "@/components/ProgressBanner";
import ResultSkeleton from "@/components/result/ResultSkeleton";
import { ScanLoadingView } from "@/components/wine-scan/ScanLoadingView";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AppHeader } from "@/components/layout/AppHeader";
import type { BadgeProps } from "@/components/ui/badge";
import { Body, H1, H2, Label, Muted } from "@/components/ui/typography";
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
          rightActions={(
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              <Button variant="ghost" size="sm" className="text-theme-secondary hover:text-theme-primary" onClick={onNavigateHome}>
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
                variant="secondary"
                size="sm"
                onClick={onNavigateHistory}
              >
                Historik
              </Button>
            </div>
          )}
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
          <H1>Din digitala sommelier</H1>
          <Body>
            Fota etiketten och låt AI:n skapa en komplett vinprofil med smaknoter, serveringstips och matmatchningar – sparat lokalt för nästa gång.
          </Body>
        </div>

        <div className="flex w-full flex-wrap items-center gap-3">
          <Badge variant={statusTone}>{statusLabel}</Badge>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onRetryScan}
              disabled={isProcessing}
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
                <H2 asChild className="text-base">
                  <p>Något gick snett</p>
                </H2>
              </div>
              <Muted className="text-sm">
                Kontrollera ljuset och prova igen. Du kan starta om eller välja en annan bild utan att ladda om sidan.
              </Muted>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={onRetryScan}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Starta om skanning
                </Button>
                <Button
                  variant="secondary"
                  onClick={onChangeImage}
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
              size="lg"
              className="w-full"
              disabled={isProcessing}
            >
              <Camera className="mr-2 h-5 w-5" />
              Fota vinflaska
            </Button>
            <Muted className="text-sm">
              Bäst resultat när etiketten fyller rutan och du fotar i mjukt ljus.
            </Muted>
          </div>
        )}

        <div className="w-full rounded-3xl border border-theme-card bg-theme-elevated p-5 text-left text-base leading-relaxed text-theme-secondary">
          <H2 asChild className="text-base">
            <p>Så funkar skanningen</p>
          </H2>
          <div className="mt-4 space-y-3">
            {[
              {
                tip: "Justera flaskan tills guidelinjen blir grön.",
                Icon: Camera,
              },
              {
                tip: "Vi kör OCR och AI-analys i bakgrunden.",
                Icon: Sparkles,
              },
              {
                tip: "Spara själv när du vill lägga till vinet i historiken.",
                Icon: Wine,
              },
            ].map(({ tip, Icon }, idx) => (
              <div key={tip} className="flex items-start gap-3 rounded-2xl border border-theme-card bg-black/25 p-4">
                <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-theme-primary text-sm font-semibold text-white shadow-sm">
                  {idx + 1}
                </span>
                <div className="flex flex-1 items-start gap-3">
                  <Icon className="mt-0.5 h-5 w-5 text-theme-primary" />
                  <Body className="flex-1 leading-relaxed">{tip}</Body>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {isInstallCTAVisible && (
        <div className="absolute right-4 top-4 z-10">
          <Button
            onClick={onInstall}
            variant="secondary"
            size="sm"
            className="shadow-lg backdrop-blur"
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
