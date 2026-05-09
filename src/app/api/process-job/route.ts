import { NextResponse } from 'next/server';
import { processJobWithAI, capImageBuffer } from '@/lib/anthropic';
import { calculateAllMaterials } from '@/lib/formulas';
import { generatePDFBuffer } from '@/lib/pdf';
import { sendJobPDF } from '@/lib/email';
import { supabaseAdmin } from '@/lib/supabase';

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

  try {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .download(filePath);

    if (error || !data) {
      console.error(`[process-job] Download error for ${filePath}:`, error?.message);
      return null;
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err: any) {
    console.error(`[process-job] Download exception for ${filePath}:`, err?.message);
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
    const calculatedMaterials = await calculateAllMaterials(extractedData, formulaConfig);

    // ── 4. Generate PDF ──────────────────────────────────────────────────
    const pdfBuffer = await generatePDFBuffer(
      { ...extractedData, customerName, address },
      calculatedMaterials,
      crewInstructions,
      laborItems,
      materialNotes,
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
        crewInstructions,
        laborItems,
        materialNotes,
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
