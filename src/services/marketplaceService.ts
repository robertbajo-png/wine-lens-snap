export type WineOffer = {
  id: string;
  labelHash: string | null;
  merchant: string;
  price: number | null;
  country: string | null;
  currency: string | null;
  url: string | null;
};

// TODO: Implement when marketplace_offers table is created
export const getOffersByLabelHash = async (
  _labelHash: string,
  _opts?: { country?: string },
): Promise<WineOffer[]> => {
  // Return empty array until marketplace_offers table exists
  return [];
};
