import { AmbientBackground } from "@/components/AmbientBackground";
import MetersRow from "@/components/result/MetersRow";
import ResultHeader from "@/components/result/ResultHeader";
import { WineListsPanel } from "@/components/result/WineListsPanel";
import ActionBar from "@/components/result/ActionBar";
import ClampTextCard from "@/components/result/ClampTextCard";
import EvidenceAccordion from "@/components/result/EvidenceAccordion";
import KeyFacts from "@/components/result/KeyFacts";
import Pairings from "@/components/result/Pairings";
import ServingCard from "@/components/result/ServingCard";
import { ScanStatusBanner } from "@/components/wine-scan/ScanStatusBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PremiumBadge } from "@/components/PremiumBadge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookmarkPlus, Download, ImageUp, Loader2, Lock, RefreshCcw, Trash2 } from "lucide-react";
import type { BadgeProps } from "@/components/ui/badge";
import { computeLabelHash, type WineAnalysisResult } from "@/lib/wineCache";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { FREE_SCAN_LIMIT_PER_DAY } from "@/lib/premiumAccess";
import { BuySection } from "@/components/wine-scan/BuySection";
import { getOffersByLabelHash, type WineOffer } from "@/services/marketplaceService";
import { logEvent } from "@/lib/logger";

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
  showVerifiedMeters: boolean;
  metersAreEstimated: boolean;
  showDetailedSections: boolean;
  ocrText?: string | null;
  evidenceLinks?: string[] | null;
  detectedLanguage?: string;
  isPremium: boolean;
  onUpgrade: () => void;
  freeScansRemaining: number;
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
  showVerifiedMeters,
  metersAreEstimated,
  showDetailedSections,
  ocrText,
  evidenceLinks,
  detectedLanguage,
  isPremium,
  onUpgrade,
  freeScansRemaining,
}: ScanResultViewProps) => {
  const isLabelOnly = results.mode === "label_only";
  const [offers, setOffers] = useState<WineOffer[]>([]);

  const labelHash = useMemo(
    () => computeLabelHash(ocrText ?? results.originaltext ?? results.vin ?? null),
    [ocrText, results.originaltext, results.vin],
  );

  useEffect(() => {
    let isCancelled = false;

    const fetchOffers = async () => {
      if (!labelHash) {
        setOffers([]);
        return;
      }

      try {
        const fetchedOffers = await getOffersByLabelHash(labelHash);
        if (!isCancelled) {
          setOffers(fetchedOffers);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("Kunde inte hämta marketplace-erbjudanden", error);
        }
        if (!isCancelled) {
          setOffers([]);
        }
      }
    };

    void fetchOffers();

    return () => {
      isCancelled = true;
    };
  }, [labelHash]);

  const visibleOffers = useMemo(
    () => offers.filter((offer) => Boolean(offer.url)).slice(0, 3),
    [offers],
  );

  const handleOfferClick = (offer: WineOffer) => {
    if (!offer.url) return;

    window.open(offer.url, "_blank", "noopener,noreferrer");
    void logEvent("offer_clicked", {
      labelHash,
      merchant: offer.merchant,
      url: offer.url,
    });
  };

  return (
    <>
      <Dialog open={isRefineDialogOpen} onOpenChange={setIsRefineDialogOpen}>
        <DialogContent className="border-theme-card bg-theme-elevated text-theme-primary">
          <DialogHeader>
            <DialogTitle>Förfina resultat</DialogTitle>
            <DialogDescription className="text-theme-secondary">
              Hjälp oss säkra analysen genom att lägga till detaljer eller skanna etiketten igen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-2xl border border-theme-card bg-theme-elevated/50 p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-theme-primary">Ta en ny bild</p>
                  <p className="text-sm text-theme-secondary">Fota etiketten igen för att få fler källor.</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsRefineDialogOpen(false);
                    onRetryScan();
                  }}
                  className="border-theme-card bg-theme-canvas text-theme-primary hover:bg-theme-elevated"
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
                  className="border-theme-card bg-theme-canvas text-theme-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="refineStyle">Stil</Label>
                <Input
                  id="refineStyle"
                  value={refineStyle}
                  onChange={(event) => setRefineStyle(event.target.value)}
                  placeholder="t.ex. Chianti Classico"
                  className="border-theme-card bg-theme-canvas text-theme-primary"
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
                className="border-theme-card bg-theme-canvas text-theme-primary"
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
              <Button onClick={handleApplyRefinements} className="bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#9C5CFF] text-theme-primary">
                Spara detaljer
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="relative min-h-screen overflow-hidden bg-theme-canvas text-theme-secondary">
        <AmbientBackground />

        <div className="relative z-10 mx-auto w-full max-w-4xl px-4 pb-32 pt-10 sm:pt-16">
          <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-purple-200/80">WineSnap</p>
              <p className="text-sm text-theme-secondary">Din digitala sommelier</p>
            </div>
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
                variant="outline"
                size="sm"
                className="rounded-full border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated"
                onClick={onNavigateHistory}
              >
                Historik
              </Button>
              {showInstallCTA && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated"
                  onClick={onInstall}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Installera app
                </Button>
              )}
            </div>
          </header>

          {banner}

          {!isPremium && (
            <Card className="mb-4 border-theme-card/80 bg-theme-elevated/70 backdrop-blur">
              <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 text-sm text-theme-secondary">
                  <p className="text-base font-semibold text-theme-primary">Premium låser upp djupanalys</p>
                  <p>
                    Gratisläget ger {FREE_SCAN_LIMIT_PER_DAY} analyser per dag och ett etikettläge. Du har
                    {" "}
                    {freeScansRemaining} kvar idag. Premium ger obegränsad skanning och alla detaljer.
                  </p>
                </div>
                <Button
                  className="self-start rounded-full bg-theme-accent px-5 text-theme-on-accent shadow-theme-card"
                  onClick={onUpgrade}
                >
                  Bli premium
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="mb-6 flex flex-wrap items-center gap-3">
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

          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="space-y-6">
              <ResultHeader
                vin={results.vin}
                ar={results.årgång}
                producent={results.producent}
                land_region={results.land_region}
                typ={results.typ}
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
                  className="h-12 w-full justify-center rounded-full bg-gradient-to-r from-[#7B3FE4] via-[#8451ED] to-[#9C5CFF] text-base font-semibold text-theme-primary shadow-[0_18px_45px_-18px_rgba(123,63,228,1)] disabled:from-[#7B3FE4]/40 disabled:via-[#8451ED]/40 disabled:to-[#9C5CFF]/40 sm:w-auto sm:min-w-[220px]"
                >
                  {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookmarkPlus className="mr-2 h-4 w-4" />}
                  {isSaved ? "Sparat" : "Spara till mina viner"}
                </Button>
                {isSaved ? (
                  <Button
                    variant="outline"
                    onClick={onRemoveWine}
                    disabled={isRemoving}
                    className="h-12 w-full justify-center rounded-full border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated/80 sm:w-auto"
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
                <Card className="border-theme-card/80 bg-theme-elevated/80 backdrop-blur">
                  <CardContent className="flex flex-col gap-3 text-sm text-theme-secondary sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-theme-primary">Logga in för att spara vinet</p>
                      <p>Skapa listor som Favoriter, Köp igen och Gästlista med ditt konto.</p>
                    </div>
                    <Button
                      variant="outline"
                      className="border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated/80"
                      onClick={onLogin}
                    >
                      Logga in
                    </Button>
                  </CardContent>
                </Card>
              )}

              {visibleOffers.length > 0 && (
                <BuySection offers={visibleOffers} onOfferClick={handleOfferClick} />
              )}

              <section className="rounded-2xl border border-border bg-card p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground">Smakprofil</h3>
                    <PremiumBadge message="Premium ger en djupare smakprofil med fler nyanser och rekommendationer." />
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
              </section>

              <KeyFacts
                druvor={results.druvor}
                fargtyp={results.färgtyp}
                klassificering={results.klassificering}
                alkoholhalt={results.alkoholhalt}
                volym={results.volym}
                sockerhalt={results.sockerhalt}
                syra={results.syra}
              />

              <div className="grid gap-4 sm:grid-cols-2">
              <ClampTextCard title="Karaktär" text={results.karaktär} />
              <ClampTextCard title="Smak" text={results.smak} />
            </div>

            {isPremium ? (
              <>
                <Pairings items={pairings} />

                <ServingCard servering={results.servering} />

                <EvidenceAccordion
                  ocr={ocrText}
                  hits={evidenceLinks}
                  primary={results.källa}
                />
              </>
            ) : (
              <Card className="border-theme-card/70 bg-theme-elevated/70">
                <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3 text-sm text-theme-secondary">
                    <Lock className="mt-1 h-4 w-4 text-theme-primary" aria-hidden="true" />
                    <div className="space-y-1">
                      <p className="font-semibold text-theme-primary">Djupare analys är låst</p>
                      <p>
                        Matrekommendationer, serveringstips och källor ingår i premium. Uppgradera för att se
                        helheten.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="rounded-full border-theme-card bg-theme-canvas text-theme-primary hover:bg-theme-elevated"
                    onClick={onUpgrade}
                  >
                    Lås upp Premium
                  </Button>
                </CardContent>
              </Card>
            )}

            {detectedLanguage && (
              <p className="text-xs text-theme-secondary opacity-80">Upptäckt språk: {detectedLanguage.toUpperCase()}</p>
            )}

              <p className="text-xs text-theme-secondary opacity-80">
                Spara profilen för att lägga till den i dina viner. Osparade skanningar rensas när du lämnar sidan.
              </p>
            </div>

            {previewImage && (
              <aside className="lg:sticky lg:top-24">
                <div className="overflow-hidden rounded-3xl border border-theme-card bg-black/40 shadow-xl backdrop-blur">
                  <img src={previewImage} alt="Skannad vinetikett" className="h-full w-full object-cover" />
                </div>
              </aside>
            )}
          </div>
        </div>

        {showDetailedSections && <ActionBar onNewScan={onStartNewScan} />}
      </div>
    </>
  );
};

export default ScanResultView;
