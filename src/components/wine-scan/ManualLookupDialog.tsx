import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

interface ManualLookupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (query: string) => Promise<void> | void;
}

/**
 * ManualLookupDialog – låter användaren söka på vinnamn när ingen bild finns.
 * Förlitar sig på en callback så WineSnap-sidan kan koppla sitt existerande
 * scan-pipeline-flöde utan att denna komponent äger någon affärslogik.
 */
export function ManualLookupDialog({ open, onOpenChange, onSubmit }: ManualLookupDialogProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    try {
      await onSubmit(q);
      setQuery("");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {t("scan.manualLookupTitle") ?? "Sök vin manuellt"}
          </DialogTitle>
          <DialogDescription>
            {t("scan.manualLookupDesc") ?? "Skriv producent och årgång – AI identifierar resten."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("scan.manualLookupPlaceholder") ?? "T.ex. Barolo Cannubi 2019"}
              className="h-12 rounded-2xl border-border bg-card/60 pl-11"
              disabled={loading}
            />
          </div>
          <Button
            type="submit"
            disabled={loading || !query.trim()}
            className="h-12 w-full rounded-2xl bg-gradient-luxe text-primary-foreground shadow-soft hover:opacity-90"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("scan.manualLookupSearching") ?? "Söker..."}
              </>
            ) : (
              t("scan.manualLookupSubmit") ?? "Identifiera"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default ManualLookupDialog;
