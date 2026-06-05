import Anthropic from '@anthropic-ai/sdk';
import { CREW_INSTRUCTION_RULES, CODE_COMPLIANCE_RULES, INSURANCE_SCOPE_MAPPING, MATERIAL_LOGIC } from './training-data';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key',
});

const isPlaceholderKey = () =>
  !process.env.ANTHROPIC_API_KEY ||
  process.env.ANTHROPIC_API_KEY.includes('your_') ||
  process.env.ANTHROPIC_API_KEY.includes('placeholder');

// Max image size in bytes to send to Claude (1.5 MB base64 ≈ ~1 MB raw image)
// Large site photos are the #1 cause of slow processing — we cap them here
const MAX_IMAGE_BYTES = 1_500_000;

/**
 * Resize image buffer by truncating to MAX_IMAGE_BYTES.
 * Claude can still extract visual information from a compressed/truncated JPEG.
 * For the best speed, images should ideally be compressed before upload.
 */
function capImageBuffer(buffer: Buffer): Buffer {
  if (buffer.length <= MAX_IMAGE_BYTES) return buffer;
  console.warn(`[anthropic] Image truncated from ${(buffer.length / 1024).toFixed(0)}KB to ${(MAX_IMAGE_BYTES / 1024).toFixed(0)}KB for speed`);
  return buffer.subarray(0, MAX_IMAGE_BYTES);
}

/**
 * Robustly clean LLM JSON response by escaping raw newlines and control characters inside double quotes.
 */
function cleanRawJson(text: string): string {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/```$/, '').trim();

  let inString = false;
  let escapeNext = false;
  let result = '';
  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (escapeNext) {
      result += char;
      escapeNext = false;
      continue;
    }
    if (char === '\\') {
      result += char;
      escapeNext = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }
    if (inString) {
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else {
        result += char;
      }
    } else {
      result += char;
    }
  }
  return result;
}


/**
 * Single-shot Claude call: extract measurements AND generate crew documents in one pass.
 * Merging both calls cuts total API wait time roughly in half.
 */
export async function processJobWithAI(documents: any[]): Promise<{
  extractedData: any;
  crewInstructions: string[];
  laborItems: string[];
  materialNotes: string[];
}> {
  const emptyExtracted = {
    squares: 0, pitch: 'N/A', ridges: 0, hips: 0, valleys: 0,
    rakes: 0, eaves: 0, pipeBoots: 0, vents: 0,
    exhaustVents: 0, turtleVents: 0, powerVents: 0, turbines: 0, otherPenetrations: 0,
    insuranceCompany: 'N/A', claimNumber: 'N/A',
    approvedAmount: 'N/A', deductible: 'N/A',
    customerName: 'N/A', address: 'N/A',
    notes: 'No documents found to extract.', contractType: 'N/A',
    shingleProduct: 'N/A', shingleColor: 'N/A',
    hasSkylights: false, skylightCount: 0,
    hasHeatCable: false, hasChimney: false, hasSolarPanels: false,
    ventilationStrategy: 'N/A', sidewallLF: 0,
    insuranceSquares: 0, insuranceVents: 0, insuranceDripEdgeLF: 0, insuranceRidgeLF: 0,
  };
  const emptyDocs = { crewInstructions: [], laborItems: [], materialNotes: [] };

  if (isPlaceholderKey()) {
    console.warn('[anthropic] API Key is a placeholder — returning mock data.');
    return {
      extractedData: {
        squares: 30, pitch: '6/12', ridges: 40, hips: 20, valleys: 15,
        rakes: 50, eaves: 60, pipeBoots: 2, vents: 4,
        exhaustVents: 0, turtleVents: 0, powerVents: 0, turbines: 0, otherPenetrations: 0,
        insuranceCompany: 'Mock Insurance Co.', claimNumber: 'CLM-99999',
        approvedAmount: '$12,500', deductible: '$1,000',
        customerName: 'Jane Doe Testing', address: '456 Test Street, Mock City',
        notes: 'Mock extraction — replace API keys with real credentials.',
        contractType: 'Insurance', shingleProduct: 'N/A', shingleColor: 'N/A',
        hasSkylights: false, skylightCount: 0, hasHeatCable: false,
        hasChimney: false, hasSolarPanels: false, ventilationStrategy: 'Ridge', sidewallLF: 0,
        insuranceSquares: 30, insuranceVents: 4, insuranceDripEdgeLF: 110, insuranceRidgeLF: 40,
      },
      crewInstructions: ['Install per manufacturer specs', 'Take before/after photos'],
      laborItems: ['Standard tear-off'],
      materialNotes: ['Verify shingle color before ordering'],
    };
  }

  if (!documents || documents.length === 0) {
    return { extractedData: emptyExtracted, ...emptyDocs };
  }

  const systemPrompt = `You are an expert roofing project manager and data extractor for Reliable Exteriors Group.

BUSINESS RULES FOR CREW DOCUMENTS:
${CREW_INSTRUCTION_RULES}
${CODE_COMPLIANCE_RULES}
${INSURANCE_SCOPE_MAPPING}
${MATERIAL_LOGIC}`;

  const userPrompt = `Analyze the provided roofing job documents and return ONE JSON object with two sections.

Return ONLY valid JSON — no markdown, no explanation, no code blocks.

{
  "extracted": {
    "squares": number,
    "pitch": string,
    "ridges": number,
    "hips": number,
    "valleys": number,
    "rakes": number,
    "eaves": number,
    "pipeBoots": number,
    "vents": number,
    "exhaustVents": number,
    "turtleVents": number,
    "powerVents": number,
    "turbines": number,
    "otherPenetrations": number,
    "insuranceCompany": string,
    "claimNumber": string,
    "approvedAmount": string,
    "deductible": string,
    "customerName": string,
    "address": string,
    "notes": string,
    "contractType": "Insurance" | "Retail",
    "shingleProduct": string,
    "shingleColor": string,
    "hasSkylights": boolean,
    "skylightCount": number,
    "hasHeatCable": boolean,
    "hasChimney": boolean,
    "hasSolarPanels": boolean,
    "ventilationStrategy": "Ridge" | "Box" | "Hybrid" | "N/A",
    "sidewallLF": number,
    "insuranceSquares": number,
    "insuranceVents": number,
    "insuranceDripEdgeLF": number,
    "insuranceRidgeLF": number
  },
  "documents": {
    "crewInstructions": ["instruction 1", "instruction 2"],
    "laborItems": ["labor item 1", "labor item 2"],
    "materialNotes": ["note 1", "note 2"]
  }
}

Rules:
- General Measurements: Eagle View data takes highest priority for general roof geometry measurements (squares, pitch, hips, valleys, rakes, eaves).
- Non-Ridge Vent Components (pipeBoots, vents, exhaustVents, turtleVents, powerVents, turbines, otherPenetrations): Use the following source hierarchy to extract their quantities:
  1. Insurance Scope (Estimate line items RFG PJ3, RFG PJ4, RFG BOX, RFG CAP, etc.)
  2. SOW (Contract / Job Notes)
  3. Photos / Photo Assessment documents
  Do NOT use EagleView as the source of truth for these non-ridge vent components, as they typically do not appear on EagleView.
- Ridge Vent Length: Extract the ridges measurement (representing ridge vent length to install) following this source hierarchy:
  1. Ventilation Scope Sheet (absolute Source of Truth; override EagleView measurements when available)
  2. SOW (Contract / Job Notes)
  3. EagleView ridge measurements (Fallback measurement tool)
  4. Photos for validation
  The Ventilation Scope Sheet always overrides EagleView ridge measurements when both are available. EagleView can be used as a fallback measurement tool, but not as the primary source.
- Use 0 for missing numbers, "N/A" for missing strings.
- ventilationStrategy: extract from the scope/insurance document ONLY — not from roof geometry. Scope of Work / Insurance estimate is the absolute, primary source of truth for venting. Do NOT assume ridge vents are needed just because there are "ridges" on the roof. Turtle/static/box vents in scope → "Box". Ridge vent in scope → "Ridge". Both → "Hybrid". Unclear → "N/A". If the scope specifies box/turtle/static vents, ventilationStrategy MUST be "Box".
- insuranceSquares: extract the total squares specifically listed/approved in the insurance scope of work (e.g. tear off or install shingle line item quantity). Use 0 if retail or not found.
- insuranceVents: extract the total number of box/turtle/static vents listed in the insurance scope of work. Use 0 if not found.
- insuranceDripEdgeLF: extract the total linear feet (LF) of drip edge listed in the insurance scope of work. Use 0 if not found.
- insuranceRidgeLF: extract the total linear feet (LF) of ridge vent listed in the insurance scope of work. Use 0 if not found.
- crewInstructions: specific actionable crew steps derived ONLY from the CREW INSTRUCTION MASTER TEMPLATE in the business rules above. You MUST strictly restrict output to the approved templates. Do not invent steps not covered by the template.
- laborItems: billable charges selected ONLY from the approved labor charges in INSURANCE SCOPE MAPPING above. Every item in laborItems MUST match or contain one of these approved categories (with custom numbers/quantities if applicable): Standard tear-off [number of layers] layer(s), Second story charge, Steep slope charge, Skylight replacement, Chimney flashing, Gutter replacement, Satellite dish reset, Heat cable R&R, Solar panel removal, Permit fee, Mid-roof inspection fee, Decking replacement. Do not invent or include other labor items.
- materialNotes: color matches, special products, code additions, supplement flags.

CRITICAL — Ventilation alignment: The ventilationStrategy you extract drives ALL ventilation content.
- If ventilationStrategy = "Box": crew instructions MUST include installing static/box vents per extracted count. Do NOT include ridge vent cut-in or ridge vent installation steps. Do NOT reference ridge vent in materialNotes.
- If ventilationStrategy = "Ridge": crew instructions MUST include ridge vent cut-in. Do NOT include box/turtle vent installation steps.
- If ventilationStrategy = "Hybrid": include both ridge and box vent steps.
- If ventilationStrategy = "N/A": omit all ventilation installation steps.
Every crew instruction and material note about ventilation MUST be consistent with the extracted ventilationStrategy.`;

  try {
    const contentBlocks: any[] = [...documents, { type: 'text', text: userPrompt }];

    console.log(`[anthropic] Sending ${documents.length} document(s) to Claude in a single call...`);
    const startTime = Date.now();

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: contentBlocks }],
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[anthropic] Response received in ${elapsed}s (stop_reason: ${msg.stop_reason})`);

    // Detect truncated output — Claude hit max_tokens before finishing
    if (msg.stop_reason === 'max_tokens') {
      console.warn('[anthropic] WARNING: Response was truncated (max_tokens reached). Output may be incomplete.');
    }

    const rawText = msg.content && msg.content.length > 0 && msg.content[0].type === 'text'
      ? msg.content[0].text
      : '{}';
    const cleaned = cleanRawJson(rawText);

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr: any) {
      // Trim to last complete closing brace (handles max_tokens truncation)
      console.warn(`[anthropic] JSON parse failed: ${parseErr.message} — attempting repair...`);
      const lastBrace = cleaned.lastIndexOf('}');
      if (lastBrace >= 0) {
        try {
          parsed = JSON.parse(cleaned.substring(0, lastBrace + 1));
          console.log('[anthropic] JSON repair successful (trimmed to last closing brace)');
        } catch {
          console.error('[anthropic] JSON repair failed — returning defaults');
          parsed = { extracted: {}, documents: {} };
        }
      } else {
        console.error('[anthropic] No closing brace found in response — returning defaults');
        parsed = { extracted: {}, documents: {} };
      }
    }

    const extractedData = parsed.extracted || emptyExtracted;
    const docs = parsed.documents || {};

    return {
      extractedData,
      crewInstructions: Array.isArray(docs.crewInstructions) ? docs.crewInstructions : [],
      laborItems: Array.isArray(docs.laborItems) ? docs.laborItems : [],
      materialNotes: Array.isArray(docs.materialNotes) ? docs.materialNotes : [],
    };
  } catch (error: any) {
    console.error('[anthropic] Error:', error?.status, error?.message || error);
    throw new Error(`Claude AI error: ${error?.message || 'Unknown error'}`);
  }
}

// ─── Legacy exports kept for backwards compatibility ───────────────────────

export async function extractJobData(documents: any[]) {
  const result = await processJobWithAI(documents);
  return result.extractedData;
}

export async function generateOutputDocuments(_extractedData: any, _calculatedMaterials: any) {
  // This is now a no-op stub — processJobWithAI handles both in one call
  // Called from process-job route after processJobWithAI, returns empty (already populated)
  return { crewInstructions: [], laborItems: [], materialNotes: [] };
}

export { capImageBuffer };
