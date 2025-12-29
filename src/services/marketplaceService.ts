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

/**
 * Fetch available wine offers for a given label hash from Supabase.
 *
 * This function queries the `wine_offers` table and returns a list of
 * offers sorted by price (if present). Optionally, offers can be
 * filtered by country. If no offers are found for the given label hash,
 * up to three generic offers (sorted by price) are returned instead.
 * If any error occurs, an empty array is returned.
 *
 * @param labelHash The label_hash of the wine (from scans/analysis)
 * @param opts Optional filter options (e.g. country)
 */
export const getOffersByLabelHash = async (
  labelHash: string,
  opts?: { country?: string },
): Promise<WineOffer[]> => {
  try {
    if (!labelHash) return [];

    const selectColumns = "id,merchant_name,url,price,currency,country,label_hash";
    const sortByPrice = (a: WineOffer, b: WineOffer) => {
      if (a.price == null && b.price == null) return 0;
      if (a.price == null) return 1;
      if (b.price == null) return -1;
      return a.price - b.price;
    };
    const mapRow = (row: {
      id: string;
      merchant_name: string;
      url: string | null;
      price: number | null;
      currency: string | null;
      country: string | null;
      label_hash: string | null;
    }): WineOffer => ({
      id: row.id,
      labelHash: row.label_hash,
      merchant: row.merchant_name,
      price: row.price,
      country: row.country,
      currency: row.currency,
      url: row.url,
    });

    let query = supabase
      .from("wine_offers")
      .select(selectColumns)
      .eq("label_hash", labelHash);

    if (opts?.country) {
      query = query.eq("country", opts.country);
    }

    const { data: offers, error } = await query;
    if (error) {
      console.error("Error fetching offers:", error);
      return [];
    }

    if (offers && offers.length > 0) {
      return offers.map(mapRow).sort(sortByPrice);
    }

    const { data: fallbackData, error: fallbackError } = await supabase
      .from("wine_offers")
      .select(selectColumns)
      .order("price", { ascending: true })
      .limit(3);
    if (fallbackError) {
      console.error("Error fetching fallback offers:", fallbackError);
      return [];
    }

    if (!fallbackData || fallbackData.length === 0) {
      return [];
    }

    return fallbackData.map(mapRow).sort(sortByPrice);
  } catch (err) {
    console.error("Exception in getOffersByLabelHash:", err);
    return [];
  }
};
