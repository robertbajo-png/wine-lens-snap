import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { ProgressBanner } from "@/components/ProgressBanner";

type Step = "prep" | "ocr" | "analysis" | "done" | "error" | null;

interface ScanLoadingViewProps {
  previewImage: string | null;
  isProcessing: boolean;
  progressStep: Step;
  progressNote: string | null;
  progressPercent: number | null;
  progressLabel: string | null;
}

export const ScanLoadingView = ({
  previewImage,
  isProcessing,
  progressStep,
  progressNote,
  progressPercent,
  progressLabel,
}: ScanLoadingViewProps) => {
  if (!previewImage) return null;

  return (
    <Card className="relative w-full overflow-hidden rounded-[30px] border border-theme-card bg-gradient-to-br from-[hsl(var(--surface-elevated)/1)] via-[hsl(var(--surface-elevated)/0.85)] to-[hsl(var(--surface-elevated)/0.55)] shadow-2xl shadow-purple-900/40">
      <CardContent className="p-4">
        <div className="relative">
          <img
            src={previewImage}
            alt="Wine bottle"
            className="w-full rounded-2xl bg-black/20 object-contain"
          />

          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/70 backdrop-blur">
              <div className="w-full max-w-xs space-y-4 text-center">
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-purple-200" />
                <ProgressBanner
                  step={progressStep}
                  note={progressNote}
                  progress={progressPercent}
                  label={progressLabel}
                />
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ScanLoadingView;
