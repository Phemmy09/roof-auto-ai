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

// ── Consistency check: enforce alignment between scope, materials, labor, and crew docs ─
function runConsistencyCheck(
  extractedData: any,
  calculatedMaterials: any,
  crewInstructions: string[],
  laborItems: string[],
  materialNotes: string[],
): { materials: any; instructions: string[]; laborItems: string[]; notes: string[] } {
  const warnings: string[] = [];
  const materials = { ...calculatedMaterials };
  let instructions = [...crewInstructions];
  let finalLabor: string[] = [];

  // 1. Robust Ventilation Strategy Normalization
  let rawStrategy = String(extractedData.ventilationStrategy || 'N/A').trim();
  let ventStrategy = 'N/A';
  if (/hybrid/i.test(rawStrategy)) {
    ventStrategy = 'Hybrid';
  } else if (/box|turtle|static/i.test(rawStrategy)) {
    ventStrategy = 'Box';
  } else if (/ridge/i.test(rawStrategy)) {
    ventStrategy = 'Ridge';
  }

  // Override ventilation strategy if crew instructions specifically indicate DO NOT install ridge vent
  const hasDoNotRidge = instructions.some(step => /do not install ridge vent/i.test(step) || /no ridge vent/i.test(step));
  if (hasDoNotRidge && ventStrategy !== 'Box') {
    ventStrategy = 'Box';
    warnings.push('CONSISTENCY FIX: Ventilation Strategy synchronized to Box Vents based on crew instructions.');
  }

  extractedData.ventilationStrategy = ventStrategy;

  // 2. Ventilation: Material quantities alignment
  if (ventStrategy === 'Box') {
    if (materials.ridgeVentSections > 0) {
      materials.ridgeVentSections = 0;
      warnings.push('CONSISTENCY FIX: Ridge vent sections removed — scope specifies Box/Static vents.');
    }
    const boxCount = Number(extractedData.vents) || Number(extractedData.insuranceVents) || 0;
    materials.boxVents = boxCount > 0 ? boxCount : 4;
  } else if (ventStrategy === 'Ridge') {
    if (materials.boxVents > 0) {
      materials.boxVents = 0;
      warnings.push('CONSISTENCY FIX: Box vent count removed — scope specifies Ridge vent.');
    }
    if (materials.ridgeVentSections === 0 && (Number(extractedData.ridges) || Number(extractedData.insuranceRidgeLF) || 0) > 0) {
      const ridgeLen = Number(extractedData.ridges) || Number(extractedData.insuranceRidgeLF) || 0;
      materials.ridgeVentSections = Math.ceil(ridgeLen / 4);
    }
  } else if (ventStrategy === 'Hybrid') {
    // Keep both
  } else {
    materials.ridgeVentSections = 0;
    materials.boxVents = 0;
  }

  // 3. Ventilation: Crew instruction alignment
  if (ventStrategy === 'Box') {
    instructions = instructions.filter(
      (step) => !/ridge vent/i.test(step) || /do not/i.test(step),
    );
    const hasBoxInstruction = instructions.some((s) => /box vent|static vent|turtle vent/i.test(s));
    if (!hasBoxInstruction) {
      instructions.push(`Remove old vents and install ${materials.boxVents} static/box vent(s) per EagleView count. Do NOT install ridge vent.`);
    }
    const hasDoNotRidgeExact = instructions.some((s) => /do not install ridge vent/i.test(s));
    if (!hasDoNotRidgeExact) {
      instructions.push("Do NOT install ridge vent.");
    }
  } else if (ventStrategy === 'Ridge') {
    instructions = instructions.filter(
      (step) => !/\bbox vent|turtle vent|static vent\b/i.test(step) || /do not/i.test(step),
    );
    const hasRidgeInstruction = instructions.some((s) => /ridge vent/i.test(s) && !/do not/i.test(s));
    if (!hasRidgeInstruction) {
      instructions.push(`Cut-in ridge line per sketch. Install ridge vent sections per material order. Do NOT install box/turtle vents.`);
    }
  } else if (ventStrategy === 'N/A') {
    instructions = instructions.filter(
      (step) => !/ridge vent|box vent|turtle vent|static/i.test(step) || /remove/i.test(step),
    );
  }

  // 4. Ventilation: Notes alignment
  let filteredNotes = materialNotes.filter((note) => {
    if (ventStrategy === 'Box' && /ridge vent/i.test(note) && !/do not|exclude/i.test(note)) return false;
    if (ventStrategy === 'Ridge' && /box vent|turtle vent|static vent/i.test(note) && !/do not|exclude/i.test(note)) return false;
    if (ventStrategy === 'N/A' && /ridge vent|box vent|turtle vent|static/i.test(note)) return false;
    return true;
  });

  if (ventStrategy === 'Box') {
    if (!filteredNotes.some(note => /box vent/i.test(note))) {
      filteredNotes.push('Scope specifies Box vents. Ridge vent is excluded.');
    }
  } else if (ventStrategy === 'Ridge') {
    if (!filteredNotes.some(note => /ridge vent/i.test(note))) {
      filteredNotes.push('Scope specifies Ridge vent. Box vents are excluded.');
    }
  }

  // 5. Quantity Sanity Checks, Validations & Overrides
  const sq = Number(extractedData.squares) || 0;
  if (sq > 0) {
    const expectedShingles = Math.ceil(sq * 1.10);
    if (materials.shingles !== expectedShingles) {
      materials.shingles = expectedShingles;
      warnings.push(`QUANTITY SYNC: Field shingles adjusted to match squares formula (${expectedShingles} SQ).`);
    }
  }

  const sidewallLF = Number(extractedData.sidewallLF) || 0;

  // Step flashing
  const expectedStep = sidewallLF > 0 ? Math.ceil((sidewallLF * 2.64) / 45) : 0;
  if (materials.stepFlashing !== expectedStep) {
    materials.stepFlashing = expectedStep;
  }
  // If instructions or notes reference step flashing but it is calculated as 0, set to 1 bundle default
  if (materials.stepFlashing === 0 && (instructions.some(s => /step flashing/i.test(s)) || filteredNotes.some(n => /step flashing/i.test(n)))) {
    materials.stepFlashing = 1;
    warnings.push('CONSISTENCY FIX: Step flashing set to 1 bundle based on crew instructions / notes.');
  }

  // Counter flashing
  const expectedCounter = extractedData.hasChimney ? 1 : 0;
  materials.counterFlashing = expectedCounter;
  if (materials.counterFlashing === 0 && (instructions.some(s => /counter flashing/i.test(s) || /chimney flashing/i.test(s)) || filteredNotes.some(n => /counter flashing/i.test(n)))) {
    materials.counterFlashing = 1;
    warnings.push('CONSISTENCY FIX: Counter flashing set to 1 set based on crew instructions / notes.');
  }

  // Touch-up paint
  const expectedPaint = (materials.dripEdge > 0 || materials.stepFlashing > 0 || materials.counterFlashing > 0 || materials.pipeJacks > 0 || materials.boxVents > 0 || materials.ridgeVentSections > 0) ? 2 : 0;
  materials.touchUpPaint = expectedPaint;

  // 6. Quantity validations (EagleView vs Insurance Scope)
  const evSq = Number(extractedData.squares) || 0;
  const insSq = Number(extractedData.insuranceSquares) || 0;
  if (evSq > 0 && insSq > 0) {
    const diffPct = Math.abs(evSq - insSq) / evSq;
    if (diffPct > 0.10) {
      warnings.push(`QUANTITY WARNING: Measured roof size (${evSq} SQ) and Insurance Scope shingles quantity (${insSq} SQ) differ by ${(diffPct * 100).toFixed(0)}%. Verify actual roof area.`);
    }
  }

  const evVents = Number(extractedData.vents) || 0;
  const insVents = Number(extractedData.insuranceVents) || 0;
  if (evVents > 0 && insVents > 0 && evVents !== insVents) {
    warnings.push(`QUANTITY WARNING: Measured vent count (${evVents}) differs from Insurance Scope vent count (${insVents}).`);
  }

  const evDripEdge = (Number(extractedData.eaves) || 0) + (Number(extractedData.rakes) || 0);
  const insDripEdge = Number(extractedData.insuranceDripEdgeLF) || 0;
  if (evDripEdge > 0 && insDripEdge > 0) {
    const diffPct = Math.abs(evDripEdge - insDripEdge) / evDripEdge;
    if (diffPct > 0.15) {
      warnings.push(`QUANTITY WARNING: Measured drip edge length (${evDripEdge} LF) and Insurance Scope drip edge (${insDripEdge} LF) differ by ${(diffPct * 100).toFixed(0)}%.`);
    }
  }

  const evRidge = Number(extractedData.ridges) || 0;
  const insRidge = Number(extractedData.insuranceRidgeLF) || 0;
  if (evRidge > 0 && insRidge > 0) {
    const diffPct = Math.abs(evRidge - insRidge) / evRidge;
    if (diffPct > 0.15) {
      warnings.push(`QUANTITY WARNING: Measured ridge length (${evRidge} LF) and Insurance Scope ridge vent (${insRidge} LF) differ by ${(diffPct * 100).toFixed(0)}%.`);
    }
  }

  // 7. Restrict Labor Items strictly to approved Master List
  const approvedLabor = [
    'Tear-off',
    'Second story charge',
    'Steep slope charge',
    'Skylight replacement',
    'Chimney flashing',
    'Gutter replacement',
    'Satellite dish reset',
    'Heat cable R&R',
    'Solar panel removal',
    'Permit fee',
    'Mid-roof inspection fee',
    'Decking replacement'
  ];

  const laborSet = new Set<string>();

  // Always include tear-off if squares > 0
  if (sq > 0) {
    laborSet.add('Tear-off');
  }

  // Steep slope check: pitch > 8/12
  const pitchStr = String(extractedData.pitch || '');
  const pitchNum = parseInt(pitchStr.split('/')[0]) || 0;
  if (pitchNum > 8 || pitchStr.toLowerCase().includes('steep') || /9\/12|10\/12|11\/12|12\/12/i.test(pitchStr)) {
    laborSet.add('Steep slope charge');
  }

  // Skylights
  if (extractedData.hasSkylights || (Number(extractedData.skylightCount) || 0) > 0) {
    laborSet.add('Skylight replacement');
  }

  // Chimney
  if (extractedData.hasChimney) {
    laborSet.add('Chimney flashing');
  }

  // Solar
  if (extractedData.hasSolarPanels) {
    laborSet.add('Solar panel removal');
  }

  // Heat Cable
  if (extractedData.hasHeatCable) {
    laborSet.add('Heat cable R&R');
  }

  // Now, merge in LLM's labor items but map them strictly to the approved list
  for (const item of laborItems) {
    const matched = approvedLabor.find(a => 
      item.toLowerCase().includes(a.toLowerCase()) || 
      a.toLowerCase().includes(item.toLowerCase())
    );
    if (matched) {
      laborSet.add(matched);
    } else {
      if (item.toLowerCase().includes('story') || item.toLowerCase().includes('2nd') || item.toLowerCase().includes('two')) {
        laborSet.add('Second story charge');
      } else if (item.toLowerCase().includes('permit')) {
        laborSet.add('Permit fee');
      } else if (item.toLowerCase().includes('inspect')) {
        laborSet.add('Mid-roof inspection fee');
      } else if (item.toLowerCase().includes('deck') || item.toLowerCase().includes('plywood') || item.toLowerCase().includes('osb')) {
        laborSet.add('Decking replacement');
      } else if (item.toLowerCase().includes('gutter')) {
        laborSet.add('Gutter replacement');
      } else if (item.toLowerCase().includes('satellite') || item.toLowerCase().includes('dish')) {
        laborSet.add('Satellite dish reset');
      }
    }
  }

  // Align labor items with ventilation strategy
  let alignedLabor = Array.from(laborSet);
  if (ventStrategy === 'Box') {
    alignedLabor = alignedLabor.filter(item => !/ridge vent|rfg h00/i.test(item));
  } else if (ventStrategy === 'Ridge') {
    alignedLabor = alignedLabor.filter(item => !/box vent|rfg box/i.test(item));
  } else if (ventStrategy === 'N/A') {
    alignedLabor = alignedLabor.filter(item => !/ridge vent|box vent|rfg h00|rfg box/i.test(item));
  }

  finalLabor = alignedLabor;

  // 8. General cleanup of crew instructions (ensure no contradictions)
  if (!extractedData.hasChimney) {
    instructions = instructions.filter(step => !/chimney/i.test(step));
  }
  if (!extractedData.hasSkylights && (Number(extractedData.skylightCount) || 0) === 0) {
    instructions = instructions.filter(step => !/skylight/i.test(step));
  }

  const notes = warnings.length > 0 ? [...filteredNotes, ...warnings] : filteredNotes;
  return { materials, instructions, laborItems: finalLabor, notes };
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

    // ── 3b. Consistency check: sync materials, instructions, notes, and labor ───
    const {
      materials: calculatedMaterials,
      instructions: finalInstructions,
      laborItems: finalLaborItems,
      notes: finalNotes,
    } = runConsistencyCheck(extractedData, rawMaterials, crewInstructions, laborItems, materialNotes);

    // ── 4. Generate PDF ──────────────────────────────────────────────────
    const pdfBuffer = await generatePDFBuffer(
      { ...extractedData, customerName, address },
      calculatedMaterials,
      finalInstructions,
      finalLaborItems,
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
        laborItems: finalLaborItems,
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
