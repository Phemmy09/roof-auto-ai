/**
 * Create the formula_config table using Supabase Management API
 * Run: node create-table.mjs
 */
import https from 'https';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve('.env.local') });

const serviceKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseUrl = process.env.SUPABASE_URL;

// Extract project ref from URL (e.g. https://abc123.supabase.co -> abc123)
const projectRef = supabaseUrl?.replace('https://', '').split('.')[0];

if (!projectRef || !serviceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const sql = `
CREATE TABLE IF NOT EXISTS public.formula_config (
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

INSERT INTO public.formula_config (singleton_key, felt_coverage, ice_water_coverage, ridge_cap_coverage, drip_edge_length, coil_nails_coverage, enable_felt, enable_ice_water, enable_ridge_cap, enable_drip_edge, enable_coil_nails)
VALUES ('STATIC', 10, 60, 31, 10, 12, true, true, true, true, true)
ON CONFLICT (singleton_key) DO NOTHING;
`.trim();

const body = JSON.stringify({ query: sql });

const options = {
  hostname: `${projectRef}.supabase.co`,
  path: '/rest/v1/rpc/exec',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'apikey': serviceKey,
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Length': Buffer.byteLength(body),
  }
};

// Try pg-meta endpoint
const options2 = {
  hostname: 'api.supabase.com',
  path: `/v1/projects/${projectRef}/database/query`,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${serviceKey}`,
    'Content-Length': Buffer.byteLength(body),
  }
};

function makeRequest(opts, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log(`Project ref: ${projectRef}`);
  console.log('Attempting to create formula_config table via Management API...');
  
  try {
    const result = await makeRequest(options2, body);
    console.log('Status:', result.status);
    console.log('Response:', result.body);
    
    if (result.status >= 200 && result.status < 300) {
      console.log('✅ Table created successfully!');
    } else {
      console.log('⚠️ Response not 2xx. The table may need to be created manually.');
      printManualInstructions();
    }
  } catch(e) {
    console.error('Request failed:', e.message);
    printManualInstructions();
  }
}

function printManualInstructions() {
  console.log('\n=== MANUAL SETUP REQUIRED ===');
  console.log('Go to: https://supabase.com/dashboard/project/' + projectRef + '/sql/new');
  console.log('\nPaste and run this SQL:\n');
  console.log(sql);
  console.log('\n================================');
}

main();
