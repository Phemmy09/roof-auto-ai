import { supabaseAdmin } from './supabase';

export async function calculateAllMaterials(data: any) {
  let activeConfig = {
    felt_coverage: 4, ice_water_coverage: 60, ridge_cap_coverage: 30, drip_edge_length: 10, coil_nails_coverage: 20,
    enable_felt: true, enable_ice_water: true, enable_ridge_cap: true, enable_drip_edge: true, enable_coil_nails: true
  };

  try {
    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project')) {
      throw new Error('Placeholder URL detected');
    }
    
    const { data: config, error } = await supabaseAdmin
      .from('formula_config')
      .select('*')
      .eq('singleton_key', 'STATIC')
      .single();
      
    if (!error && config) {
       activeConfig = config;
    }
  } catch (e) {
    console.warn("Using default formulas due to placeholder Supabase configurations.");
  }

  const squares = data.squares || 0;
  const valleys = data.valleys || 0;
  const eaves = data.eaves || 0;
  const ridges = data.ridges || 0;
  const hips = data.hips || 0;
  const rakes = data.rakes || 0;

  return {
    shingles: Math.ceil(squares),
    felt: activeConfig.enable_felt && activeConfig.felt_coverage > 0 ? Math.ceil(squares / activeConfig.felt_coverage) : 0,
    iceAndWater: activeConfig.enable_ice_water && activeConfig.ice_water_coverage > 0 ? Math.ceil((valleys + eaves) / activeConfig.ice_water_coverage) : 0,
    ridgeCap: activeConfig.enable_ridge_cap && activeConfig.ridge_cap_coverage > 0 ? Math.ceil((ridges + hips) / activeConfig.ridge_cap_coverage) : 0,
    dripEdge: activeConfig.enable_drip_edge && activeConfig.drip_edge_length > 0 ? Math.ceil((rakes + eaves) / activeConfig.drip_edge_length) : 0,
    coilNails: activeConfig.enable_coil_nails && activeConfig.coil_nails_coverage > 0 ? Math.ceil(squares / activeConfig.coil_nails_coverage) : 0
  };
}
