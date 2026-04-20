import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function setCors(response: NextResponse) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS?.split(',')[0] || '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

export async function OPTIONS() {
  return setCors(NextResponse.json({}));
}

function mapToCamel(dbRes: any) {
  if (!dbRes) return null;
  return {
    singletonKey: dbRes.singleton_key,
    feltCoverage: dbRes.felt_coverage,
    iceWaterCoverage: dbRes.ice_water_coverage,
    ridgeCapCoverage: dbRes.ridge_cap_coverage,
    dripEdgeLength: dbRes.drip_edge_length,
    coilNailsCoverage: dbRes.coil_nails_coverage,
    enableFelt: dbRes.enable_felt,
    enableIceWater: dbRes.enable_ice_water,
    enableRidgeCap: dbRes.enable_ridge_cap,
    enableDripEdge: dbRes.enable_drip_edge,
    enableCoilNails: dbRes.enable_coil_nails
  };
}

const mockDefaultConfig = {
  singleton_key: 'STATIC', felt_coverage: 4, ice_water_coverage: 60, ridge_cap_coverage: 30, drip_edge_length: 10, coil_nails_coverage: 20,
  enable_felt: true, enable_ice_water: true, enable_ridge_cap: true, enable_drip_edge: true, enable_coil_nails: true
};

export async function GET() {
  try {
    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project')) {
      return setCors(NextResponse.json({ success: true, config: mapToCamel(mockDefaultConfig) }));
    }

    const { data, error } = await supabaseAdmin
      .from('formula_config')
      .select('*')
      .eq('singleton_key', 'STATIC')
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    let d = data;
    if (!d) {
       const { data: newData, error: insErr } = await supabaseAdmin.from('formula_config').insert([{ singleton_key: 'STATIC' }]).select().single();
       if (insErr) throw insErr;
       d = newData;
    }

    return setCors(NextResponse.json({ success: true, config: mapToCamel(d) }));
  } catch (error: any) {
    return setCors(NextResponse.json({ error: error.message }, { status: 500 }));
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const payload = {
      singleton_key: 'STATIC', felt_coverage: body.feltCoverage, ice_water_coverage: body.iceWaterCoverage,
      ridge_cap_coverage: body.ridgeCapCoverage, drip_edge_length: body.dripEdgeLength, coil_nails_coverage: body.coilNailsCoverage,
      enable_felt: body.enableFelt, enable_ice_water: body.enableIceWater, enable_ridge_cap: body.enableRidgeCap,
      enable_drip_edge: body.enableDripEdge, enable_coil_nails: body.enableCoilNails,
    };

    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project')) {
      return setCors(NextResponse.json({ success: true, config: mapToCamel(payload) }));
    }

    const { data: updated, error } = await supabaseAdmin.from('formula_config').upsert(payload, { onConflict: 'singleton_key' }).select().single();
    if (error) throw error;
    
    return setCors(NextResponse.json({ success: true, config: mapToCamel(updated) }));
  } catch (error: any) {
    return setCors(NextResponse.json({ error: error.message }, { status: 500 }));
  }
}
