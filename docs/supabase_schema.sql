-- Supabase Schema Setup for Roof Auto

-- 1. Create Jobs Table
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_name TEXT NOT NULL,
  address TEXT NOT NULL,
  email TEXT NOT NULL,
  notes TEXT,
  extracted_data JSONB,
  calculated_materials JSONB,
  blob_urls TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Formula Config Table
CREATE TABLE IF NOT EXISTS public.formula_config (
  singleton_key TEXT PRIMARY KEY DEFAULT 'STATIC',
  felt_coverage NUMERIC DEFAULT 4,
  ice_water_coverage NUMERIC DEFAULT 60,
  ridge_cap_coverage NUMERIC DEFAULT 30,
  drip_edge_length NUMERIC DEFAULT 10,
  coil_nails_coverage NUMERIC DEFAULT 20,
  enable_felt BOOLEAN DEFAULT TRUE,
  enable_ice_water BOOLEAN DEFAULT TRUE,
  enable_ridge_cap BOOLEAN DEFAULT TRUE,
  enable_drip_edge BOOLEAN DEFAULT TRUE,
  enable_coil_nails BOOLEAN DEFAULT TRUE
);

-- Insert initial formula config row
INSERT INTO public.formula_config (singleton_key) 
VALUES ('STATIC')
ON CONFLICT (singleton_key) DO NOTHING;

-- 3. Storage bucket setup
-- Ensure you have created a public bucket named 'roof-documents'
INSERT INTO storage.buckets (id, name, public) 
VALUES ('roof-documents', 'roof-documents', TRUE)
ON CONFLICT (id) DO NOTHING;
