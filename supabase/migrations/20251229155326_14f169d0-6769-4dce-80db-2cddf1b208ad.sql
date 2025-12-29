-- Create wine_offers table for marketplace functionality
CREATE TABLE public.wine_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label_hash TEXT NOT NULL,
  merchant_name TEXT NOT NULL,
  url TEXT,
  price NUMERIC(10,2),
  currency TEXT DEFAULT 'SEK',
  country TEXT DEFAULT 'SE',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups by label_hash
CREATE INDEX idx_wine_offers_label_hash ON public.wine_offers(label_hash);

-- Enable RLS
ALTER TABLE public.wine_offers ENABLE ROW LEVEL SECURITY;

-- Wine offers are publicly viewable (for price comparison)
CREATE POLICY "Wine offers are viewable by everyone"
ON public.wine_offers
FOR SELECT
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_wine_offers_updated_at
BEFORE UPDATE ON public.wine_offers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();