import { AmbientBackground } from "@/components/AmbientBackground";
import MetersRow from "@/components/result/MetersRow";
import ResultHeader from "@/components/result/ResultHeader";
import { WineListsPanel } from "@/components/result/WineListsPanel";
import ActionBar from "@/components/result/ActionBar";
import ClampTextCard from "@/components/result/ClampTextCard";
import AnalysisFeedback from "@/components/wine-scan/AnalysisFeedback";
import { ScanStatusBanner } from "@/components/wine-scan/ScanStatusBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ImageModal from "@/components/common/ImageModal";
import { AppHeader } from "@/components/layout/AppHeader";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookmarkPlus, Download, ImageUp, Loader2, RefreshCcw, Trash2 } from "lucide-react";
import type { BadgeProps } from "@/components/ui/badge";
import { computeLabelHash, type EvidenceItem, type WineAnalysisResult } from "@/lib/wineCache";
import { ReactNode, Suspense, lazy, useMemo, useState } from "react";

const KeyFacts = lazy(() => import("@/components/result/KeyFacts"));
const EvidenceAccordion = lazy(() => import("@/components/result/EvidenceAccordion"));
const Pairings = lazy(() => import("@/components/result/Pairings"));
const ServingCard = lazy(() => import("@/components/result/ServingCard"));

const LazySectionFallback = ({ className = "" }: { className?: string }) => (
  <div
    className={`w-full min-h-[120px] rounded-2xl border border-theme-card bg-surface-card animate-pulse ${className}`}
  />
);

interface ScanResultViewProps {
  results: WineAnalysisResult;
  previewImage: string | null;
  banner: ReactNode;
  statusLabel: string;
  statusTone: BadgeProps["variant"];
  onRetryScan: () => void;
  onChangeImage: () => void;
  onSaveWine: () => void;
  onRemoveWine: () => void;
  onStartNewScan: () => void;
  onInstall: () => void;
  onNavigateHistory: () => void;
  onNavigateProfile: () => void;
  showInstallCTA: boolean;
  isSaved: boolean;
  isSaving: boolean;
  isRemoving: boolean;
  currentCacheKey: string | null;
  isLoggedIn: boolean;
  onLogin: () => void;
  ensureRemoteScan: () => Promise<string>;
  remoteScanId: string | null;
  isPersistingScan: boolean;
  needsRefinement: boolean;
  refinementReason: string;
  confidenceValue: number | null;
  isProcessing: boolean;
  isRefineDialogOpen: boolean;
  setIsRefineDialogOpen: (open: boolean) => void;
  refineVintage: string;
  refineGrape: string;
  refineStyle: string;
  setRefineVintage: (value: string) => void;
  setRefineGrape: (value: string) => void;
  setRefineStyle: (value: string) => void;
  styleSuggestions: string[];
  grapeSuggestions: string[];
  handleApplyRefinements: () => void;
  pairings: string[];
  sourceLabel: string;
  sourceDescription: string;
  sourceType: "label" | "web";
  showVerifiedMeters: boolean;
  metersAreEstimated: boolean;
  showDetailedSections: boolean;
  ocrText?: string | null;
  evidenceLinks?: EvidenceItem[] | null;
  detectedLanguage?: string;
}

export const ScanResultView = ({
  results,
  previewImage,
  banner,
  statusLabel,
  statusTone,
  onRetryScan,
  onChangeImage,
  onSaveWine,
  onRemoveWine,
  onStartNewScan,
  onInstall,
  onNavigateHistory,
  onNavigateProfile,
  showInstallCTA,
  isSaved,
  isSaving,
  isRemoving,
  currentCacheKey,
  isLoggedIn,
  onLogin,
  ensureRemoteScan,
  remoteScanId,
  isPersistingScan,
  needsRefinement,
  refinementReason,
  confidenceValue,
  isProcessing,
  isRefineDialogOpen,
  setIsRefineDialogOpen,
  refineVintage,
  refineGrape,
  refineStyle,
  setRefineVintage,
  setRefineGrape,
  setRefineStyle,
  styleSuggestions,
  grapeSuggestions,
  handleApplyRefinements,
  pairings,
  sourceLabel,
  sourceDescription,
  sourceType,
  showVerifiedMeters,
  metersAreEstimated,
  showDetailedSections,
  ocrText,
  evidenceLinks,
  detectedLanguage,
}: ScanResultViewProps) => {
  const isLabelOnly = results.mode === "label_only";
  const sectionTitleClassName = "text-xs font-semibold uppercase tracking-wide text-theme-primary";

  const labelHash = useMemo(
    () => computeLabelHash(ocrText ?? results.originaltext ?? results.vin ?? null),
    [ocrText, results.originaltext, results.vin],
  );

  const hasKeyFacts = [
    results.druvor,
    results.färgtyp,
    results.klassificering,
    results.alkoholhalt,
    results.volym,
    results.sockerhalt,
    results.syra,
  ].some((value) => Boolean(value && value !== "–"));
  const hasCharacter = Boolean(results.karaktär && results.karaktär !== "–");
  const hasTaste = Boolean(results.smak && results.smak !== "–");
  const hasTasteNotes = hasCharacter || hasTaste;
  const hasPairings = Array.isArray(pairings) && pairings.some((item) => Boolean(item && item.trim()));
  const hasServing = Boolean(results.servering && results.servering !== "–");
  const hasEvidence =
    Boolean(ocrText && ocrText !== "–") ||
    (Array.isArray(evidenceLinks) && evidenceLinks.some(Boolean)) ||
    Boolean(results.källa && results.källa !== "–");
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  return (
    <>
      <Dialog open={isRefineDialogOpen} onOpenChange={setIsRefineDialogOpen}>
        <DialogContent className="border-theme-card bg-surface-card text-theme-primary">
          <DialogHeader>
            <DialogTitle>Förfina resultat</DialogTitle>
            <DialogDescription className="text-theme-secondary">
              Hjälp oss säkra analysen genom att lägga till detaljer eller skanna etiketten igen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-theme-card bg-surface-card p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-theme-primary">Ta en ny bild</p>
                  <p className="text-sm text-theme-secondary">Fota etiketten igen för att få fler källor.</p>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsRefineDialogOpen(false);
                    onRetryScan();
                  }}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Starta ny skanning
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="refineVintage">Årgång (valfritt)</Label>
                <Input
                  id="refineVintage"
                  inputMode="numeric"
                  value={refineVintage}
                  onChange={(event) => setRefineVintage(event.target.value)}
                  placeholder="t.ex. 2019"
                  className="border-theme-card bg-surface-canvas text-theme-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="refineStyle">Stil</Label>
                <Input
                  id="refineStyle"
                  value={refineStyle}
                  onChange={(event) => setRefineStyle(event.target.value)}
                  placeholder="t.ex. Chianti Classico"
                  className="border-theme-card bg-surface-canvas text-theme-primary"
                />
                {styleSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-xs text-theme-secondary">
                    {styleSuggestions.map((item) => (
                      <button
                        key={item}
                        type="button"
                        className="rounded-full border border-theme-card px-3 py-1 text-theme-primary hover:border-theme-primary"
                        onClick={() => setRefineStyle(item)}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="refineGrape">Druva</Label>
              <Input
                id="refineGrape"
                value={refineGrape}
                onChange={(event) => setRefineGrape(event.target.value)}
                placeholder="t.ex. Sangiovese"
                className="border-theme-card bg-surface-canvas text-theme-primary"
              />
              {grapeSuggestions.length > 0 && (
                <div className="flex flex-wrap gap-2 text-xs text-theme-secondary">
                  {grapeSuggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className="rounded-full border border-theme-card px-3 py-1 text-theme-primary hover:border-theme-primary"
                      onClick={() => setRefineGrape(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4 flex items-center gap-2 sm:justify-between">
            <p className="text-xs text-theme-secondary">Vi sparar dina manuella justeringar tillsammans med etiketten.</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setIsRefineDialogOpen(false)} className="text-theme-primary">
                Avbryt
              </Button>
              <Button onClick={handleApplyRefinements}>
                Spara detaljer
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="relative min-h-screen overflow-hidden bg-surface-base text-theme-secondary">
        <AmbientBackground />

        <div className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-32 pt-10 sm:pt-16">
          <div className="mb-10">
            <AppHeader
              variant="compact"
              title="WineSnap"
              subtitle="Din digitala sommelier"
              rightActions={(
                <div className="flex flex-wrap items-center gap-2">
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
                  {showInstallCTA && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={onInstall}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Installera app
                    </Button>
                  )}
                </div>
              )}
            />
          </div>

          {banner}

          <div className="mb-6 flex flex-wrap items-center gap-3">
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
                className="text-theme-primary hover:bg-surface-card"
              >
                <ImageUp className="mr-2 h-4 w-4" />
                Byt bild
              </Button>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
            {previewImage && (
              <aside className="lg:col-start-2 lg:row-start-1 lg:sticky lg:top-24">
                <button
                  type="button"
                  onClick={() => setIsImageModalOpen(true)}
                  className="group w-full overflow-hidden rounded-3xl border border-theme-card bg-surface-card shadow-xl backdrop-blur transition hover:border-theme-card/80"
                  aria-label="Öppna etiketten i större vy"
                >
                  <img
                    src={previewImage}
                    alt="Skannad vinetikett"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                  />
                </button>
              </aside>
            )}

            <div className="space-y-6 lg:col-start-1 lg:row-start-1">
              <ResultHeader
                vin={results.vin}
                ar={results.årgång}
                producent={results.producent}
                land_region={results.land_region}
                typ={results.typ}
                evidenceItems={evidenceLinks}
                sourceType={sourceType}
              />

              <ScanStatusBanner
                isLabelOnly={isLabelOnly}
                needsRefinement={needsRefinement}
                refinementReason={refinementReason}
                confidenceValue={confidenceValue}
                onRefine={() => setIsRefineDialogOpen(true)}
              />

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                onClick={onSaveWine}
                disabled={isSaved || isSaving || !currentCacheKey}
                size="lg"
                className="w-full justify-center sm:w-auto sm:min-w-[220px]"
              >
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookmarkPlus className="mr-2 h-4 w-4" />}
                {isSaved ? "Sparat" : "Spara till mina viner"}
              </Button>
              {isSaved ? (
                <Button
                  variant="outline"
                  onClick={onRemoveWine}
                  disabled={isRemoving}
                  className="w-full justify-center sm:w-auto"
                >
                  {isRemoving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                  Ta bort ur mina viner
                </Button>
                ) : null}
              </div>

              {isLoggedIn ? (
                <WineListsPanel
                  scanId={remoteScanId}
                  ensureScanId={ensureRemoteScan}
                  isPersistingScan={isPersistingScan}
                />
              ) : (
                <Card className="border-theme-card/80 bg-surface-card backdrop-blur">
                  <CardContent className="flex flex-col gap-3 text-sm text-theme-secondary sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-theme-primary">Logga in för att spara vinet</p>
                      <p>Skapa listor som Favoriter, Köp igen och Gästlista med ditt konto.</p>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={onLogin}
                    >
                      Logga in
                    </Button>
                  </CardContent>
                </Card>
              )}

              <AnalysisFeedback
                scanId={remoteScanId}
                ensureScanId={ensureRemoteScan}
                labelHash={labelHash}
                isLoggedIn={isLoggedIn}
              />

              <Card className="border-theme-card/80 bg-surface-card/80 backdrop-blur">
                <CardContent className="space-y-8 p-6">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-theme-card/60 pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={sectionTitleClassName}>Smakprofil</h3>
                      </div>
                      <div className="flex flex-col items-end gap-1 text-right">
                        <span className="inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Källa: {sourceLabel}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{sourceDescription}</span>
                      </div>
                    </div>
                    {showVerifiedMeters ? (
                      <MetersRow
                        meters={results.meters}
                        estimated={metersAreEstimated || results?._meta?.meters_source === "derived"}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">Smakprofil saknas för detta vin.</p>
                    )}
                  </div>

                  {hasKeyFacts && (
                    <Suspense fallback={<LazySectionFallback className="min-h-[160px]" />}>
                      <KeyFacts
                        druvor={results.druvor}
                        fargtyp={results.färgtyp}
                        klassificering={results.klassificering}
                        alkoholhalt={results.alkoholhalt}
                        volym={results.volym}
                        sockerhalt={results.sockerhalt}
                        syra={results.syra}
                        evidenceItems={evidenceLinks}
                        sourceType={sourceType}
                        variant="embedded"
                        titleClassName={sectionTitleClassName}
                      />
                    </Suspense>
                  )}

                  {hasTasteNotes && (
                    <div className="grid gap-6 sm:grid-cols-2">
                      <ClampTextCard
                        titleKey="wineDetail.character"
                        text={results.karaktär}
                        variant="embedded"
                        titleClassName={sectionTitleClassName}
                      />
                      <ClampTextCard
                        titleKey="wineDetail.taste"
                        text={results.smak}
                        variant="embedded"
                        titleClassName={sectionTitleClassName}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {(hasPairings || hasServing) && (
                <Card className="border-theme-card/80 bg-surface-card/80 backdrop-blur">
                  <CardContent className="space-y-6 p-6">
                    {hasPairings && (
                      <Suspense fallback={<LazySectionFallback className="min-h-[120px]" />}>
                        <Pairings items={pairings} variant="embedded" titleClassName={sectionTitleClassName} />
                      </Suspense>
                    )}

                    {hasServing && (
                      <Suspense fallback={<LazySectionFallback className="min-h-[120px]" />}>
                        <ServingCard servering={results.servering} variant="embedded" titleClassName={sectionTitleClassName} />
                      </Suspense>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card className="border-theme-card/80 bg-surface-card/80 backdrop-blur">
                <CardContent className="space-y-6 p-6">
                  {hasEvidence && (
                    <Suspense fallback={<LazySectionFallback className="min-h-[140px]" />}>
                      <EvidenceAccordion
                        ocr={ocrText}
                        hits={evidenceLinks}
                        primary={results.källa}
                        variant="embedded"
                        titleClassName={sectionTitleClassName}
                      />
                    </Suspense>
                  )}

                  <div className="space-y-3">
                    <div className="border-b border-theme-card/60 pb-3">
                      <h3 className={sectionTitleClassName}>Noteringar</h3>
                    </div>
                    {detectedLanguage && (
                      <p className="text-xs text-theme-secondary opacity-80">
                        Upptäckt språk: {detectedLanguage.toUpperCase()}
                      </p>
                    )}
                    <p className="text-xs text-theme-secondary opacity-80">
                      Spara profilen för att lägga till den i dina viner. Osparade skanningar rensas när du lämnar sidan.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {previewImage && (
            <ImageModal
              open={isImageModalOpen}
              onOpenChange={setIsImageModalOpen}
              src={previewImage}
              alt="Skannad vinetikett"
            />
          )}
        </div>

        {showDetailedSections && <ActionBar onNewScan={onStartNewScan} />}
      </div>
    </>
  );
};

export default ScanResultView;
