import { Button } from "@/components/ui/button";
import type { WineOffer } from "@/services/marketplaceService";
import { ExternalLink } from "lucide-react";

type BuySectionProps = {
  offers: WineOffer[];
  onOfferClick: (offer: WineOffer) => void;
};

const formatPrice = (price: number | null, currency: string | null) => {
  if (price === null) return null;

  const resolvedCurrency = currency ?? "SEK";
  try {
    return new Intl.NumberFormat("sv-SE", {
      style: "currency",
      currency: resolvedCurrency,
      maximumFractionDigits: resolvedCurrency === "JPY" ? 0 : 2,
    }).format(price);
  } catch {
    return `${price} ${resolvedCurrency}`;
  }
};

export const BuySection = ({ offers, onOfferClick }: BuySectionProps) => {
  return (
    <section className="rounded-2xl border border-theme-card/80 bg-theme-elevated/80 p-4 shadow-theme-card">
      <div className="mb-3 space-y-1">
        <p className="text-xs uppercase tracking-[0.25em] text-theme-secondary">Marketplace</p>
        <h3 className="text-lg font-semibold text-theme-primary">Köp</h3>
      </div>

      <div className="space-y-3">
        {offers.map((offer) => {
          const formattedPrice = formatPrice(offer.price, offer.currency);

          return (
            <div
              key={offer.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-theme-card/80 bg-theme-canvas/80 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-theme-primary">{offer.merchant || "Butik"}</p>
                {formattedPrice ? (
                  <p className="text-sm text-theme-secondary">{formattedPrice}</p>
                ) : (
                  <p className="text-xs text-theme-secondary">Pris saknas</p>
                )}
              </div>
              <Button
                variant="outline"
                className="rounded-full border-theme-card bg-theme-elevated text-theme-primary hover:bg-theme-elevated/80"
                onClick={() => onOfferClick(offer)}
                disabled={!offer.url}
              >
                Till butik
                <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default BuySection;
