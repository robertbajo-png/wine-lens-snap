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
 * offers sorted by price (if present).  Optionally, offers can be
 * filtered by country.  If no offers are found or an error occurs,
 * an empty array is returned.
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

    let query = supabase
      .from("wine_offers")
      .select("id,label_hash,merchant_name,price,country,currency,url")
      .eq("label_hash", labelHash);

    if (opts?.country) {
      query = query.eq("country", opts.country);
    }

    const { data, error } = await query.order("price", { ascending: true });
    if (error) {
      console.warn("Failed to fetch wine offers", error);
      return [];
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      labelHash: row.label_hash,
      merchant: row.merchant_name,
      price: row.price,
      country: row.country,
      currency: row.currency,
      url: row.url,
    }));
  } catch (err) {
    console.error(err);
    return [];
  }
};
