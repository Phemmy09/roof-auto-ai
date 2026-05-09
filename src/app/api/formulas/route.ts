import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

function setCors(response: NextResponse, requestOrigin?: string) {
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['*'];
  const origin =
    requestOrigin && allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins[0] || '*';
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

export async function OPTIONS(request: Request) {
  return setCors(NextResponse.json({}), request.headers.get('origin') || undefined);
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
  singleton_key: 'STATIC', felt_coverage: 10, ice_water_coverage: 60, ridge_cap_coverage: 31, drip_edge_length: 10, coil_nails_coverage: 12,
  enable_felt: true, enable_ice_water: true, enable_ridge_cap: true, enable_drip_edge: true, enable_coil_nails: true
};

export async function GET(request: Request) {
  const origin = request.headers.get('origin') || undefined;
  try {
    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project')) {
      return setCors(NextResponse.json({ success: true, config: mapToCamel(mockDefaultConfig), source: 'mock' }), origin);
    }

    const { data, error } = await supabaseAdmin
      .from('formula_config')
      .select('*')
      .eq('singleton_key', 'STATIC')
      .single();

    // Table missing (42P01) or schema cache miss — fall back to defaults gracefully
    if (error) {
      const isMissingTable = error.code === '42P01' ||
        error.message?.includes('relation') ||
        error.message?.includes('schema cache') ||
        error.message?.includes('does not exist');
      if (isMissingTable) {
        console.warn('[formula_config] Table not found — returning defaults. Run supabase_schema.sql to create it.');
        return setCors(NextResponse.json({ success: true, config: mapToCamel(mockDefaultConfig), source: 'fallback' }), origin);
      }
      // Row simply not found (PGRST116) — try to insert default row
      if (error.code === 'PGRST116') {
        const { data: newData, error: insErr } = await supabaseAdmin
          .from('formula_config')
          .insert([{ singleton_key: 'STATIC' }])
          .select()
          .single();
        if (insErr) {
          console.warn('[formula_config] Could not insert default row:', insErr.message);
          return setCors(NextResponse.json({ success: true, config: mapToCamel(mockDefaultConfig), source: 'fallback' }), origin);
        }
        return setCors(NextResponse.json({ success: true, config: mapToCamel(newData) }), origin);
      }
      throw error;
    }

    return setCors(NextResponse.json({ success: true, config: mapToCamel(data) }), origin);
  } catch (error: any) {
    console.error('[formula_config GET] Unexpected error:', error.message);
    // Always return something usable — never 500 this endpoint
    return setCors(NextResponse.json({ success: true, config: mapToCamel(mockDefaultConfig), source: 'error-fallback' }), origin);
  }
}

export async function PUT(request: Request) {
  const origin = request.headers.get('origin') || undefined;
  try {
    const body = await request.json();
    const payload = {
      singleton_key: 'STATIC',
      felt_coverage: body.feltCoverage,
      ice_water_coverage: body.iceWaterCoverage,
      ridge_cap_coverage: body.ridgeCapCoverage,
      drip_edge_length: body.dripEdgeLength,
      coil_nails_coverage: body.coilNailsCoverage,
      enable_felt: body.enableFelt,
      enable_ice_water: body.enableIceWater,
      enable_ridge_cap: body.enableRidgeCap,
      enable_drip_edge: body.enableDripEdge,
      enable_coil_nails: body.enableCoilNails,
    };

    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project')) {
      return setCors(NextResponse.json({ success: true, config: mapToCamel(payload) }), origin);
    }

    const { data: updated, error } = await supabaseAdmin
      .from('formula_config')
      .upsert(payload, { onConflict: 'singleton_key' })
      .select()
      .single();

    if (error) {
      const isMissingTable = error.code === '42P01' ||
        error.message?.includes('relation') ||
        error.message?.includes('schema cache') ||
        error.message?.includes('does not exist');
      if (isMissingTable) {
        console.error('[formula_config] Table not found — config not saved. Run supabase_schema.sql to persist.');
        return setCors(NextResponse.json(
          { error: 'Formula config table not found. Contact your administrator to run supabase_schema.sql.' },
          { status: 500 }
        ), origin);
      }
      throw error;
    }

    return setCors(NextResponse.json({ success: true, config: mapToCamel(updated) }), origin);
  } catch (error: any) {
    console.error('[formula_config PUT] Error:', error.message);
    return setCors(NextResponse.json({ error: error.message }, { status: 500 }), origin);
  }
}
