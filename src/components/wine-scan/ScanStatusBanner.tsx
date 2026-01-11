import { Banner } from "@/components/Banner";
import { Button } from "@/components/ui/button";

interface ScanStatusBannerProps {
  isLabelOnly: boolean;
  needsRefinement: boolean;
  refinementReason: string;
  confidenceValue: number | null;
  onRefine: () => void;
}

export const ScanStatusBanner = ({
  isLabelOnly,
  needsRefinement,
  refinementReason,
  confidenceValue,
  onRefine,
}: ScanStatusBannerProps) => {
  if (!isLabelOnly && !needsRefinement) return null;

  return (
    <div className="space-y-3">
      {isLabelOnly && (
        <Banner
          type="warning"
          title="Endast etikettdata"
          text="Det här bygger bara på etiketten – viss information kan saknas."
          className="mb-4"
        />
      )}

      {needsRefinement && (
        <div className="flex flex-col gap-3 rounded-2xl border border-theme-card bg-theme-elevated/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-theme-primary">Förfina resultat</p>
            <p className="text-sm text-theme-secondary">{refinementReason}</p>
            {confidenceValue !== null && (
              <p className="text-xs text-theme-secondary/80">Säkerhet: {(confidenceValue * 100).toFixed(0)}%</p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={onRefine}
            className="border-theme-card bg-theme-canvas text-theme-primary transition duration-150 ease-out hover:bg-theme-elevated active:scale-[0.98]"
          >
            Förfina resultat
          </Button>
        </div>
      )}
    </div>
  );
};

export default ScanStatusBanner;
