-- Run this SQL in Supabase Dashboard → SQL Editor to create required tables

-- Table: carbon_purchases (stores Razorpay payment records)
CREATE TABLE IF NOT EXISTS public.carbon_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  payment_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  amount_inr NUMERIC NOT NULL,
  credits_kg INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'captured',
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  species TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.carbon_purchases ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own purchases
CREATE POLICY "Users can view own purchases" ON public.carbon_purchases
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Service role can insert/update (used by backend webhook)
CREATE POLICY "Service role full access to purchases" ON public.carbon_purchases
  FOR ALL USING (auth.role() = 'service_role');

-- Table: carbon_listings (stores NFT carbon credit listings from sellers)
CREATE TABLE IF NOT EXISTS public.carbon_listings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_address TEXT NOT NULL,
  token_id INTEGER,
  species TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price_inr NUMERIC NOT NULL,
  tx_hash TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  lat NUMERIC,
  lng NUMERIC,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.carbon_listings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view all listings (marketplace & dashboards)
CREATE POLICY "Public can view all listings" ON public.carbon_listings
  FOR SELECT USING (true);

-- Policy: Service role full access
CREATE POLICY "Service role full access to listings" ON public.carbon_listings
  FOR ALL USING (auth.role() = 'service_role');

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchases_user_id ON public.carbon_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_listings_seller ON public.carbon_listings(seller_address);
CREATE INDEX IF NOT EXISTS idx_listings_status ON public.carbon_listings(status);
