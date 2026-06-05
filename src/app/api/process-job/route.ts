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

    const x: Record<string, any> = data.extra_config || {};

    return {
      // main columns
      feltCoverage:      data.felt_coverage,
      ridgeCapCoverage:  data.ridge_cap_coverage,
      dripEdgeLength:    data.drip_edge_length,
      coilNailsCoverage: data.coil_nails_coverage,
      enableFelt:        data.enable_felt,
      enableIceWater:    data.enable_ice_water,
      enableRidgeCap:    data.enable_ridge_cap,
      enableDripEdge:    data.enable_drip_edge,
      enableCoilNails:   data.enable_coil_nails,
      // extended settings from extra_config JSONB
      ...x,
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

  // Helper function to extract a quantity from description/notes text using keywords
  function parseQuantityFromText(lines: string[], itemKeywords: RegExp, maxAllowed = 100): number | null {
    let maxVal = null;
    const IGNORED_UNITS = /^\s*(?:sq(?:[a-z]*)\b|sf\b|s\.f\.|lf\b|l\.f\.|linear\s*feet\b|ft\b|feet\b|in\b|inch(?:es)?\b)/i;
    const DECIMAL_CHECK = /^\.\d/;

    for (const line of lines) {
      if (itemKeywords.test(line)) {
        // 1. Remove all dollar/price values (e.g. $15,989, $500, $120.00)
        let cleanLine = line.replace(/\$\d+(?:,\d{3})*(?:\.\d+)?/g, '');

        // 2. Clean known fractions, brand/model names, and pipe jack sizes so they don't
        //    sit between a number and the material keyword (e.g. "7 Lomanco 750 box vents"
        //    → "7 box vents" so keyword_prefix can connect the count to the keyword).
        cleanLine = cleanLine
          .replace(/7\/16/g, '')
          .replace(/geocel\s*2300/gi, 'geocel')
          .replace(/lomanco\s*\d*/gi, '')   // "Lomanco 750" or bare "Lomanco"
          .replace(/\blamanco\b/gi, '')     // Lamanco brand (ridge vent manufacturer)
          .replace(/\b3[\s-]*in[\s-]*1\b/gi, '')   // "3-in-1" and "3 in 1" variants
          .replace(/\b4[\s-]*in[\s-]*1\b/gi, '');

        let lineMax: number | null = null;

        // Try direct keyword match first if the regex contains a capturing group for the number
        // e.g. /remove\s*(?:old)?\s*(\d+)\s*(?:box|turtle|static)\s*vents/i
        const directMatch = cleanLine.match(itemKeywords);
        if (directMatch && directMatch[1] && !isNaN(parseInt(directMatch[1]))) {
          const val = parseInt(directMatch[1]);
          if (val <= maxAllowed) {
            lineMax = val;
          }
        }

        if (lineMax === null) {
          // Define regexes in order of priority (most specific first)
          const regexes = [
            // 1. Total/final keywords followed by up to 3 words and a number (handles "= N", ": N", " N")
            // "order" removed: "flag to order 1 additional" would falsely capture 1 as a total.
            // "ORDER MINIMUM N" still works because min_prefix catches "minimum".
            { r: /(?:total|final|reconciled)(?:\s+[a-z:]+){0,3}\s*(?:[=:]\s*|\s+)?(\d+)/gi, name: 'total_prefix' },
            { r: /(\d+)\s*(?:pcs|pieces|cans|tubes|sheets|ea|roll[s]?|bundle[s]?|box[es]?|set[s]?|sq)?[s]?\s*(?:total|final|reconciled|order)/gi, name: 'total_suffix' },
            // 2. Minimum/require/replace keywords — "install" and "need" removed to prevent
            //    false positives like "Install 7 box vents … OSB patches" → OSB=7
            { r: /(?:minimum|min|require|replace)(?:\s+[a-z:]+){0,3}\s*(?:[=:]\s*|\s+)?(\d+)/gi, name: 'min_prefix' },
            { r: /(\d+)\s*(?:pcs|pieces|cans|tubes|sheets|ea|roll[s]?|bundle[s]?|box[es]?|set[s]?|sq)?[s]?\s*(?:minimum|min|require|replace)/gi, name: 'min_suffix' },
            // 3. Proximity matches with the item's keywords
            { r: new RegExp(`(?:^|\\b)(?<!\\/)(\\d+)\\s*(?:pcs|pieces|cans|tubes|sheets|ea|units?|roll[s]?|bundle[s]?|box[es]?|set[s]?|sq)?[s]?\\s*(?:of\\s*)?(?:${itemKeywords.source})[s]?`, 'gi'), name: 'keyword_prefix' },
            { r: new RegExp(`(?:${itemKeywords.source})[s]?\\s*(?:total|quantity|order|install|need|require|added|addition)?[s]?\\s*(?:of\\s*)?(\\d+)`, 'gi'), name: 'keyword_suffix' },
            { r: new RegExp(`(?:^|\\b)(?<!\\/)(\\d+)\\s*(?:${itemKeywords.source})[s]?`, 'gi'), name: 'keyword_simple' }
          ];

          for (const regObj of regexes) {
            const regex = regObj.r;
            let match;
            regex.lastIndex = 0;
            while ((match = regex.exec(cleanLine)) !== null) {
              const valStr = match[1] || match[2] || '';
              const val = parseInt(valStr);
              if (!isNaN(val)) {
                // Find what follows the matched number in cleanLine
                const numIndex = match.index + match[0].indexOf(valStr);
                const afterNum = cleanLine.substring(numIndex + valStr.length);

                // Ignore if it's a decimal number (like .81 or .14)
                if (DECIMAL_CHECK.test(afterNum)) {
                  continue;
                }

                // Ignore if it is followed by area or length units
                if (IGNORED_UNITS.test(afterNum)) {
                  continue;
                }

                if (val <= maxAllowed) {
                  if (lineMax === null || val > lineMax) {
                    lineMax = val;
                  }
                }
              }
            }
            // If we found a value at this priority level, use it for this line
            if (lineMax !== null) {
              break;
            }
          }
        }

        if (lineMax !== null) {
          if (maxVal === null || lineMax > maxVal) {
            maxVal = lineMax;
          }
        }
      }
    }
    return maxVal;
  }

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
    const boxCount = Number(extractedData.boxVents) || Number(extractedData.turtleVents) || Number(extractedData.vents) || Number(extractedData.insuranceVents) || 0;
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
      instructions.push(`Remove old vents and install static/box vent(s) per EagleView count. Do NOT install ridge vent.`);
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

  // 5. Build description list for programmatic reconciliation
  const descriptionLines = [extractedData.notes || '', ...instructions, ...filteredNotes];

  // 6. PROGRAMMATIC RECONCILIATION & VALIDATION CHECK (Point 11)

  // Underlayment (Point 6): Account for city/county code requirements (e.g. double felt)
  const isDoubleFelt = 
    /double\s*[-]?\s*felt|double\s*[-]?\s*underlayment|2\s*layers\s*of\s*(?:felt|underlayment)|two\s*layers\s*of\s*(?:felt|underlayment)/i.test(extractedData.notes || '') ||
    instructions.some(s => /double\s*[-]?\s*felt|double\s*[-]?\s*underlayment|2\s*layers\s*of\s*(?:felt|underlayment)|two\s*layers\s*of\s*(?:felt|underlayment)/i.test(s)) ||
    filteredNotes.some(n => /double\s*[-]?\s*felt|double\s*[-]?\s*underlayment|2\s*layers\s*of\s*(?:felt|underlayment)|two\s*layers\s*of\s*(?:felt|underlayment)/i.test(n));

  if (isDoubleFelt) {
    const doubleFeltRolls = (materials.felt || 0) * 2;
    if (materials.felt < doubleFeltRolls) {
      materials.felt = doubleFeltRolls;
      warnings.push(`QUANTITY SYNC: Synthetic underlayment doubled to ${doubleFeltRolls} rolls for double-felt code requirement.`);
    }
  }
  // Ice & Water Shield (Point 7): Reconcile with description code requirements
  const parsedIWS = parseQuantityFromText(descriptionLines, /ice\s*&\s*water|ice\s*and\s*water|i&w|rolls\s*of\s*ice/i);
  if (parsedIWS !== null) {
    materials.iceAndWater = parsedIWS;
    warnings.push(`RECONCILIATION: Ice & Water Shield adjusted to match description count (${parsedIWS} rolls).`);
  }

  // Step Flashing (Point 2): Reconcile bundle/pieces counts
  const parsedStepBundles = parseQuantityFromText(descriptionLines, /bundle[s]?\s*of\s*step\s*flashing|step\s*flashing\s*bundle[s]?/i);
  // Narrow keyword: only match when pcs/pieces is directly tied to "step flashing" —
  // prevents Geocel notes like "minimum 4-5 tubes … for step flashing" grabbing 4 as pieces.
  const parsedStepPcs = parseQuantityFromText(descriptionLines, /piece[s]?\s*of\s*step\s*flashing|step\s*flashing\s*(?:piece[s]?|pcs)\b/i, 500);
  
  if (parsedStepBundles !== null) {
    materials.stepFlashing = parsedStepBundles;
    materials.stepFlashingPcs = parsedStepBundles * 45;
    warnings.push(`RECONCILIATION: Step Flashing adjusted to match description count (${parsedStepBundles} bundles).`);
  } else if (parsedStepPcs !== null) {
    if (parsedStepPcs > 5) {
      materials.stepFlashingPcs = parsedStepPcs;
      materials.stepFlashing = Math.ceil(parsedStepPcs / 45);
      warnings.push(`RECONCILIATION: Step Flashing adjusted to match description count (${parsedStepPcs} pieces / ${materials.stepFlashing} bundles).`);
    } else {
      materials.stepFlashing = parsedStepPcs;
      materials.stepFlashingPcs = parsedStepPcs * 45;
      warnings.push(`RECONCILIATION: Step Flashing adjusted to match description count (${parsedStepPcs} bundles).`);
    }
  }
  
  // Ensure step flashing has at least 1 bundle if mentioned in instructions/notes but is 0
  if (materials.stepFlashing === 0 && (instructions.some(s => /step flashing/i.test(s)) || filteredNotes.some(n => /step flashing/i.test(n)))) {
    materials.stepFlashing = 1;
    materials.stepFlashingPcs = 45;
    warnings.push('CONSISTENCY FIX: Step flashing set to 1 bundle based on crew instructions / notes.');
  }

  // Counter Flashing (Point 1): Auto include for chimney, masonry wall, or roof-to-wall
  // Guard: "no chimney" / "without chimney" in a negative context must NOT trigger this.
  const hasChimney = !!extractedData.hasChimney;
  const notesStr = extractedData.notes || '';
  const chimneyPositiveInNotes =
    /\bchimney\b/i.test(notesStr) && !/no chimney|without chimney|chimney\s+(?:flashing\s+)?not\b/i.test(notesStr);
  const hasMasonryOrRoofToWall =
    /masonry|roof-to-wall|roof to wall/i.test(notesStr) ||
    chimneyPositiveInNotes ||
    instructions.some(s =>
      /masonry|roof-to-wall|roof to wall/i.test(s) ||
      (/\bchimney\b|counter\s*flashing/i.test(s) && !/no chimney|do not/i.test(s))
    ) ||
    filteredNotes.some(n =>
      /masonry|roof-to-wall|roof to wall/i.test(n) ||
      (/\bchimney\b|counter\s*flashing/i.test(n) && !/no chimney|do not/i.test(n))
    );

  if (hasChimney || hasMasonryOrRoofToWall) {
    if (materials.counterFlashing === 0) {
      materials.counterFlashing = 1;
      warnings.push('CONSISTENCY FIX: Counter flashing automatically included due to chimney, masonry wall, or roof-to-wall condition.');
    }
  }
  const parsedCounter = parseQuantityFromText(descriptionLines, /counter\s*flashing|counter\s*flash/i);
  // Guard: only apply when a real chimney/masonry condition exists — prevents "4x5 counter
  // flashing" dimension references from being misread as a quantity on no-chimney jobs.
  if (parsedCounter !== null && (hasChimney || hasMasonryOrRoofToWall)) {
    materials.counterFlashing = parsedCounter;
    warnings.push(`RECONCILIATION: Counter Flashing adjusted to match description count (${parsedCounter} pcs).`);
  }

  // Valley Metal (Point 8) — include when valleys are present; 1 roll per 50 LF
  const hasSkylights = !!extractedData.hasSkylights || (Number(extractedData.skylightCount) || 0) > 0 || instructions.some(s => /skylight/i.test(s));
  const valleyLF = Number(extractedData.valleys) || 0;
  if (valleyLF > 0 && (materials.valleyMetal || 0) === 0) {
    materials.valleyMetal = Math.max(1, Math.ceil(valleyLF / 50));
    warnings.push(`CONSISTENCY FIX: Valley metal (20" x 50' roll) automatically included for ${valleyLF} LF of roof valleys.`);
  }
  const parsedValleyMetal = parseQuantityFromText(descriptionLines, /valley\s*metal|rolled\s*valley/i);
  // Only apply when the job actually has valleys or skylights — prevents "no valley metal required"
  // notes from accidentally raising the count via a stray number in a long description line.
  if (parsedValleyMetal !== null && valleyLF > 0) {
    materials.valleyMetal = parsedValleyMetal;
    warnings.push(`RECONCILIATION: Valley Metal rolls adjusted to match description count (${parsedValleyMetal} rolls).`);
  }

  // Box Vents (Point 3)
  const parsedBoxVents = parseQuantityFromText(descriptionLines, /box\s*vent|slant\s*back/i);
  if (parsedBoxVents !== null) {
    materials.boxVents = parsedBoxVents;
    warnings.push(`RECONCILIATION: Box Vents adjusted to match description/upgrades count (${parsedBoxVents} ea).`);
  }

  // Turtle Vents
  const parsedTurtleVents = parseQuantityFromText(descriptionLines, /turtle\s*vent/i);
  if (parsedTurtleVents !== null) {
    materials.turtleVents = parsedTurtleVents;
    warnings.push(`RECONCILIATION: Turtle Vents adjusted to match description count (${parsedTurtleVents} ea).`);
  }

  // Exhaust Vents / Caps
  const parsedExhaustVents = parseQuantityFromText(descriptionLines, /exhaust\s*vent|exhaust\s*cap/i);
  if (parsedExhaustVents !== null) {
    materials.exhaustVents = parsedExhaustVents;
    warnings.push(`RECONCILIATION: Exhaust Vents adjusted to match description count (${parsedExhaustVents} ea).`);
  }

  // Power Vents
  const parsedPowerVents = parseQuantityFromText(descriptionLines, /power\s*vent/i);
  if (parsedPowerVents !== null) {
    materials.powerVents = parsedPowerVents;
    warnings.push(`RECONCILIATION: Power Vents adjusted to match description count (${parsedPowerVents} ea).`);
  }

  // Turbines
  const parsedTurbines = parseQuantityFromText(descriptionLines, /turbine/i);
  if (parsedTurbines !== null) {
    materials.turbines = parsedTurbines;
    warnings.push(`RECONCILIATION: Turbines adjusted to match description count (${parsedTurbines} ea).`);
  }

  // Other Roof Penetrations
  const parsedOtherPenetrations = parseQuantityFromText(descriptionLines, /other\s*roof\s*penetration|other\s*penetration/i);
  if (parsedOtherPenetrations !== null) {
    materials.otherPenetrations = parsedOtherPenetrations;
    warnings.push(`RECONCILIATION: Other Roof Penetrations adjusted to match description count (${parsedOtherPenetrations} ea).`);
  }

  // Pipe Jacks (Point 3)
  const parsedPipeJacks = parseQuantityFromText(descriptionLines, /pipe\s*jack|pipe\s*boot|3\s*in\s*1|4\s*in\s*1/i);
  if (parsedPipeJacks !== null) {
    materials.pipeJacks = parsedPipeJacks;
    warnings.push(`RECONCILIATION: Pipe Jacks adjusted to match description count (${parsedPipeJacks} ea).`);
  }

  // Turtle Vent Removal & OSB Sheathing (Point 9)
  let ventsRemoved = 0;
  const isRemovingVents = 
    /remove\s*(?:old)?\s*(?:box|turtle|static)\s*vents/i.test(extractedData.notes || '') ||
    instructions.some(s => /remove\s*(?:old)?\s*(?:box|turtle|static)\s*vents/i.test(s)) ||
    filteredNotes.some(n => /remove\s*(?:old)?\s*(?:box|turtle|static)\s*vents/i.test(n));

  // OSB is needed when patching holes left by removed turtle/box vents.
  // Only trigger automatically for Ridge strategy (which replaces all box vents).
  // Hybrid keeps existing vents — only trigger if the description explicitly says removal.
  if (isRemovingVents || (ventStrategy === 'Ridge' && (Number(extractedData.vents) > 0 || Number(extractedData.insuranceVents) > 0 || Number(extractedData.turtleVents) > 0 || Number(extractedData.boxVents) > 0))) {
    ventsRemoved = Number(extractedData.turtleVents) || Number(extractedData.boxVents) || Number(extractedData.vents) || Number(extractedData.insuranceVents) || 0;
    if (ventsRemoved === 0) {
      const parsedRemoved = parseQuantityFromText(descriptionLines, /remove\s*(?:old)?\s*(\d+)\s*(?:box|turtle|static)\s*vents/i);
      ventsRemoved = parsedRemoved !== null ? parsedRemoved : 4; // default to 4 if we know they are removed but count is 0
    }
  }
  
  if (ventsRemoved > 0 && (materials.osbSheathing || 0) === 0) {
    materials.osbSheathing = ventsRemoved; // 1 sheet per vent removed
    warnings.push(`CONSISTENCY FIX: ${ventsRemoved} sheet(s) of 7/16" OSB Sheathing included for removing ${ventsRemoved} turtle/box vent(s).`);
  }
  const parsedOSB = parseQuantityFromText(descriptionLines, /osb|sheathing|plywood\s*sheet/i);
  // Only apply when turtle/box vent removal is actually happening — prevents lines like
  // "Install 7 box vents … seal with OSB patches" from setting osbSheathing=7.
  if (parsedOSB !== null && ventsRemoved > 0) {
    materials.osbSheathing = parsedOSB;
    warnings.push(`RECONCILIATION: OSB Sheathing sheets adjusted to match description count (${parsedOSB} sheets).`);
  }

  // Valleys & Mule-Hide JTS1 (Point 10)
  const valleysLF = Number(extractedData.valleys) || 0;
  if (valleysLF > 0 && (materials.muleHideSealant || 0) === 0) {
    materials.muleHideSealant = Math.max(1, Math.ceil(valleysLF / 40));
    warnings.push(`CONSISTENCY FIX: Mule-Hide JTS1 Joint Sealant automatically included for roof valleys.`);
  }
  const parsedMuleHide = parseQuantityFromText(descriptionLines, /mule[-]hide|jts1|joint\s*sealant/i);
  // Only apply when the job actually has valleys — prevents "no Mule-Hide required" mentions
  // from raising the count via stray numbers in description lines.
  if (parsedMuleHide !== null && valleysLF > 0) {
    materials.muleHideSealant = parsedMuleHide;
    warnings.push(`RECONCILIATION: Mule-Hide JTS1 Joint Sealant adjusted to match description count (${parsedMuleHide} tubes).`);
  }

  // Touch-Up Paint (Point 4): Recalculate based on final reconciled metals + extra can if additional metals, or parsed quantity
  let paintCount = 0;
  const hasMetals =
    materials.dripEdge > 0 ||
    materials.stepFlashing > 0 ||
    materials.counterFlashing > 0 ||
    materials.pipeJacks > 0 ||
    materials.boxVents > 0 ||
    materials.ridgeVentSections > 0 ||
    materials.exhaustVents > 0 ||
    materials.turtleVents > 0 ||
    materials.powerVents > 0 ||
    materials.turbines > 0 ||
    materials.otherPenetrations > 0 ||
    (materials.valleyMetal && materials.valleyMetal > 0);

  if (hasMetals) {
    paintCount = 2; // base
    if (materials.stepFlashing > 0 || materials.counterFlashing > 0 || (materials.valleyMetal && materials.valleyMetal > 0) ||
        materials.exhaustVents > 0 || materials.turtleVents > 0 || materials.powerVents > 0 ||
        materials.turbines > 0 || materials.otherPenetrations > 0) {
      paintCount += 1;
    }
  }
  // Use specific phrase match to avoid "painted" (adjective) triggering a quantity search.
  // Only override upward — prevents "order 1 additional" phrasing from lowering a correct count.
  const parsedPaint = parseQuantityFromText(descriptionLines, /touch[- ]up\s*paint|\bcans?\s+of\s+(?:touch[- ]up\s+)?paint\b/i);
  if (parsedPaint !== null && parsedPaint > paintCount) {
    paintCount = parsedPaint;
    warnings.push(`RECONCILIATION: Touch-Up Paint adjusted to match description paint requirements (${parsedPaint} cans).`);
  }
  materials.touchUpPaint = paintCount;

  // Geocel 2300 Sealant (Point 5): Scale base sealant with box vents, step, counter, valley metal additions
  let expectedSealant = Math.max(3, Math.ceil(valleysLF / 40 + ((Number(extractedData.ridges) || 0) + (Number(extractedData.hips) || 0)) / 60));
  if (materials.counterFlashing > 0) expectedSealant += materials.counterFlashing * 1;
  if (materials.boxVents > 0) expectedSealant += Math.ceil(materials.boxVents / 2);
  if (materials.exhaustVents > 0) expectedSealant += Math.ceil(materials.exhaustVents / 2);
  if (materials.turtleVents > 0) expectedSealant += Math.ceil(materials.turtleVents / 2);
  if (materials.powerVents > 0) expectedSealant += materials.powerVents * 1;
  if (materials.turbines > 0) expectedSealant += materials.turbines * 1;
  if (materials.otherPenetrations > 0) expectedSealant += Math.ceil(materials.otherPenetrations / 2);
  if (materials.stepFlashing > 0) expectedSealant += materials.stepFlashing * 1;
  if (materials.valleyMetal > 0) expectedSealant += materials.valleyMetal * 1;

  const parsedGeocel = parseQuantityFromText(descriptionLines, /geocel|sealant|tubes\s*of\s*sealant/i);
  // Only override upward — Claude's base-formula note often shows a lower count than the
  // reconciliation engine which correctly adds extras for box vents, step flashing, etc.
  if (parsedGeocel !== null && parsedGeocel > expectedSealant) {
    expectedSealant = parsedGeocel;
    warnings.push(`RECONCILIATION: Geocel 2300 Sealant adjusted to match description count (${parsedGeocel} tubes).`);
  }
  materials.sealant = expectedSealant;

  // Shingles waste quantity check
  const sq = Number(extractedData.squares) || 0;
  if (sq > 0) {
    const expectedShingles = Math.ceil(sq * 1.10);
    if (materials.shingles !== expectedShingles) {
      materials.shingles = expectedShingles;
      warnings.push(`QUANTITY SYNC: Field shingles adjusted to match squares formula (${expectedShingles} SQ).`);
    }
  }

  // 7. Quantity validations (EagleView vs Insurance Scope)
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

  // 8. Restrict Labor Items strictly to approved Master List
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
  if (hasSkylights) {
    laborSet.add('Skylight replacement');
  }

  // Chimney / masonry
  if (hasChimney || hasMasonryOrRoofToWall) {
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

  // 9. General cleanup of crew instructions (ensure no contradictions)
  if (!hasChimney && !hasMasonryOrRoofToWall) {
    instructions = instructions.filter(step => !/chimney/i.test(step));
  }
  if (!hasSkylights) {
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

    // Inject Job Notes if provided by the user in the UI field (Point 3 / Job Notes integration)
    if (_notes && typeof _notes === 'string' && _notes.trim().length > 0) {
      console.log(`[process-job] Injecting custom Job Notes into Claude's workspace: "${_notes.trim().substring(0, 60)}..."`);
      claudeDocuments.push({
        type: 'text',
        text: `--- ADDITIONAL CUSTOM JOB NOTES (SPECIAL CIRCUMSTANCES / CUSTOMER UPGRADES & ADDITIONS) ---\n${_notes.trim()}\n--- END OF JOB NOTES ---`,
      });
    }

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
