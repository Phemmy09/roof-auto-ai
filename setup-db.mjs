import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve('.env.local') });

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('Creating formula_config table via direct insert + upsert pattern...');

  // Try inserting a row — if the table doesn't exist this will error with a specific code
  const { data, error } = await supabase
    .from('formula_config')
    .upsert([{
      singleton_key: 'STATIC',
      felt_coverage: 10,
      ice_water_coverage: 60,
      ridge_cap_coverage: 31,
      drip_edge_length: 10,
      coil_nails_coverage: 12,
      enable_felt: true,
      enable_ice_water: true,
      enable_ridge_cap: true,
      enable_drip_edge: true,
      enable_coil_nails: true,
    }], { onConflict: 'singleton_key' })
    .select()
    .single();

  if (error) {
    if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('schema cache')) {
      console.error('\n❌ Table does not exist. You must create it manually in the Supabase Dashboard.');
      console.error('\n--- Copy & Run this SQL in Supabase Dashboard → SQL Editor ---\n');
      console.error(`CREATE TABLE IF NOT EXISTS public.formula_config (
  singleton_key TEXT PRIMARY KEY DEFAULT 'STATIC',
  felt_coverage NUMERIC DEFAULT 10,
  ice_water_coverage NUMERIC DEFAULT 60,
  ridge_cap_coverage NUMERIC DEFAULT 31,
  drip_edge_length NUMERIC DEFAULT 10,
  coil_nails_coverage NUMERIC DEFAULT 12,
  enable_felt BOOLEAN DEFAULT TRUE,
  enable_ice_water BOOLEAN DEFAULT TRUE,
  enable_ridge_cap BOOLEAN DEFAULT TRUE,
  enable_drip_edge BOOLEAN DEFAULT TRUE,
  enable_coil_nails BOOLEAN DEFAULT TRUE
);

INSERT INTO public.formula_config (singleton_key)
VALUES ('STATIC')
ON CONFLICT (singleton_key) DO NOTHING;`);
      console.error('\n----------------------------------------------------------------\n');
      process.exit(1);
    }
    console.error('Upsert error:', error);
    process.exit(1);
  }

  console.log('✅ formula_config table exists and default row is seeded:', data);

  // Verify jobs table
  const { error: jobErr } = await supabase.from('jobs').select('id').limit(1);
  if (jobErr) {
    console.warn('⚠️  jobs table issue:', jobErr.message);
  } else {
    console.log('✅ jobs table verified');
  }

  // Verify storage bucket
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucket = buckets?.find(b => b.name === 'roof-documents');
  console.log(bucket ? '✅ roof-documents storage bucket verified' : '⚠️  roof-documents bucket missing');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
