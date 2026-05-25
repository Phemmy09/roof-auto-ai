import { NextResponse } from 'next/server';
import { processJobWithAI, capImageBuffer } from '@/lib/anthropic';
import { calculateAllMaterials } from '@/lib/formulas';
import { generatePDFBuffer } from '@/lib/pdf';
import { sendJobPDF } from '@/lib/email';
import { supabaseAdmin } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export const maxDuration = 300;

// ── Photo filename patterns — these are logged but NOT sent to Claude ──────
const PHOTO_PATTERNS = [
  'before', 'progress', 'completion', 'after',
  'photo', 'pic', 'image', 'drone',
];

// Max file size to send to Claude (4 MB base64 ≈ ~3 MB raw)
const MAX_FILE_BYTES = 4 * 1024 * 1024;

function setCors(response: NextResponse, requestOrigin?: string) {
  const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['*'];
  const origin =
    requestOrigin && allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins[0] || '*';
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

export async function OPTIONS(request: Request) {
  return setCors(NextResponse.json({}), request.headers.get('origin') || undefined);
}

// ── Helper: download a single file from Supabase Storage ───────────────────
async function downloadFromSupabase(filePath: string): Promise<Buffer | null> {
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'roof-documents';

  // Pre-prepare potential local file fallback
  let localFileBuffer: Buffer | null = null;
  try {
    const base = filePath.split('/').pop() || '';
    const underscoreIndex = base.indexOf('_');
    if (underscoreIndex !== -1) {
      const potentialName = base.substring(underscoreIndex + 1);
      const localPath = path.resolve('test data', potentialName);
      if (fs.existsSync(localPath)) {
        console.log(`[process-job] Found local fallback file: ${localPath}`);
        localFileBuffer = fs.readFileSync(localPath);
      }
    }
  } catch (localErr: any) {
    console.warn(`[process-job] Local fallback pre-check failed for ${filePath}:`, localErr.message);
  }

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(filePath);

    if (error || !data) {
      console.error(`[process-job] Download error for ${filePath}:`, error?.message);
      if (localFileBuffer) {
        console.log(`[process-job] Resilient fallback: Using local file for ${filePath}`);
        return localFileBuffer;
      }
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err: any) {
    console.error(`[process-job] Download exception for ${filePath}:`, err?.message);
    if (localFileBuffer) {
      console.log(`[process-job] Resilient fallback: Using local file on exception for ${filePath}`);
      return localFileBuffer;
    }
    return null;
  }
}

// ── Helper: fetch formula config from Supabase ─────────────────────────────
async function fetchFormulaConfig(): Promise<Record<string, any>> {
  try {
    const { data, error } = await supabaseAdmin
      .from('formula_config')
      .select('*')
      .eq('singleton_key', 'STATIC')
      .single();

    if (error || !data) return {};

    return {
      feltCoverage: data.felt_coverage,
      iceWaterCoverage: data.ice_water_coverage,
      ridgeCapCoverage: data.ridge_cap_coverage,
      dripEdgeLength: data.drip_edge_length,
      coilNailsCoverage: data.coil_nails_coverage,
      enableFelt: data.enable_felt,
      enableIceWater: data.enable_ice_water,
      enableRidgeCap: data.enable_ridge_cap,
      enableDripEdge: data.enable_drip_edge,
      enableCoilNails: data.enable_coil_nails,
    };
  } catch (err: any) {
    console.warn('[process-job] Formula config fetch error (using defaults):', err?.message);
    return {};
  }
}

// ── Consistency check: enforce alignment between scope, materials, and docs ─
function runConsistencyCheck(
  extractedData: any,
  calculatedMaterials: any,
  crewInstructions: string[],
  materialNotes: string[],
): { materials: any; instructions: string[]; notes: string[] } {
  const warnings: string[] = [];
  const materials = { ...calculatedMaterials };
  let instructions = [...crewInstructions];
  const ventStrategy = String(extractedData.ventilationStrategy || 'N/A');

  // 1. Ventilation: material quantities must match strategy
  if (ventStrategy === 'Box' && materials.ridgeVentSections > 0) {
    materials.ridgeVentSections = 0;
    warnings.push('CONSISTENCY FIX: Ridge vent sections removed — scope specifies Box/Static vents.');
  }
  if (ventStrategy === 'Ridge' && materials.boxVents > 0) {
    materials.boxVents = 0;
    warnings.push('CONSISTENCY FIX: Box vent count removed — scope specifies Ridge vent.');
  }

  // 2. Crew instruction contradiction — strip conflicting ventilation steps
  if (ventStrategy === 'Box') {
    const filtered = instructions.filter(
      (step) => !/ridge vent/i.test(step) || /do not/i.test(step),
    );
    if (filtered.length < instructions.length) {
      warnings.push('CONSISTENCY FIX: Ridge vent installation step removed from crew instructions — scope specifies Box/Static vents.');
    }
    instructions = filtered;
    const hasBoxInstruction = instructions.some((s) => /box vent|static vent|turtle vent/i.test(s));
    if (!hasBoxInstruction) {
      instructions.push(`Install ${extractedData.vents || 0} static/box vent(s) per EagleView count. Do NOT install ridge vent.`);
    }
  }
  if (ventStrategy === 'Ridge') {
    const filtered = instructions.filter(
      (step) => !/\bbox vent|turtle vent|static vent\b/i.test(step),
    );
    if (filtered.length < instructions.length) {
      warnings.push('CONSISTENCY FIX: Box/turtle vent installation step removed from crew instructions — scope specifies Ridge vent.');
    }
    instructions = filtered;
  }

  // 3. Quantity sanity check — shingles should be ~1.05–1.20× squares
  const sq = Number(extractedData.squares) || 0;
  if (sq > 0) {
    const ratio = materials.shingles / sq;
    if (ratio < 1.05 || ratio > 1.20) {
      warnings.push(`QUANTITY WARNING: Shingle quantity (${materials.shingles} SQ) is outside expected range for ${sq} measured squares. Verify before ordering.`);
    }
  }

  const notes = warnings.length > 0 ? [...materialNotes, ...warnings] : materialNotes;
  return { materials, instructions, notes };
}

// ── Main pipeline ──────────────────────────────────────────────────────────
export async function POST(request: Request) {
  const origin = request.headers.get('origin') || undefined;

  try {
    const payload = await request.json();
    const {
      customerName = 'Customer',
      address = '',
      email = '',
      notes: _notes = '',
      uploadedFiles = [],
    } = payload;

    console.log(`[process-job] Starting job for "${customerName}" — ${uploadedFiles.length} file(s)`);

    // ── 1. Download files from Supabase & build Claude content blocks ─────
    const claudeDocuments: any[] = [];
    const photoNames: string[] = [];

    for (const file of uploadedFiles) {
      const fileName = (file.name || '').toLowerCase();

      // Skip photos — note them but don't send to Claude
      if (PHOTO_PATTERNS.some((p) => fileName.includes(p))) {
        photoNames.push(file.name);
        continue;
      }

      const buffer = await downloadFromSupabase(file.path);
      if (!buffer) continue;

      const mimeType: string = file.mimeType || '';

      // Skip non-image files that exceed the limit — truncating a PDF makes it unreadable
      if (buffer.length > MAX_FILE_BYTES && !mimeType.startsWith('image/')) {
        console.warn(`[process-job] Skipping "${file.name}": ${(buffer.length / 1024 / 1024).toFixed(1)}MB exceeds the ${MAX_FILE_BYTES / 1024 / 1024}MB limit`);
        continue;
      }

      if (mimeType === 'application/pdf') {
        claudeDocuments.push({
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: buffer.toString('base64'),
          },
        });
      } else if (mimeType.startsWith('image/')) {
        const cappedImage = capImageBuffer(buffer);
        const normalizedMime = mimeType === 'image/jpg' ? 'image/jpeg' : mimeType;
        claudeDocuments.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: normalizedMime,
            data: cappedImage.toString('base64'),
          },
        });
      } else if (mimeType === 'text/plain') {
        claudeDocuments.push({
          type: 'text',
          text: buffer.toString('utf-8'),
        });
      }
    }

    console.log(`[process-job] ${claudeDocuments.length} doc(s) prepared for Claude, ${photoNames.length} photo(s) noted`);

    // ── 2. Call Claude AI for extraction ──────────────────────────────────
    const {
      extractedData,
      crewInstructions,
      laborItems,
      materialNotes,
    } = await processJobWithAI(claudeDocuments);

    // Append photo names to notes if any
    if (photoNames.length > 0) {
      const photoNote = `Photos on file: ${photoNames.join(', ')}`;
      extractedData.notes =
        extractedData.notes && extractedData.notes !== 'N/A'
          ? `${extractedData.notes} | ${photoNote}`
          : photoNote;
    }

    // ── 3. Fetch formula config & calculate materials ────────────────────
    const formulaConfig = await fetchFormulaConfig();
    const rawMaterials = await calculateAllMaterials(extractedData, formulaConfig);

    // ── 3b. Consistency check: sync materials, instructions, and notes ───
    const {
      materials: calculatedMaterials,
      instructions: finalInstructions,
      notes: finalNotes,
    } = runConsistencyCheck(extractedData, rawMaterials, crewInstructions, materialNotes);

    // ── 4. Generate PDF ──────────────────────────────────────────────────
    const pdfBuffer = await generatePDFBuffer(
      { ...extractedData, customerName, address },
      calculatedMaterials,
      finalInstructions,
      laborItems,
      finalNotes,
    );

    // ── 5. Send email with PDF attached ──────────────────────────────────
    let emailSent = false;
    if (email) {
      const emailResult = await sendJobPDF(email, pdfBuffer, customerName);
      emailSent = emailResult.success;
      if (!emailResult.success) {
        console.warn('[process-job] Email failed:', emailResult.error);
      }
    }

    console.log(`[process-job] Job complete — email ${emailSent ? 'sent' : 'skipped/failed'}`);

    // ── 6. Return results ────────────────────────────────────────────────
    return setCors(
      NextResponse.json({
        success: true,
        jobId: 'job-' + Date.now(),
        extractedData,
        calculatedMaterials,
        crewInstructions: finalInstructions,
        laborItems,
        materialNotes: finalNotes,
        emailSent,
        pdfBase64: pdfBuffer.toString('base64'),
      }),
      origin,
    );
  } catch (error: any) {
    console.error('[process-job] Fatal error:', error?.message || error);
    return setCors(
      NextResponse.json(
        { error: error.message || 'An error occurred during processing.' },
        { status: 500 },
      ),
      origin,
    );
  }
}
