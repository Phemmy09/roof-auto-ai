import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { DEFAULTS, type FormulaConfig } from '@/lib/formulas';

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

// ── DB row → FormulaConfig ────────────────────────────────────────────────
function mapToCamel(dbRes: any): FormulaConfig {
  if (!dbRes) return { ...DEFAULTS };
  const x: Partial<FormulaConfig> = dbRes.extra_config || {};

  return {
    // ── legacy main columns (kept for backward compat) ──
    feltCoverage:     dbRes.felt_coverage          ?? DEFAULTS.feltCoverage,
    ridgeCapCoverage: dbRes.ridge_cap_coverage     ?? DEFAULTS.ridgeCapCoverage,
    dripEdgeLength:   dbRes.drip_edge_length       ?? DEFAULTS.dripEdgeLength,
    coilNailsCoverage:dbRes.coil_nails_coverage    ?? DEFAULTS.coilNailsCoverage,
    enableFelt:       dbRes.enable_felt            ?? DEFAULTS.enableFelt,
    enableIceWater:   dbRes.enable_ice_water       ?? DEFAULTS.enableIceWater,
    enableRidgeCap:   dbRes.enable_ridge_cap       ?? DEFAULTS.enableRidgeCap,
    enableDripEdge:   dbRes.enable_drip_edge       ?? DEFAULTS.enableDripEdge,
    enableCoilNails:  dbRes.enable_coil_nails      ?? DEFAULTS.enableCoilNails,

    // ── extended settings (stored in extra_config JSONB) ──
    shinglesWasteFactor:       x.shinglesWasteFactor       ?? DEFAULTS.shinglesWasteFactor,
    ridgeCapWasteFactor:       x.ridgeCapWasteFactor       ?? DEFAULTS.ridgeCapWasteFactor,
    starterStripMinBundles:    x.starterStripMinBundles    ?? DEFAULTS.starterStripMinBundles,
    starterStripLFPerBundle:   x.starterStripLFPerBundle   ?? DEFAULTS.starterStripLFPerBundle,
    feltWasteFactor:           x.feltWasteFactor           ?? DEFAULTS.feltWasteFactor,
    iceWaterSqFtPerRoll:       x.iceWaterSqFtPerRoll       ?? DEFAULTS.iceWaterSqFtPerRoll,
    iceWaterEaveWidth:         x.iceWaterEaveWidth         ?? DEFAULTS.iceWaterEaveWidth,
    iceWaterValleyWidth:       x.iceWaterValleyWidth       ?? DEFAULTS.iceWaterValleyWidth,
    iceWaterSkylightSqFt:      x.iceWaterSkylightSqFt      ?? DEFAULTS.iceWaterSkylightSqFt,
    iceWaterChimneySqFt:       x.iceWaterChimneySqFt       ?? DEFAULTS.iceWaterChimneySqFt,
    iceWaterPipeBootSqFt:      x.iceWaterPipeBootSqFt      ?? DEFAULTS.iceWaterPipeBootSqFt,
    iceWaterWasteFactor:       x.iceWaterWasteFactor       ?? DEFAULTS.iceWaterWasteFactor,
    dripEdgeOverlapFactor:     x.dripEdgeOverlapFactor     ?? DEFAULTS.dripEdgeOverlapFactor,
    ridgeVentSectionLF:        x.ridgeVentSectionLF        ?? DEFAULTS.ridgeVentSectionLF,
    stepFlashingPcsPerLF:      x.stepFlashingPcsPerLF      ?? DEFAULTS.stepFlashingPcsPerLF,
    stepFlashingPcsPerBundle:  x.stepFlashingPcsPerBundle  ?? DEFAULTS.stepFlashingPcsPerBundle,
    valleyMetalLFPerRoll:      x.valleyMetalLFPerRoll      ?? DEFAULTS.valleyMetalLFPerRoll,
    capNailsThreshold:         x.capNailsThreshold         ?? DEFAULTS.capNailsThreshold,
    capNailsSmallJob:          x.capNailsSmallJob          ?? DEFAULTS.capNailsSmallJob,
    capNailsLargeJob:          x.capNailsLargeJob          ?? DEFAULTS.capNailsLargeJob,
    sealantMinTubes:           x.sealantMinTubes           ?? DEFAULTS.sealantMinTubes,
    sealantValleyLFPerTube:    x.sealantValleyLFPerTube    ?? DEFAULTS.sealantValleyLFPerTube,
    sealantRidgeHipLFPerTube:  x.sealantRidgeHipLFPerTube ?? DEFAULTS.sealantRidgeHipLFPerTube,
    muleHideLFPerTube:         x.muleHideLFPerTube         ?? DEFAULTS.muleHideLFPerTube,
    touchUpPaintBase:          x.touchUpPaintBase          ?? DEFAULTS.touchUpPaintBase,
    touchUpPaintAdditional:    x.touchUpPaintAdditional    ?? DEFAULTS.touchUpPaintAdditional,
    osbSheetsPerVent:          x.osbSheetsPerVent          ?? DEFAULTS.osbSheetsPerVent,
  };
}

// ── FormulaConfig → DB row ────────────────────────────────────────────────
function mapToDb(body: FormulaConfig) {
  const mainColumns = {
    singleton_key:      'STATIC',
    felt_coverage:      body.feltCoverage,
    // ice_water_coverage kept in schema but no longer used in formulas — set to 0
    ice_water_coverage: 0,
    ridge_cap_coverage: body.ridgeCapCoverage,
    drip_edge_length:   body.dripEdgeLength,
    coil_nails_coverage:body.coilNailsCoverage,
    enable_felt:        body.enableFelt,
    enable_ice_water:   body.enableIceWater,
    enable_ridge_cap:   body.enableRidgeCap,
    enable_drip_edge:   body.enableDripEdge,
    enable_coil_nails:  body.enableCoilNails,
  };

  const extra_config: Partial<FormulaConfig> = {
    shinglesWasteFactor:      body.shinglesWasteFactor,
    ridgeCapWasteFactor:      body.ridgeCapWasteFactor,
    starterStripMinBundles:   body.starterStripMinBundles,
    starterStripLFPerBundle:  body.starterStripLFPerBundle,
    feltWasteFactor:          body.feltWasteFactor,
    iceWaterSqFtPerRoll:      body.iceWaterSqFtPerRoll,
    iceWaterEaveWidth:        body.iceWaterEaveWidth,
    iceWaterValleyWidth:      body.iceWaterValleyWidth,
    iceWaterSkylightSqFt:     body.iceWaterSkylightSqFt,
    iceWaterChimneySqFt:      body.iceWaterChimneySqFt,
    iceWaterPipeBootSqFt:     body.iceWaterPipeBootSqFt,
    iceWaterWasteFactor:      body.iceWaterWasteFactor,
    dripEdgeOverlapFactor:    body.dripEdgeOverlapFactor,
    ridgeVentSectionLF:       body.ridgeVentSectionLF,
    stepFlashingPcsPerLF:     body.stepFlashingPcsPerLF,
    stepFlashingPcsPerBundle: body.stepFlashingPcsPerBundle,
    valleyMetalLFPerRoll:     body.valleyMetalLFPerRoll,
    capNailsThreshold:        body.capNailsThreshold,
    capNailsSmallJob:         body.capNailsSmallJob,
    capNailsLargeJob:         body.capNailsLargeJob,
    sealantMinTubes:          body.sealantMinTubes,
    sealantValleyLFPerTube:   body.sealantValleyLFPerTube,
    sealantRidgeHipLFPerTube: body.sealantRidgeHipLFPerTube,
    muleHideLFPerTube:        body.muleHideLFPerTube,
    touchUpPaintBase:         body.touchUpPaintBase,
    touchUpPaintAdditional:   body.touchUpPaintAdditional,
    osbSheetsPerVent:         body.osbSheetsPerVent,
  };

  return { mainColumns, extra_config };
}

const mockDefaultRow = {
  singleton_key: 'STATIC',
  felt_coverage: DEFAULTS.feltCoverage,
  ice_water_coverage: 0,
  ridge_cap_coverage: DEFAULTS.ridgeCapCoverage,
  drip_edge_length: DEFAULTS.dripEdgeLength,
  coil_nails_coverage: DEFAULTS.coilNailsCoverage,
  enable_felt: DEFAULTS.enableFelt,
  enable_ice_water: DEFAULTS.enableIceWater,
  enable_ridge_cap: DEFAULTS.enableRidgeCap,
  enable_drip_edge: DEFAULTS.enableDripEdge,
  enable_coil_nails: DEFAULTS.enableCoilNails,
  extra_config: null,
};

export async function GET(request: Request) {
  const origin = request.headers.get('origin') || undefined;
  try {
    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project')) {
      return setCors(NextResponse.json({ success: true, config: mapToCamel(mockDefaultRow), source: 'mock' }), origin);
    }

    const { data, error } = await supabaseAdmin
      .from('formula_config')
      .select('*')
      .eq('singleton_key', 'STATIC')
      .single();

    if (error) {
      const isMissingTable =
        error.code === '42P01' ||
        error.message?.includes('relation') ||
        error.message?.includes('schema cache') ||
        error.message?.includes('does not exist');
      if (isMissingTable) {
        console.warn('[formula_config] Table not found — returning defaults.');
        return setCors(NextResponse.json({ success: true, config: mapToCamel(mockDefaultRow), source: 'fallback' }), origin);
      }
      if (error.code === 'PGRST116') {
        const { data: newData, error: insErr } = await supabaseAdmin
          .from('formula_config')
          .insert([{ singleton_key: 'STATIC' }])
          .select()
          .single();
        if (insErr) {
          return setCors(NextResponse.json({ success: true, config: mapToCamel(mockDefaultRow), source: 'fallback' }), origin);
        }
        return setCors(NextResponse.json({ success: true, config: mapToCamel(newData) }), origin);
      }
      throw error;
    }

    return setCors(NextResponse.json({ success: true, config: mapToCamel(data) }), origin);
  } catch (error: any) {
    console.error('[formula_config GET] Error:', error.message);
    return setCors(NextResponse.json({ success: true, config: mapToCamel(mockDefaultRow), source: 'error-fallback' }), origin);
  }
}

export async function PUT(request: Request) {
  const origin = request.headers.get('origin') || undefined;
  try {
    const body: FormulaConfig = await request.json();
    const { mainColumns, extra_config } = mapToDb(body);

    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('your-project')) {
      return setCors(NextResponse.json({ success: true, config: body }), origin);
    }

    // Try with extra_config column; if it doesn't exist yet, fall back to main columns only
    let savedData: any = null;
    let extraConfigWarning = false;

    const { data: full, error: fullErr } = await supabaseAdmin
      .from('formula_config')
      .upsert({ ...mainColumns, extra_config }, { onConflict: 'singleton_key' })
      .select()
      .single();

    if (fullErr) {
      const isColumnMissing =
        fullErr.message?.includes('extra_config') ||
        fullErr.message?.includes('column') ||
        fullErr.code === '42703';

      if (isColumnMissing) {
        // extra_config column not yet added — save main columns only
        console.warn('[formula_config] extra_config column missing — saving base columns only. Run: ALTER TABLE formula_config ADD COLUMN IF NOT EXISTS extra_config JSONB DEFAULT \'{}\'::jsonb;');
        const { data: partial, error: partialErr } = await supabaseAdmin
          .from('formula_config')
          .upsert(mainColumns, { onConflict: 'singleton_key' })
          .select()
          .single();
        if (partialErr) throw partialErr;
        savedData = partial;
        extraConfigWarning = true;
      } else {
        const isMissingTable =
          fullErr.code === '42P01' ||
          fullErr.message?.includes('relation') ||
          fullErr.message?.includes('does not exist');
        if (isMissingTable) {
          return setCors(NextResponse.json(
            { error: 'Formula config table not found. Run supabase_schema.sql to create it.' },
            { status: 500 },
          ), origin);
        }
        throw fullErr;
      }
    } else {
      savedData = full;
    }

    return setCors(NextResponse.json({
      success: true,
      config: mapToCamel(savedData),
      warning: extraConfigWarning
        ? 'Extended settings could not be saved — add extra_config JSONB column to persist them: ALTER TABLE formula_config ADD COLUMN IF NOT EXISTS extra_config JSONB DEFAULT \'{}\'::jsonb;'
        : undefined,
    }), origin);
  } catch (error: any) {
    console.error('[formula_config PUT] Error:', error.message);
    return setCors(NextResponse.json({ error: error.message }, { status: 500 }), origin);
  }
}
