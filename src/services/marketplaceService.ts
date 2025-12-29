/**
 * Marketplace service for wine offers.
 *
 * NOTE: The wine_offers table does not exist in the current database schema.
 * This service is a placeholder for future marketplace functionality.
 */

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
 * Fetch available wine offers for a given label hash.
 *
 * Currently returns an empty array as the wine_offers table
 * has not been created yet.
 *
 * @param labelHash The label_hash of the wine (from scans/analysis)
 * @param opts Optional filter options (e.g. country)
 */
export const getOffersByLabelHash = async (
  _labelHash: string,
  _opts?: { country?: string },
): Promise<WineOffer[]> => {
  // TODO: Implement when wine_offers table is created
  return [];
};
