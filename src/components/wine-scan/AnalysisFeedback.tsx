import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { logEvent } from "@/lib/logger";
import { useToast } from "@/components/ui/use-toast";

interface AnalysisFeedbackProps {
  scanId: string | null;
  ensureScanId: () => Promise<string>;
  labelHash: string | null;
  isLoggedIn: boolean;
}

export const AnalysisFeedback = ({
  scanId,
  ensureScanId,
  labelHash,
  isLoggedIn,
}: AnalysisFeedbackProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [comment, setComment] = useState("");
  const [showDialog, setShowDialog] = useState(false);

  const trimmedComment = useMemo(() => comment.trim(), [comment]);
  const disabled = !labelHash || !isLoggedIn || isSubmitting || hasSubmitted;

  const submitFeedback = async (isCorrect: boolean, optionalComment?: string) => {
    if (disabled) return;
    setIsSubmitting(true);

    try {
      const resolvedScanId = scanId ?? (await ensureScanId());
      if (!labelHash) {
        throw new Error("Kunde inte identifiera etiketten för feedback.");
      }

      const payload = {
        scan_id: resolvedScanId,
        label_hash: labelHash,
        is_correct: isCorrect,
        comment: optionalComment ? optionalComment : null,
      } as const;

      const { error } = await supabase.from("analysis_feedback" as "scans").insert(payload as never);
      if (error) {
        throw error;
      }

      await logEvent("analysis_feedback_submitted", { scanId: resolvedScanId, isCorrect });
      setHasSubmitted(true);
      setShowDialog(false);
      toast({ title: "Tack för din feedback!" });
    } catch (error) {
      const description = error instanceof Error ? error.message : "Något gick fel. Försök igen.";
      toast({
        title: "Kunde inte skicka feedback",
        description,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="border-theme-card/80 bg-theme-elevated/70">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-theme-primary">Stämmer analysen?</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-theme-secondary">
          Hjälp oss förbättra WineSnap genom att berätta om analysen träffade rätt.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={disabled}
            onClick={() => submitFeedback(true)}
          >
            Stämmer
          </Button>
          <Button
            variant="secondary"
            disabled={disabled}
            onClick={() => setShowDialog(true)}
          >
            Stämmer inte
          </Button>
        </div>
      </CardContent>

      {hasSubmitted && (
        <p className="px-6 pb-4 text-sm font-medium text-theme-primary">Tack! Din feedback är registrerad.</p>
      )}

      <Dialog open={showDialog} onOpenChange={(open) => !isSubmitting && setShowDialog(open)}>
        <DialogContent className="border-theme-card bg-theme-elevated text-theme-primary">
          <DialogHeader>
            <DialogTitle>Berätta vad som inte stämmer</DialogTitle>
            <DialogDescription className="text-theme-secondary">
              (Valfritt) Ge en kommentar om vad som blev fel i analysen.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="analysisFeedbackComment">Kommentar</Label>
            <Textarea
              id="analysisFeedbackComment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="T.ex. fel årgång eller producent"
              className="border-theme-card bg-theme-canvas text-theme-primary"
            />
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={() => setShowDialog(false)} disabled={isSubmitting}>
              Avbryt
            </Button>
            <Button
              onClick={() => submitFeedback(false, trimmedComment)}
              disabled={isSubmitting || hasSubmitted}
            >
              {isSubmitting ? "Skickar..." : "Skicka"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AnalysisFeedback;
