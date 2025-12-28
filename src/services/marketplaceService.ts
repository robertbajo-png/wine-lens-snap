import { supabase } from "@/lib/supabaseClient";

export type WineOffer = {
  id: string;
  labelHash: string | null;
  merchant: string;
  price: number | null;
  country: string | null;
  currency: string | null;
  url: string | null;
};

type MarketplaceOfferRow = {
  id: string;
  label_hash?: string | null;
  merchant?: string | null;
  price?: number | string | null;
  country?: string | null;
  currency?: string | null;
  url?: string | null;
};

const parseOffer = (offer: MarketplaceOfferRow): WineOffer => {
  const parsedPrice =
    typeof offer.price === "string" ? Number.parseFloat(offer.price) : offer.price ?? null;
  const normalizedPrice = typeof parsedPrice === "number" && Number.isFinite(parsedPrice) ? parsedPrice : null;

  return {
    id: offer.id,
    labelHash: offer.label_hash ?? null,
    merchant: offer.merchant?.trim() ?? "",
    price: normalizedPrice,
    country: offer.country ?? null,
    currency: offer.currency ?? null,
    url: offer.url ?? null,
  };
};

const sortOffers = (a: WineOffer, b: WineOffer): number => {
  const aHasPrice = typeof a.price === "number";
  const bHasPrice = typeof b.price === "number";

  if (aHasPrice && bHasPrice) {
    return (a.price ?? 0) - (b.price ?? 0);
  }

  if (aHasPrice !== bHasPrice) {
    return aHasPrice ? -1 : 1;
  }

  return a.merchant.localeCompare(b.merchant, "sv");
};

export const getOffersByLabelHash = async (
  labelHash: string,
  opts?: { country?: string },
): Promise<WineOffer[]> => {
  if (!labelHash) {
    return [];
  }

  let query = supabase
    .from("marketplace_offers")
    .select("*")
    .eq("label_hash", labelHash);

  if (opts?.country) {
    query = query.eq("country", opts.country);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message ?? "Kunde inte hämta erbjudanden just nu.");
  }

  const offers = (data as MarketplaceOfferRow[] | null) ?? [];

  return offers.map(parseOffer).sort(sortOffers);
};
